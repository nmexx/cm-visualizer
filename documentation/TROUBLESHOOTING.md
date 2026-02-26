# Troubleshooting

## Issue 1 — App does not start (`better-sqlite3` native module mismatch)

### Symptom
Electron exits immediately with:
```
Error: The module '...\better-sqlite3\build\Release\better_sqlite3.node'
was compiled against a different Node.js version using NODE_MODULE_VERSION X.
This version of Node.js requires NODE_MODULE_VERSION Y.
```

### Root cause
`better-sqlite3` is a **native module** (C++ addon). It must be compiled against
the Node.js ABI version that will load it at runtime. Electron ships its own
embedded Node, whose ABI version differs from the system Node version. After any
of the following events the compiled binary can be left targeting the wrong runtime:

- Installing or updating `npm` packages (`npm install`)
- Running `electron-builder` (its `install-app-deps` postinstall script rebuilds
  for Electron automatically)
- Switching between running tests (system Node) and running the app (Electron Node)

### Solution
Rebuild `better-sqlite3` for Electron before launching the app:
```powershell
npm run rebuild        # = electron-rebuild -f -w better-sqlite3
```
Then launch normally:
```powershell
npm start
```

> **Note:** After running `npm run rebuild`, Jest tests will fail because the
> binary is now compiled for Electron's Node, not the system Node. Rebuild for
> system Node before running tests:
> ```powershell
> npm rebuild better-sqlite3   # compiles for system Node
> npx jest --no-coverage
> ```
> See `package.json` `scripts.rebuild` for the Electron rebuild shortcut.

---

## Issue 2 — Buttons / IPC calls silently do nothing

### Symptom
The app opens but every button that triggers an IPC call (import, export, load
data, etc.) does nothing. DevTools console shows:
```
Unable to load preload script: ...\preload.js
Error: Cannot find module '../lib/ipcChannels'
Uncaught TypeError: Cannot read properties of undefined (reading 'onUpdateAvailable')
```
`window.mtg` is `undefined` in the renderer.

### Root cause
Two compounding problems introduced when Electron updated past v20:

1. **Sandbox default changed.** Electron 20+ enables the renderer sandbox by
   default. A sandboxed preload script cannot call `require()` to load local
   modules (like `lib/ipcChannels.js`). The preload failed silently in older
   Electron because the sandbox was off; after an Electron update it began
   failing loudly — and `window.mtg` was never exposed, so all IPC calls broke.

2. **Wrong require path in `preload.js`.** The path was `../lib/ipcChannels`,
   which resolves *one directory above the project root* — not inside it. This
   only appeared to work under the old sandbox resolution path; once sandbox mode
   changed the error became visible.

### Solution (applied in v1.8.7)

**`main.js` — explicitly disable sandbox for the preload:**
```js
webPreferences: {
  preload: path.join(__dirname, 'preload.js'),
  contextIsolation: true,   // keep: renderer <-> preload isolation
  nodeIntegration: false,   // keep: renderer has no direct Node access
  sandbox: false,           // preload needs require() to load lib/ipcChannels
},
```

**`preload.js` — fix the require path:**
```js
// Before (wrong — resolves above project root):
const CH = require('../lib/ipcChannels');

// After (correct — resolves relative to project root):
const CH = require('./lib/ipcChannels');
```

### Security note
`sandbox: false` only affects the **preload** script, not the renderer page.
`contextIsolation: true` and `nodeIntegration: false` remain in place, so the
renderer still has no access to Node APIs. This configuration matches the
official Electron recommendation for apps that need a non-sandboxed preload.
