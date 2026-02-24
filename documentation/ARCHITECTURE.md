# cm-visualizer — Architecture

> Last updated: v1.7.0

## Overview

cm-visualizer is an Electron desktop application that analyses Cardmarket sales
and purchase data stored in a local SQLite database. The architecture was
significantly refactored in v1.7.0, splitting the original monolithic files into
focused, independently-testable modules.

---

## Directory Structure

```
cm-visualizer/
├── main.js                   ← slim orchestrator (~260 lines)
├── preload.js                ← contextBridge API surface
├── renderer.js               ← ES module entry point (~40 lines)
├── index.html
│
├── lib/                      ← reusable, Electron-agnostic business logic
│   ├── ipcChannels.js        ← frozen constant map of all IPC channel names
│   ├── settingsStore.js      ← typed SQLite settings wrapper (class)
│   ├── migrations.js         ← DB schema migration runner
│   ├── priceGuide.js         ← Cardmarket price guide download & cache
│   ├── parser.js             ← CSV parsing utilities
│   └── repositories/
│       ├── salesRepo.js      ← all SQL for the Sales dashboard
│       └── purchasesRepo.js  ← all SQL for the Purchases dashboard
│
├── ipc/                      ← main-process IPC handler modules
│   ├── fileHandlers.js       ← import/export channels
│   ├── settingsHandlers.js   ← settings, presets, db-clear, updater
│   └── analyticsHandlers.js  ← analytics queries and price guide
│
└── renderer/                 ← renderer ES modules
    ├── state.js              ← shared mutable state singleton
    ├── utils.js              ← formatting, toasts, filter helpers
    ├── charts.js             ← Chart.js wrappers
    ├── sortable.js           ← sortArray() + SortableTable class
    ├── tables.js             ← renderXxxRows() + SortableTable instances
    ├── sales.js              ← Sales tab: loadData, renderDashboard
    ├── purchases.js          ← Purchases tab: loadPurchaseData, renderPurchases
    ├── analytics.js          ← Analytics tab: loadAnalyticsData, renderAnalytics
    ├── manabox.js            ← Manabox tab: loadManaboxInventory
    ├── settings.js           ← Settings tab + app init()
    └── features/
        ├── theme.js          ← applyTheme, toggle handlers
        ├── dragdrop.js       ← drag-and-drop CSV import
        ├── datePresets.js    ← date range preset buttons
        ├── filterPresets.js  ← saved filter presets (save/load/delete)
        ├── autoUpdate.js     ← auto-update banner + install/check handlers
        └── scryfall.js       ← card image tooltip (Scryfall API + CDN cache)
```

---

## Main Process (`main.js`)

`main.js` is a slim orchestrator. It:

1. Creates the Electron `BrowserWindow`
2. Opens (or creates) the SQLite database via `better-sqlite3`
3. Runs `SettingsStore` and `runMigrations`
4. Builds a **context object** (see below) and passes it to each IPC handler
   module via `register(ctx)`
5. Sets up the auto-updater

### Context Object

```js
ctx = {
  db,                           // better-sqlite3 Database instance
  dbPath,                       // absolute path to the DB file
  settings,                     // SettingsStore instance
  priceGuideCache,              // { [productId]: { low, trend, ... } }
  priceGuide: { path: null },   // mutable ref so handlers read up-to-date path
  autoUpdater,                  // electron-updater AutoUpdater
  getMainWindow: () => mainWindow,
  importCSVFileWithDB,
  importPurchasedCSVFileWithDB,
  importInventoryFileWithDB,
  startSoldWatcher,
  startPurchasedWatcher,
}
```

---

## IPC Layer (`ipc/`)

Each handler module exports a single `register(ctx)` function. This pattern:

- Avoids module-level globals and stale closures
- Makes handler modules independently importable (useful for testing)
- Keeps each module focused on a single concern

