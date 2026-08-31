import re

with open("frontend/main.cjs", "r") as f:
    content = f.read()

# We need to change the python spawn logic back to spawning the PyInstaller binary,
# but since the current packaged version might be failing due to Python version mismatch,
# let's write an robust startBackend function that handles both vendor (python) and PyInstaller binary,
# and logs everything to a file so the user can see it in the UI.

new_startBackend = """
function startBackend() {
  if (!app.isPackaged) return Promise.resolve();
  
  return new Promise((resolve, reject) => {
    const logDir = path.join(app.getPath('home'), '.dutytodo', 'logs');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    const logFile = path.join(logDir, 'electron_backend_spawn.log');
    const logStream = fs.createWriteStream(logFile, { flags: 'a' });
    
    const log = (msg) => {
      const line = `[${new Date().toISOString()}] ${msg}\\n`;
      console.log(line.trim());
      logStream.write(line);
    };

    log('--- Starting Backend ---');

    // First try to find a PyInstaller binary (if we revert to it later)
    const exeName = process.platform === 'win32' ? 'backend_server.exe' : 'backend_server';
    const pyinstallerPath = path.join(process.resourcesPath, 'backend_server', exeName);
    
    // Then try the vendor approach
    const backendDir = path.join(process.resourcesPath, 'backend');
    const vendorDir = path.join(backendDir, 'vendor');
    const mainScript = path.join(backendDir, 'main.py');

    let cmd = '';
    let args = [];
    let options = { detached: false, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env } };

    if (fs.existsSync(pyinstallerPath)) {
      log('Found PyInstaller binary at: ' + pyinstallerPath);
      try { fs.chmodSync(pyinstallerPath, '755'); } catch(e) { log('chmod error: ' + e); }
      cmd = pyinstallerPath;
      args = [];
    } else if (fs.existsSync(mainScript)) {
      log('Found vendor main.py at: ' + mainScript);
      const pythonCandidates = ['python3.11', 'python3', 'python3.10', 'python3.9', 'python'];
      let pythonCmd = 'python3';
      for (const pc of pythonCandidates) {
        try {
          const result = require('child_process').spawnSync(pc, ['--version']);
          if (result.status === 0) { pythonCmd = pc; break; }
        } catch {}
      }
      log('Using Python command: ' + pythonCmd);
      cmd = pythonCmd;
      args = [mainScript];
      options.cwd = backendDir;
      options.env.PYTHONPATH = vendorDir;
      options.env.PYTHONDONTWRITEBYTECODE = '1';
    } else {
      const err = 'No backend executable or script found!';
      log(err);
      return reject(new Error(err));
    }

    log(`Spawning: ${cmd} ${args.join(' ')}`);
    backendProcess = spawn(cmd, args, options);

    backendProcess.stdout.on('data', (data) => {
      log(`[STDOUT] ${data}`);
    });
    backendProcess.stderr.on('data', (data) => {
      log(`[STDERR] ${data}`);
    });
    backendProcess.on('error', (err) => {
      log(`[SPAWN ERROR] ${err.message}`);
      reject(err);
    });
    backendProcess.on('exit', (code) => {
      log(`[EXIT] Backend exited with code: ${code}`);
    });

    resolve();
  });
}
"""

content = re.sub(r'function startBackend\(\) \{.*?\n\}\n(?=\nfunction createWindow)', new_startBackend, content, flags=re.DOTALL)

with open("frontend/main.cjs", "w") as f:
    f.write(content)

print("Patched main.cjs")
