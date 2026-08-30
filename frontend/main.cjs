const { app, BrowserWindow, ipcMain, shell, Notification } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');

let mainWindow;
let backendProcess = null;

// Wait for backend to be ready by polling the health endpoint
function waitForBackend(maxRetries = 30, interval = 1000) {
  return new Promise((resolve, reject) => {
    let retries = 0;
    const check = () => {
      const req = http.get('http://127.0.0.1:8000/api/health', (res) => {
        if (res.statusCode === 200) {
          console.log('[Electron] Backend is ready!');
          resolve();
        } else {
          retry();
        }
      });
      req.on('error', retry);
      req.setTimeout(500, () => { req.destroy(); retry(); });
    };
    const retry = () => {
      retries++;
      if (retries >= maxRetries) {
        reject(new Error('Backend failed to start after ' + maxRetries + ' retries'));
      } else {
        console.log(`[Electron] Waiting for backend... (${retries}/${maxRetries})`);
        setTimeout(check, interval);
      }
    };
    check();
  });
}

function startBackend() {
  if (!app.isPackaged) return Promise.resolve();
  
  return new Promise((resolve, reject) => {
    const backendPath = path.join(process.resourcesPath, 'backend_server');
    if (!fs.existsSync(backendPath)) {
      return reject(new Error('Backend executable not found at: ' + backendPath));
    }
    
    // Make sure backend is executable
    try { fs.chmodSync(backendPath, '755'); } catch(e) {}
    
    console.log('[Electron] Starting backend server from:', backendPath);
    backendProcess = spawn(backendPath, [], {
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    backendProcess.stdout.on('data', (data) => console.log(`[Backend] ${data}`));
    backendProcess.stderr.on('data', (data) => console.error(`[Backend ERR] ${data}`));
    backendProcess.on('error', (err) => {
      console.error('[Electron] Failed to spawn backend:', err);
      reject(err);
    });
    backendProcess.on('exit', (code) => {
      console.log('[Electron] Backend exited with code:', code);
    });

    // Resolve immediately and let waitForBackend do the polling
    resolve();
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: '值班助手 DutyToDo',
    titleBarStyle: 'hidden',
    autoHideMenuBar: true,
    show: false, // Hidden until backend is ready
    backgroundColor: '#001529',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  // Show window only when page is ready
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.show();
  });
}

app.whenReady().then(async () => {
  createWindow();

  try {
    await startBackend();
    if (app.isPackaged) {
      await waitForBackend(40, 500); // Poll every 500ms, up to 20 seconds
    }
    console.log('[Electron] Backend ready, refreshing frontend...');
    if (mainWindow) {
      mainWindow.reload();
    }
  } catch (err) {
    console.error('[Electron] Backend startup failed:', err.message);
    // Still show the window even if backend fails
    if (mainWindow && !mainWindow.isVisible()) {
      mainWindow.show();
    }
  }

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

app.on('will-quit', () => {
  if (backendProcess) {
    try { backendProcess.kill('SIGTERM'); } catch(e) {}
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

