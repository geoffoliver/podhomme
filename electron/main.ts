import { app, BrowserWindow, shell, Menu, utilityProcess, dialog } from 'electron';
import type { UtilityProcess } from 'electron';
import { autoUpdater } from 'electron-updater';
import path from 'path';
import http from 'http';

app.name = 'Podhomme';

const PORT = 3030;
const SERVER_URL = `http://localhost:${PORT}`;
const isDev = !app.isPackaged;

let server: UtilityProcess | null = null;
let mainWindow: BrowserWindow | null = null;

function waitForServer(url: string, timeoutMs = 30_000): Promise<void> {
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
        .on('error', () => {
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

function startServer() {
  const appRoot = app.isPackaged
    ? path.join(process.resourcesPath, 'app')
    : path.join(__dirname, '..');

  const dbDir = app.getPath('userData');
  const dbPath = path.join(dbDir, 'podhomme.db');

  const prismaCli = path.join(appRoot, 'node_modules/prisma/build/index.js');
  const nextCli = path.join(appRoot, 'node_modules/next/dist/bin/next');

  const baseEnv = {
    ...process.env,
    DATABASE_URL: `file:${dbPath}`,
    NODE_ENV: 'production',
  };

  // utilityProcess.fork() uses Electron's built-in Node.js runtime — no
  // ELECTRON_RUN_AS_NODE workaround needed, and works in signed/notarized apps.
  const migrate = utilityProcess.fork(prismaCli, ['migrate', 'deploy'], {
    cwd: appRoot,
    env: baseEnv,
    stdio: 'inherit',
  });

  migrate.once('exit', (code) => {
    if (code !== 0) {
      console.error(`Migrations failed with code ${code}`);
      app.quit();
      return;
    }

    server = utilityProcess.fork(nextCli, ['start'], {
      cwd: appRoot,
      env: { ...baseEnv, PORT: String(PORT) },
      stdio: 'inherit',
    });

    server.on('exit', (code) => console.error('Next.js server exited:', code));
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
        detail: 'Restart now to install the update, or it will be installed automatically when you quit.',
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
    // Hide the native title bar on macOS; keep traffic lights inset into the
    // top bar. trafficLightPosition centers the buttons in the 64px top bar.
    titleBarStyle: mac ? 'hiddenInset' : 'default',
    trafficLightPosition: mac ? { x: 16, y: 24 } : undefined,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadURL(SERVER_URL);

  // Open external links in the system browser
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
    // In dev, assume `next dev` or `next start` is already running
    createWindow();
  } else {
    startServer();
    await waitForServer(SERVER_URL);
    createWindow();
    setupAutoUpdater();
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
