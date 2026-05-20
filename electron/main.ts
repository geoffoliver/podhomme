import { app, BrowserWindow, shell, Menu, utilityProcess, dialog } from 'electron';
import type { UtilityProcess } from 'electron';
import { autoUpdater } from 'electron-updater';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import http from 'http';

app.name = 'Podhomme';

const PORT = 3030;
const SERVER_URL = `http://localhost:${PORT}`;
const isDev = !app.isPackaged;

let server: UtilityProcess | null = null;
let mainWindow: BrowserWindow | null = null;

function runMigrations(dbPath: string, migrationsDir: string) {
  const db = new Database(dbPath);

  db.exec(`CREATE TABLE IF NOT EXISTS _prisma_migrations (
    id                  TEXT PRIMARY KEY,
    checksum            TEXT NOT NULL DEFAULT '',
    finished_at         TEXT,
    migration_name      TEXT NOT NULL,
    logs                TEXT,
    rolled_back_at      TEXT,
    started_at          TEXT NOT NULL DEFAULT (datetime('now')),
    applied_steps_count INTEGER NOT NULL DEFAULT 0
  )`);

  const applied = new Set<string>(
    (
      db
        .prepare(
          'SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL',
        )
        .all() as { migration_name: string }[]
    ).map((r) => r.migration_name),
  );

  if (!fs.existsSync(migrationsDir)) {
    db.close();
    return;
  }

  const dirs = fs
    .readdirSync(migrationsDir)
    .filter((d) => fs.statSync(path.join(migrationsDir, d)).isDirectory())
    .sort();

  const insert = db.prepare(
    `INSERT INTO _prisma_migrations (id, checksum, migration_name, finished_at, applied_steps_count)
     VALUES (?, '', ?, datetime('now'), 1)`,
  );

  for (const dir of dirs) {
    if (applied.has(dir)) continue;
    const sqlFile = path.join(migrationsDir, dir, 'migration.sql');
    if (!fs.existsSync(sqlFile)) continue;
    db.exec(fs.readFileSync(sqlFile, 'utf8'));
    insert.run(crypto.randomUUID(), dir);
  }

  db.close();
}

function waitForServer(url: string, timeoutMs = 120_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const attempt = () => {
      http
        .get(url, (res) => {
          if (res.statusCode && res.statusCode < 500) {
            resolve();
          } else {
            retry();
          }
        })
        .on('error', (err) => {
          if (Date.now() > deadline) {
            reject(new Error(`Server did not start within ${timeoutMs}ms`));
          } else {
            retry();
          }
        });
    };
    const retry = () => setTimeout(attempt, 500);
    attempt();
  });
}

function startServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    const appRoot = app.isPackaged
      ? path.join(process.resourcesPath, 'app')
      : path.join(__dirname, '..');

    const dbDir = app.getPath('userData');
    const dbPath = path.join(dbDir, 'podhomme.db');

    const migrationsDir = app.isPackaged
      ? path.join(process.resourcesPath, 'app.asar.unpacked', 'prisma', 'migrations')
      : path.join(appRoot, 'prisma', 'migrations');

    try {
      runMigrations(dbPath, migrationsDir);
    } catch (err) {
      return reject(err);
    }

    const standaloneDir = app.isPackaged
      ? path.join(process.resourcesPath, 'standalone')
      : path.join(appRoot, '.next', 'standalone');

    const serverScript = path.join(standaloneDir, 'server.js');

    server = utilityProcess.fork(serverScript, [], {
      cwd: standaloneDir,
      env: {
        ...process.env,
        DATABASE_URL: `file:${dbPath}`,
        PODHOMME_DATA_DIR: dbDir,
        PORT: String(PORT),
        NODE_ENV: 'production',
      },
      stdio: 'pipe',
    });

    server.once('spawn', () => resolve());
    server.once('exit', (code) => {
      reject(new Error(`Next.js server exited early with code ${code}`));
    });
  });
}

function setupAutoUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-downloaded', () => {
    dialog
      .showMessageBox({
        type: 'info',
        title: 'Update ready',
        message: 'A new version of Podhomme has been downloaded.',
        detail:
          'Restart now to install the update, or it will be installed automatically when you quit.',
        buttons: ['Restart Now', 'Later'],
        defaultId: 0,
      })
      .then(({ response }) => {
        if (response === 0) autoUpdater.quitAndInstall();
      });
  });

  autoUpdater.on('error', (err) => {
    console.error('Auto-updater error:', err.message);
  });

  autoUpdater.checkForUpdates();
}

function setupMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        {
          label: 'Preferences…',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            mainWindow?.webContents.executeJavaScript(
              'window.dispatchEvent(new CustomEvent("electron:open-settings"))',
            );
          },
        },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  const mac = process.platform === 'darwin';

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'Podhomme',
    titleBarStyle: mac ? 'hiddenInset' : 'default',
    trafficLightPosition: mac ? { x: 16, y: 24 } : undefined,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadURL(SERVER_URL);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  setupMenu();

  if (isDev) {
    createWindow();
  } else {
    try {
      await startServer();
      await waitForServer(SERVER_URL);
      createWindow();
      setupAutoUpdater();
    } catch (err) {
      dialog.showErrorBox(
        'Failed to start Podhomme',
        err instanceof Error ? err.message : String(err),
      );
      app.quit();
    }
  }

  app.on('activate', () => {
    if (mainWindow === null) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  server?.kill();
});
