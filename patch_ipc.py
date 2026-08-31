import re

with open("frontend/main.cjs", "r") as f:
    content = f.read()

ipc_code = """
// IPC handler for reading local logs (useful when backend is dead)
ipcMain.handle('get-local-logs', async () => {
  const logDir = path.join(app.getPath('home'), '.dutytodo', 'logs');
  const spawnLog = path.join(logDir, 'electron_backend_spawn.log');
  const backendLog = path.join(logDir, 'backend.log');
  
  let result = '=== Electron Spawn Logs ===\\n';
  try {
    if (fs.existsSync(spawnLog)) {
      result += fs.readFileSync(spawnLog, 'utf8').split('\\n').slice(-150).join('\\n');
    } else {
      result += 'No spawn logs found.\\n';
    }
  } catch(e) { result += e.message + '\\n'; }

  result += '\\n\\n=== Backend Application Logs ===\\n';
  try {
    if (fs.existsSync(backendLog)) {
      result += fs.readFileSync(backendLog, 'utf8').split('\\n').slice(-150).join('\\n');
    } else {
      result += 'No backend logs found.\\n';
    }
  } catch(e) { result += e.message + '\\n'; }
  
  return result;
});
"""

# Append before the last line or just at the end
if "ipcMain.handle('get-local-logs'" not in content:
    content += "\n" + ipc_code

with open("frontend/main.cjs", "w") as f:
    f.write(content)

print("Patched main.cjs with IPC handler")
