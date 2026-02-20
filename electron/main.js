import { app, BrowserWindow, shell } from 'electron';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = !app.isPackaged;
const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';

const waitForDevServer = async (url, retries = 40, delayMs = 500) => {
  if (!isDev) return true;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { method: 'GET' });
      if (res.ok) return true;
    } catch (err) {
      // keep retrying
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return false;
};

const startBackend = async () => {
  try {
    const appPath = app.getAppPath();
    const serverPath = path.join(appPath, 'server.js');
    await import(pathToFileURL(serverPath).href);
  } catch (error) {
    console.error('Failed to start local backend:', error);
  }
};

const createWindow = async () => {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 980,
    minHeight: 640,
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('http') && !url.startsWith(devServerUrl)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  if (isDev) {
    const ok = await waitForDevServer(devServerUrl);
    if (!ok) {
      console.error(`Dev server not reachable at ${devServerUrl}`);
    }
    await win.loadURL(devServerUrl);
  } else {
    const indexPath = path.join(app.getAppPath(), 'dist', 'index.html');
    await win.loadFile(indexPath);
  }
};

app.whenReady().then(async () => {
  await startBackend();
  await createWindow();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
