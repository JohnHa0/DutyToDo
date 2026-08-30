const { app, BrowserWindow, ipcMain, shell, Notification } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

let mainWindow;


let backendProcess = null;

function startBackend() {
  if (app.isPackaged) {
    const backendPath = path.join(process.resourcesPath, 'backend_server');
    if (fs.existsSync(backendPath)) {
      console.log('Starting bundled backend server from: ', backendPath);
      backendProcess = spawn(backendPath, [], { detached: false });
      
      backendProcess.stdout.on('data', (data) => console.log(`Backend: ${data}`));
      backendProcess.stderr.on('data', (data) => console.error(`Backend Err: ${data}`));
    } else {
      console.error('Backend executable not found at: ', backendPath);
    }
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: '值班助手 DutyToDo',
    titleBarStyle: 'hidden',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    // mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }
}

app.whenReady().then(() => {
  startBackend();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC handler for system notifications
ipcMain.on('show-notification', (event, { title, body }) => {
  new Notification({ title, body }).show();
});

// Open external links in default browser
ipcMain.on('open-external', (event, url) => {
  shell.openExternal(url);
});

app.on('will-quit', () => {
  if (backendProcess) {
    backendProcess.kill();
  }
});
