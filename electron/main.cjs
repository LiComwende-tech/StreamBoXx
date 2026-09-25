const { app, BrowserWindow } = require('electron');
const path = require('node:path');

function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
      minWidth: 800,
      minHeight: 600,
      backgroundColor: '#17131b',
      title: 'StreamBoXx',
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

  const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:5174';
  if (app.isPackaged || process.env.STREAMBOXX_LOAD_DIST === '1') {
    window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  } else {
    window.loadURL(devUrl);
  }

  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});



