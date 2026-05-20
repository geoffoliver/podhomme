import { app, BrowserWindow, shell } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import http from 'http';

const PORT = 3030;
const SERVER_URL = `http://localhost:${PORT}`;
const isDev = !app.isPackaged;

let server: ChildProcess | null = null;
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

  // Run migrations before starting the server
  const migrate = spawn(
    process.execPath,
    [path.join(appRoot, 'node_modules/.bin/prisma'), 'migrate', 'deploy'],
    {
      cwd: appRoot,
      env: {
        ...process.env,
        DATABASE_URL: `file:${dbPath}`,
        NODE_ENV: 'production',
      },
      stdio: 'inherit',
    },
  );

  migrate.on('close', (code) => {
    if (code !== 0) {
      console.error(`Migrations failed with code ${code}`);
      app.quit();
      return;
    }

    server = spawn(
      process.execPath,
      [path.join(appRoot, 'node_modules/.bin/next'), 'start'],
      {
        cwd: appRoot,
        env: {
          ...process.env,
          DATABASE_URL: `file:${dbPath}`,
          PORT: String(PORT),
          NODE_ENV: 'production',
        },
        stdio: 'inherit',
      },
    );

    server.on('error', (err) => console.error('Server error:', err));
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'Podhomme',
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
  if (isDev) {
    // In dev, assume `next dev` or `next start` is already running
    createWindow();
  } else {
    startServer();
    await waitForServer(SERVER_URL);
    createWindow();
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
