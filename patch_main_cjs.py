import re

with open("frontend/main.cjs", "r") as f:
    content = f.read()

# Add child_process import
content = content.replace("const path = require('path');", "const path = require('path');\nconst { spawn } = require('child_process');\nconst fs = require('fs');")

# Add backend spawning logic
spawn_logic = """
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
"""

content = content.replace("function createWindow() {", spawn_logic + "\nfunction createWindow() {")

# Call startBackend in whenReady
content = content.replace("createWindow();", "startBackend();\n  createWindow();", 1)

# Kill backend on quit
quit_logic = """
app.on('will-quit', () => {
  if (backendProcess) {
    backendProcess.kill();
  }
});
"""
content = content + quit_logic

with open("frontend/main.cjs", "w") as f:
    f.write(content)