| Module                 | Channels covered |
|------------------------|-----------------|
| `fileHandlers.js`      | SELECT_FOLDER, IMPORT_FOLDER, IMPORT_FILE, SET_FOLDER_SOLD, IMPORT_PURCHASE_FILE, IMPORT_PURCHASE_FOLDER, SET_FOLDER_PURCHASED, IMPORT_INVENTORY_FILE, SET_INVENTORY_FILE, GET_INVENTORY_LIST, EXPORT_CSV, EXPORT_XLSX |
| `settingsHandlers.js`  | GET_SETTINGS, GET_DB_PATH, SET_THEME, SAVE_FILTER_PRESET, GET_FILTER_PRESETS, DELETE_FILTER_PRESET, CLEAR_DATABASE, CHECK_FOR_UPDATE, INSTALL_UPDATE |
| `analyticsHandlers.js` | GET_STATS, GET_PURCHASE_STATS, GET_ANALYTICS, DOWNLOAD_PRICE_GUIDE |

---

## IPC Channel Constants (`lib/ipcChannels.js`)

All channel name strings are defined exactly once as a frozen `Object.freeze({})`
export. Both `main.js` (`.handle`) and `preload.js` (`.invoke` / `.on`) import
this object, eliminating typo-related bugs.

---

## Database Layer

### Migrations (`lib/migrations.js`)

`runMigrations(db)` bootstraps a `schema_version` table and applies an ordered
array of migrations exactly once. Each migration has a numeric `id` — if the id
is already in `schema_version`, the migration is skipped. Migrations run inside
a transaction for atomicity.

Current migrations:

| ID | Description |
|----|-------------|
| 1  | Create `schema_version` table (bootstrap) |
| 2  | Add `source_file` column to `purchases` |
| 3  | Add `product_id` column to `purchase_items` |

### Settings Store (`lib/settingsStore.js`)

`SettingsStore` wraps the SQLite `settings` key/value table with typed defaults.
Values are JSON-serialised so booleans and numbers round-trip correctly.

```js
const store = new SettingsStore(db);
store.get('theme');               // → 'dark'  (default)
store.set('theme', 'light');
store.getAll();                   // → { theme: 'light', csv_folder_sold: null, ... }
```

### Repositories (`lib/repositories/`)

Pure functions that accept a `db` instance and return plain JS objects. They
contain no Electron imports and can be tested with an in-memory database.

- `salesRepo.getSalesStats(db, filters)` — all metrics for the Sales dashboard
- `purchasesRepo.getPurchaseStats(db, filters)` — all metrics for the Purchases dashboard

---

## Price Guide (`lib/priceGuide.js`)

Downloads the Cardmarket price guide using `electron.net.fetch` instead of
Node's `https` module. Benefits:

- **Proxy support**: respects the system proxy configured in the OS
- **OS certificate store**: works inside corporate environments with custom CAs
- **Timeout**: 60-second `AbortController` prevents indefinite hangs
- **Atomic write**: downloads to a `.tmp` file, then `fs.renameSync` ensures no
  partial-write corruption if the process is killed mid-download

---

## Renderer ES Modules

`renderer.js` is now a ~40-line ES module entry point. The `<script>` tag in
`index.html` uses `type="module"`, which ensures:

- Scripts are deferred by default (DOM is ready before any module executes)
- Native `import`/`export` syntax works without a bundler
- Each module loads exactly once regardless of how many other modules import it

### Module Dependency Graph

```
state.js ← (leaf, no local imports)
utils.js ← state.js
charts.js ← state.js, utils.js
sortable.js ← (leaf)
tables.js ← state.js, utils.js, sortable.js
sales.js ← state.js, utils.js, charts.js, tables.js
purchases.js ← state.js, utils.js, charts.js, tables.js
analytics.js ← state.js, utils.js, charts.js, tables.js
manabox.js ← state.js, utils.js, tables.js
features/* ← utils.js, one or more tab modules
settings.js ← all tab modules, all features
renderer.js ← settings.js (+ all via transitive imports)
```

No circular dependencies.

### Shared State

`renderer/state.js` exports a single mutable object and `PAGE_SIZE`. All modules
that need to read or write cross-cutting state import this object directly.

---

## Testing

Tests live in `tests/` and use **Jest** with `better-sqlite3` in-memory
databases for DB-related tests.

```
tests/
├── settingsStore.test.js   ← SettingsStore get/set/delete/getAll + defaults
├── migrations.test.js      ← runMigrations idempotency + column creation
├── ...                     ← existing tests unchanged
```

Run all tests:

```bash
npm test
```

---

## Versioning

Version string is kept in `package.json` and exposed to the renderer via
`window.mtg.getSettings()` (the main process includes `version` from
`package.json` in the settings response).
