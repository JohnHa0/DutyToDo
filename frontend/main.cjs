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
    const backendDir = path.join(process.resourcesPath, 'backend');
    const vendorDir = path.join(backendDir, 'vendor');
    const mainScript = path.join(backendDir, 'main.py');

    if (!fs.existsSync(mainScript)) {
      return reject(new Error('Backend main.py not found at: ' + mainScript));
    }

    // Find system Python3
    const pythonCandidates = ['python3', 'python3.11', 'python3.10', 'python3.9', 'python'];
    let pythonCmd = 'python3'; // default
    for (const cmd of pythonCandidates) {
      try {
        const result = require('child_process').spawnSync(cmd, ['--version']);
        if (result.status === 0) { pythonCmd = cmd; break; }
      } catch {}
    }

    console.log('[Electron] Launching backend with:', pythonCmd, mainScript);
    console.log('[Electron] Backend dir:', backendDir);
    console.log('[Electron] Vendor dir:', vendorDir);

    const env = {
      ...process.env,
      PYTHONPATH: vendorDir,
      PYTHONDONTWRITEBYTECODE: '1',
    };

    backendProcess = spawn(pythonCmd, [mainScript], {
      cwd: backendDir,
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      env,
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

// Window control handlers
ipcMain.on('window-control', (event, action) => {
  if (!mainWindow) return;
  if (action === 'minimize') mainWindow.minimize();
  else if (action === 'maximize') {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  }
  else if (action === 'close') mainWindow.close();
});



// IPC handler for reading local logs (useful when backend is dead)
ipcMain.handle('get-local-logs', async () => {
  const logDir = path.join(app.getPath('home'), '.dutytodo', 'logs');
  const spawnLog = path.join(logDir, 'electron_backend_spawn.log');
  const backendLog = path.join(logDir, 'backend.log');
  
  let result = '=== Electron Spawn Logs ===\n';
  try {
    if (fs.existsSync(spawnLog)) {
      result += fs.readFileSync(spawnLog, 'utf8').split('\n').slice(-150).join('\n');
    } else {
      result += 'No spawn logs found.\n';
    }
  } catch(e) { result += e.message + '\n'; }

  result += '\n\n=== Backend Application Logs ===\n';
  try {
    if (fs.existsSync(backendLog)) {
      result += fs.readFileSync(backendLog, 'utf8').split('\n').slice(-150).join('\n');
    } else {
      result += 'No backend logs found.\n';
    }
  } catch(e) { result += e.message + '\n'; }
  
  return result;
});
