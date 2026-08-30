import json

with open("frontend/package.json", "r") as f:
    pkg = json.load(f)

pkg["build"] = {
    "appId": "com.dutytodo.app",
    "productName": "值班助手",
    "directories": {
        "output": "dist-electron"
    },
    "linux": {
        "target": ["deb"],
        "category": "Office",
        "icon": "public/icon.png"
    },
    "extraResources": [
        {
            "from": "../backend/dist/backend_server",
            "to": "backend_server"
        }
    ]
}

# The scripts also need to be adjusted for electron-builder config if necessary. 
# But the default electron-builder script just reads the build config.
# "electron:build": "vite build && electron-builder" is already there.

with open("frontend/package.json", "w") as f:
    json.dump(pkg, f, indent=2, ensure_ascii=False)
