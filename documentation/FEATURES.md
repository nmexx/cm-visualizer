# MTG Dashboard — Feature Documentation

## Version History

| Version | Date       | Summary                                        |
|---------|------------|------------------------------------------------|
| 1.0.0   | 2025‑01    | Initial release — Sold Orders dashboard        |
| 1.1.0   | 2025‑01    | Bug fixes, ESLint + Jest setup, GitHub push    |
| 1.2.0   | 2025‑07    | Purchases dashboard, trend KPIs, pagination, export, offline Chart.js, chokidar auto-sync, missing-month detection |
| 1.3.0   | 2025‑07    | P&L view, Inventory, Time-to-sell, drag-drop import, light/dark theme, date presets, filter presets, repeat buyers, Set ROI, foil premium, xlsx export, auto-updater |
| 1.4.0   | 2026‑02    | Separate sold/purchased folders, ManaBox inventory import, Scryfall card hover |
| 1.5.0   | 2026‑07    | Sortable table columns across all 12 data tables |
| 1.6.0   | 2026‑02    | Cardmarket price guide download, inventory file path in settings, market price columns in inventory |
| 1.7.0   | 2026‑02    | Modular architecture refactor: ES module renderer split, IPC constants, migration runner, settingsStore, repository layer, electron.net, timeout + atomic download |
| 1.7.1   | 2026‑02    | Fix: preload sandbox (inline CH constants), add `importFilePath` IPC channel for drag-drop |
| 1.7.2   | 2026‑02    | Fix: purchases dashboard "no data" (wrong SQL aliases), inventory empty-state never dismissed, ManaBox table never shown, missing `foilVsNormal`/`prevSummary`/`avg_card_cost` queries |
| 1.7.3   | 2026‑02    | Fix: Apply/Clear filter buttons unwired, preset modal didn't close, 5 XLSX buttons missing, `exportXlsx` payload mismatch, `profitLoss`→`pnl` rename, add `revenueVsCostByMonth` to analytics |
| 1.7.4   | 2026‑02    | Fix: Orders repeat-buyers panel never shown (missing data source, wrong IDs), purchases dashboard never rendered (5 element ID mismatches between HTML and renderer) |
| 1.7.5   | 2026‑02    | Fix: P&L page always showed empty-state (pnl-empty-state/pnl-dashboard never toggled), pnl-kpi-grid blank, manabox-count/inventory-count elements missing from HTML, no Cancel button in preset modal |
| 1.8.0   | 2026‑02    | IPC reliability overhaul: fix revenueVsCostByMonth always empty (SQL missing date columns), fix IMPORT_INVENTORY_FILE ignoring path arg, fix INSTALL_UPDATE re-downloading instead of installing, RFC-4180 CSV escaping, prepared-statement caching, deduplicated import loops, SettingsStore.getPresets() |
| 1.8.1   | 2026‑02    | Lib bug-fix pass: CRLF CSV parsing in importer.js, skipped→replaced semantics, per-row error isolation, computeSetROI includes sold-only sets, single-pass distribution in computeRepeatBuyers, MAX_FOIL_ROWS constant, parseDelimitedLine extracted to parser.js, zero-quantity preserved in inventory importer |
| 1.8.2   | 2026‑02    | parseFloat_eu corrupted prices ≥€1,000 (dot-thousands separator stripped); migrations DDL deduplicated, migration errors now include id+description, applied migrations logged to console.info; ipcChannels 'use strict' placement fixed, PUSH_CHANNELS export added; preload eliminates duplicate channel list by requiring ipcChannels |

---

## Features in v1.2.0

### 1. Purchases Dashboard

A dedicated **Purchases** tab tracks what you have bought from other Cardmarket sellers.

- Import one or more "Purchased Orders" CSV files (`+ Purchases CSV` button).
- Data is stored in separate `purchases` and `purchase_items` SQLite tables, independently of your sold-orders data.
- **KPI cards**: total purchased orders, total cards bought, total spent (in red), average order value.
- **Spending over Time** line chart — daily cumulative spend.
- **Monthly Spend & Fees** bar chart — merchandise vs trustee-service fees per month.
- **Top Sellers** horizontal bar chart — sellers ranked by amount spent.
- **By Country** and **By Rarity** doughnut charts.
- **Top 20 Purchased Cards** table — ranked by quantity and spend.
- **All Purchases** table — every order with seller, country, article count, merchandise value, total, and trustee fee.
- Export all purchase rows to CSV via the `↓ Export CSV` button.

#### Purchased Orders CSV Format (Cardmarket)

```
OrderID; Username; Name; Street; City; Country; Is Professional; VAT Number;
Date of Purchase; Article Count; Merchandise Value; Shipment Costs;
Trustee Service Fee; Total Value; Currency; Description; Product ID; Localized Product Name
```

> **Note**: column 12 is the *Trustee Service Fee* and column 13 is *Total Value* — these are in reverse order compared to the Sold Orders CSV (where col 12 = Total, col 13 = Commission).

---

### 2. Missing Month Detection

Both the Overview (Sales) and Purchases dashboards display a **warning banner** if any calendar months are absent from your imported data.

- The backend scans the date range between the first and last order and reports every month with no records.
- The banner lists the missing months so you can download and import the corresponding CSV from Cardmarket.
- The banner is hidden when the data is complete.

---

### 3. KPI Trend Indicators

Every KPI card on the Overview page now shows a **▲/▼ trend** compared to the equivalent preceding time period.

- If a date filter is applied, the prior period is the same-length window immediately before the selected range.
- Without a filter, the prior period is the same number of days before the first order in the database.
- Green **▲** = improvement; red **▼** = decline; grey **—** = no prior data.

---

### 4. Client-Side Pagination (Orders Tab)

The Orders table now supports **paginated browsing** (50 rows per page) instead of showing all rows at once.

- `Prev` / `Next` buttons and a page-info counter (e.g. "1–50 of 312").
- A **search box** filters by buyer name, username, country, or order ID across all pages in real time.

---

### 5. Buyer Drill-Down Modal

Clicking any row in the Orders table opens a **modal** with that buyer's full purchase history:

- Summary KPIs: total orders, total articles, total revenue, avg order value.
- A scrollable table of all their orders with dates, order IDs, article counts, merchandise value, and commission.

---

### 6. Condition Doughnut Chart (Cards Tab)

A new **Sold by Condition** doughnut chart breaks down units sold by card condition (NM, EX, GD, LP, PO).

---

### 7. CSV Export

Three export buttons allow you to download data as a `.csv` file:

| Button location | Exported data           |
|-----------------|-------------------------|
| Orders tab      | All filtered orders     |
| Cards tab       | Top-cards revenue table |
| Purchases tab   | All purchase orders     |

---

### 8. Offline Chart.js

Chart.js (v4.4.2) is now bundled locally at `vendor/chart.umd.min.js` instead of being loaded from a CDN. The app works without an internet connection.

---

### 9. Chokidar Auto-Sync

When a **CSV Folder** is configured in Settings, the app automatically detects new `.csv` files using [chokidar](https://github.com/paulmillr/chokidar) and imports them without manual intervention. A toast notification confirms each auto-import.

---

### 10. Parameterized SQL (Security / Correctness)

All SQL `WHERE` clauses in `getStats()` and `getPurchaseStats()` now use `COALESCE(?, column)` parameterized queries instead of string-interpolated date values. This eliminates SQL-injection risk and correctly handles `null` / undefined filter arguments.

---

### 11. Extracted Frontend Assets

`index.html` is now clean, semantic HTML (~260 lines). All CSS is in `styles.css` and all JavaScript is in `renderer.js`. This makes the codebase easier to maintain and enables independent linting / bundling.

---

### 12. Settings Page

A dedicated **Settings** page (⚙️) exposes:

- **CSV Folder** path — browse and persist the auto-sync source folder.
- **Database Path** — read-only display of the SQLite file location.
- **Clear Database** — danger-zone button to wipe all sales and purchase data.
- An informational note about how auto-sync works.

---

## Architecture Overview

```
main.js          — Electron main process; SQLite via better-sqlite3;
                   IPC handlers; chokidar watcher; CSV import logic
preload.js       — contextBridge: exposes window.mtg API to renderer
index.html       — HTML shell; links styles.css + renderer.js
styles.css       — All UI styling (dark MTG theme)
renderer.js      — All frontend logic; Chart.js charts; DOM manipulation
lib/
  parser.js          — CSV parsing utilities (parseCSVLine, parseFloat_eu, …)
  importer.js        — Import Sold Orders CSV → orders + order_items tables
  purchaseImporter.js— Import Purchased Orders CSV → purchases + purchase_items
vendor/
  chart.umd.min.js   — Bundled Chart.js v4.4.2 (offline-capable)
tests/
  importer.test.js          — Tests for lib/importer.js  (21 tests)
  purchaseImporter.test.js  — Tests for lib/purchaseImporter.js (7 tests)
  parser.test.js            — Tests for lib/parser.js (21 tests)
```

## Database Schema

### `orders`
```sql
order_id TEXT PRIMARY KEY, username TEXT, buyer_name TEXT, city TEXT,
country TEXT, is_professional INTEGER, date_of_purchase TEXT,
article_count INTEGER, merchandise_value REAL, shipment_costs REAL,
total_value REAL, commission REAL, currency TEXT, source_file TEXT
```

### `order_items`
```sql
id INTEGER PRIMARY KEY AUTOINCREMENT, order_id TEXT, product_id TEXT,
card_name TEXT, localized_name TEXT, set_name TEXT, collector_num TEXT,
rarity TEXT, condition TEXT, language TEXT, is_foil INTEGER,
quantity INTEGER, price REAL
```

### `purchases`
```sql
order_id TEXT PRIMARY KEY, seller_username TEXT, seller_name TEXT,
city TEXT, country TEXT, is_professional INTEGER, date_of_purchase TEXT,
article_count INTEGER, merchandise_value REAL, shipment_costs REAL,
trustee_fee REAL, total_value REAL, currency TEXT, source_file TEXT
```

### `purchase_items`
```sql
id INTEGER PRIMARY KEY AUTOINCREMENT, order_id TEXT, product_id TEXT,
card_name TEXT, localized_name TEXT, set_name TEXT, collector_num TEXT,
rarity TEXT, condition TEXT, language TEXT, is_foil INTEGER,
quantity INTEGER, price REAL
```

---

## v1.3.0 — Analytics, UX, and Distribution (2025-07)

### 1. P&L / Profit View
A dedicated **P&L** page joins sales and purchases by `card_name + set_name` to produce:
- KPIs: Total Revenue, Total Cost, Total Profit, % of Cards Profitable
- Per-card table: qty sold, revenue, cost, **profit** (green/red), **margin %**
- Implemented in `lib/analytics.js → computeProfitLoss(soldItems, boughtItems)`
- Main process fetches raw rows and delegates to pure function; result serialized to IPC

### 2. Inventory
The **Inventory** page shows current stock (bought − sold):
- KPIs: Cards on Hand, Estimated Portfolio Value, Unique Cards, Avg Buy Price
- Per-card table with `qty_bought`, `qty_sold`, `qty_on_hand`, `avg_buy_price`, `estimated_value`
- Client-side search box (`#inventory-search`) for instant filtering
- Implemented in `lib/analytics.js → computeInventory(boughtItems, soldItems)`

### 3. Time-to-Sell Analysis
Within the P&L page, a secondary table shows **days from first purchase to first sale** for each card:
- `< 14 days` → green badge ("Fast")
- `14–60 days` → amber badge ("Medium")
- `> 60 days` → red badge ("Slow")
- Implemented in `lib/analytics.js → computeTimeToSell(purchaseItems, saleItems)`

### 4. Drag-and-Drop CSV Import
Drop one or more Cardmarket CSV files anywhere on the app window:
- A translucent `#drag-overlay` appears on `dragover`
- On `drop`, Electron's `file.path` is extracted and passed to the existing `importFile` IPC handler
- Non-CSV files are silently filtered; toast shows how many orders were inserted

### 5. Dark/Light Theme Toggle
- A `☀` / `🌙` button in the top bar and in Settings switches between dark (default) and light themes
- Theme stored in `settings` table via `set-theme` IPC handler; restored on startup
- Implemented via CSS custom properties — `[data-theme="light"]` overrides on `:root` variables

### 6. Date Range Presets
Four shortcut buttons (**30d / 90d / 1y / YTD**) above the date filters set the date range automatically and reload all dashboards including analytics.

### 7. Repeat Buyer Analysis
On the Orders page, a new **Repeat Buyers** panel shows:
- KPIs: Unique Buyers, Repeat Buyers, Repeat Buyer %, Repeat Revenue %
- Distribution donut chart: "Bought once / twice / 3+ times"
- Sortable table of buyers by order count and total spend
- Implemented in `lib/analytics.js → computeRepeatBuyers(orders)`

### 8. Set ROI
On the Sets page, a **Set ROI** table cross-references average buy vs average sell price for each set, computing `roi_pct = (avg_sell − avg_buy) / avg_buy × 100`.  
Positive ROI cells are coloured green, negative red.

### 9. Foil Premium Analysis
On the Cards page, a **Foil Premium** section shows, for cards that appear in both foil and non-foil form, `avg_foil_price`, `avg_normal_price`, and `foil_premium_pct`.
- Implemented in `lib/analytics.js → computeFoilPremium(soldItems)`

### 10. xlsx Export
All major tables (Cards, Orders, Purchases, P&L, Inventory) have an **Export xlsx** button powered by [SheetJS (xlsx)](https://sheetjs.com/):
- Pure-JS; no native bindings
- IPC handler `export-xlsx` receives `{ type, rows }`, writes a `.xlsx` to `Downloads`
- Returns `{ ok, path }` for toast confirmation

### 11. Saved Filter Presets
A `+` button next to the date filters opens a modal to name and save the current date range:
- Presets stored in `settings` table with key `preset_<name>`
- A `<select>` dropdown lets you apply any saved preset
- Implemented via IPC handlers: `save-filter-preset`, `get-filter-presets`, `delete-filter-preset`

### 12. Auto-Updater
Uses `electron-updater` with GitHub Releases as the update server:
- `publish.provider = "github"`, `owner = "nmexx"`, `repo = "cm-visualizer"` in `package.json`
- `autoDownload = false`; only enabled when `app.isPackaged`
- A dismissible **update banner** appears when a new release is detected
- Settings page has a **Check for Updates** button with status text
- Wrapped in `try/catch` for graceful fallback in development

---

## Architecture Notes (v1.3.0)

### `lib/analytics.js`
Pure functions with no Electron or SQLite dependency — fully testable with Jest.

| Function | Input | Output |
|---|---|---|
| `computeProfitLoss(soldItems, boughtItems)` | raw DB rows | `[{ card_name, set_name, qty_sold, total_revenue, total_cost, profit, margin_pct }]` |
| `computeInventory(boughtItems, soldItems)` | raw DB rows | `[{ card_name, set_name, qty_bought, qty_sold, qty_on_hand, avg_buy_price, estimated_value }]` |
| `computeRepeatBuyers(orders)` | sale orders | `{ total, repeatCount, repeatPct, repeatRevenuePct, buyers, distribution }` |
| `computeSetROI(soldItems, boughtItems)` | raw DB rows | `[{ set_name, cards_sold, avg_buy_price, avg_sell_price, roi_pct }]` |
| `computeFoilPremium(soldItems)` | sale items | `[{ card_name, avg_normal_price, avg_foil_price, foil_premium_pct }]` |
| `computeTimeToSell(purchaseItems, saleItems)` | raw DB rows | `[{ card_name, set_name, days_to_sell }]` |

### IPC Channel Reference (new in v1.3.0)

| Channel | Direction | Purpose |
|---|---|---|
| `get-analytics` | invoke | Returns `{ profitLoss, inventory, repeatBuyers, setROI, foilPremium, timeToSell }` |
| `export-xlsx` | invoke | Writes xlsx to Downloads, returns `{ ok, path }` |
| `save-filter-preset` | invoke | Stores `{ name, from, to }` in settings table |
| `get-filter-presets` | invoke | Returns array of saved presets |
| `delete-filter-preset` | invoke | Deletes preset by name |
| `set-theme` | invoke | Persists `'dark'` or `'light'` in settings |
| `check-for-update` | invoke | Returns `{ status }` |
| `install-update` | invoke | Calls `autoUpdater.downloadUpdate()` |
| `update-available` | event | Emitted when new version found |
| `update-downloaded` | event | Emitted when download complete |

### Test Coverage (v1.3.0)
- **82 tests** across 4 test files
- `tests/analytics.test.js`: 33 tests covering all 6 analytics functions, including edge cases (empty inputs, negative profit, null margins, sort order, key matching)

---

## v1.4.0 — Separate Folders, ManaBox Inventory & Scryfall Hover (2026-02)

### 1. Separate Folder Paths for Sold and Purchased CSVs
The Settings page now has **two independent folder pickers**:
- **Sold CSV Folder** (`csv_folder_sold`) — watched for Cardmarket Sold Orders CSV exports
- **Purchased CSV Folder** (`csv_folder_purchased`) — watched for Cardmarket Purchased Orders CSV exports

Each folder runs its own chokidar watcher (`startSoldWatcher` / `startPurchasedWatcher`) and fires the appropriate `auto-import` or `auto-import-purchase` IPC event when new files arrive.

**Backward compatibility**: on startup, the app checks `csv_folder_sold` first; if absent, it falls back to the legacy `csv_folder` key for the sold watcher.

New IPC handlers: `set-folder-sold`, `set-folder-purchased`  
New preload channels: `setFolderSold`, `setFolderPurchased`, `onAutoImportPurchase`

---

### 2. ManaBox Inventory Import
A dedicated inventory CSV import path for [ManaBox](https://manabox.app/) exports.

**CSV columns supported**:
```
Name, Set code, Set name, Collector number, Foil, Rarity, Quantity,
ManaBox ID, Scryfall ID, Purchase price, Misprint, Altered,
Condition, Language, Purchase price currency
```
Imported rows are stored in the new **`manabox_inventory`** SQLite table.

**Entry points**:
- Topbar **"+ Inventory"** button
- Inventory page **"+ Import ManaBox CSV"** button
- Drag-and-drop (existing mechanism, CSV files are routed through the appropriate importer)

**Inventory page** has a new *ManaBox Inventory* panel showing all imported cards with:
- Card (hoverable), Set, Set Code, Foil badge, Rarity badge, Qty, Buy Price, Condition, Language
- Client-side search box
- XLSX export button

**Implemented in**: `lib/inventoryImporter.js`  
New IPC handlers: `import-inventory-file`, `get-inventory-list`  
New preload channels: `importInventoryFile`, `getInventoryList`

---

### 3. Scryfall Card Image on Hover
Any card name cell in any table (Top Cards, Top Bought Cards, P&L, Inventory, ManaBox Inventory, Foil Premium, Time-to-Sell) now shows a **card image tooltip** when hovered.

**Implementation**:
- Card name cells are marked with `data-card-name="..."` (and optionally `data-scryfall-id="..."` for ManaBox rows)
- A fixed `#scryfall-tooltip` div is shown on hover after a 300 ms debounce
- **With Scryfall ID** (ManaBox imports): builds the CDN URL directly —  
  `https://cards.scryfall.io/normal/front/{id[0]}/{id[1]}/{id}.jpg` — no API roundtrip
- **Without Scryfall ID** (CM sales/purchase data): calls  
  `https://api.scryfall.com/cards/named?fuzzy={name}` and uses `image_uris.normal`
- Results are cached in a `Map` per session to avoid duplicate requests
- Tooltip is positioned to stay within the viewport; shows a spinner while loading

---

## Architecture Notes (v1.4.0)

### `lib/inventoryImporter.js`
Pure function (no Electron/SQLite dependency) — fully testable with Jest.

| Function | Input | Output |
|---|---|---|
| `importInventoryFile(db, filePath)` | db instance + file path | `{ inserted, skipped }` |
| `parseCSVLine(line)` | raw CSV line string | `string[]` — handles RFC-4180 quoting |

### New DB Table: `manabox_inventory`
```sql
CREATE TABLE IF NOT EXISTS manabox_inventory (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  card_name         TEXT NOT NULL,
  set_code          TEXT, set_name TEXT, collector_num TEXT,
  is_foil           INTEGER DEFAULT 0,
  rarity            TEXT, quantity INTEGER DEFAULT 1,
  manabox_id        TEXT, scryfall_id TEXT,
  purchase_price    REAL, condition TEXT, language TEXT,
  purchase_currency TEXT, source_file TEXT
);
```

### IPC Channel Reference (new in v1.4.0)

| Channel | Direction | Purpose |
|---|---|---|
| `set-folder-sold` | invoke | Opens folder dialog, saves `csv_folder_sold`, starts sold watcher |
| `set-folder-purchased` | invoke | Opens folder dialog, saves `csv_folder_purchased`, starts purchased watcher |
| `import-inventory-file` | invoke | Opens CSV dialog, imports ManaBox inventory rows |
| `get-inventory-list` | invoke | Returns all rows from `manabox_inventory` |
| `auto-import-purchase` | event | Fired by purchased folder watcher on new file |

### Test Coverage (v1.4.0)
- **99 tests** across 5 test files
- `tests/inventoryImporter.test.js`: 17 tests covering `parseCSVLine` (5) and `importInventoryFile` (12)
  - Edge cases: foil/normal detection, quoted card names with commas, duplicate IGNORE semantics, missing required columns, empty quantity defaults, source_file basename recording

### Version History Update

| Version | Date       | Summary |
|---------|------------|---------|
| 1.4.0   | 2026-02    | Separate sold/purchased folders, ManaBox inventory import, Scryfall card hover |

---

## Features in v1.5.0

### 1. Sortable Table Columns

All **12 data tables** now have clickable column headers that sort rows in ascending or descending order.

#### Supported Tables

| Table                | Sortable Columns |
|----------------------|-----------------|
| Top Cards (Sales)    | Card Name, Set, Rarity, Qty Sold, Revenue |
| Sets (Sales)         | Set, Cards Sold, Revenue |
| Orders               | Order ID, Date, Buyer, Country, Articles, Merchandise, Total, Commission |
| Top Bought Cards     | Card Name, Set, Rarity, Qty Bought, Spent, Orders |
| All Purchases        | Order ID, Date, Seller, Country, Articles, Merchandise, Total, Trustee Fee |
| P&L                  | Card, Set, Sold, Revenue, Cost, Profit, Margin |
| Time to Sell         | Card, Set, Days to Sell |
| Inventory            | Card, Set, Bought, Sold, On Hand, Avg Buy, Est. Value |
| Repeat Buyers        | Buyer, Orders, Total Spent, Avg Order |
| Set ROI              | Set, Bought, Avg Buy, Avg Sell, ROI |
| Foil Premium         | Card, Normal Avg, Foil Avg, Premium |
| ManaBox Inventory    | Card, Set, Code, Foil, Rarity, Qty, Buy Price, Cond, Lang |

#### Behaviour

- **Click** a column header once → sort ascending (▲).
- **Click again** → sort descending (▼).
- **Unsortable columns** (rank `#` in top-card tables) show no indicator.
- All columns default to **not sorted** on every data reload (filter apply, import, auto-sync).
- **Orders table**: sort persists across search and pagination; resets on data reload.
- **Inventory & ManaBox tables**: sort and text-search compose correctly — sorting is applied first, search filters on top of the sorted result.

#### Interaction With Other Features

| Feature | Behaviour with sort |
|---|---|
| Orders search box | Searches within the current sort order |
| Orders pagination | Paginates the sorted + filtered result |
| Inventory search box | Filters within the current sort order |
| ManaBox search box | Filters within the current sort order |
| Date filter / Apply | Resets all sort indicators, re-renders from scratch |

---

## Architecture Notes (v1.5.0)

### `lib/sortUtils.js`

Pure sort helper with no DOM or Electron dependencies — fully testable.

| Export | Signature | Description |
|---|---|---|
| `sortArray` | `(arr, key, type, dir) → arr` | Returns a sorted shallow copy of `arr` by property `key`. `type` is `'num'` or `'str'`; `dir` is `'asc'` or `'desc'`. Nulls / undefined values are treated as `0` for numeric or `''` for string. |

### `SortableTable` class (renderer.js)

Client-side class that wires column headers to a per-table sort state.

**Constructor** `(tableId, cols, renderFn, getDataFn)`

| Arg | Type | Description |
|---|---|---|
| `tableId` | `string` | DOM id of the `<table>` |
| `cols` | `Array<{key,type}\|null>` | One entry per `<th>`. `null` = not sortable (e.g. rank column) |
| `renderFn` | `(sortedArr) => void` | Re-renders the tbody with the provided sorted array |
| `getDataFn` | `() => Array` | Returns the current canonical (unsorted) data source |

**Methods**: `reset()` — clears sort indicators and internal state (called on data reload).

### Per-Table Row Render Functions

Each table now has a dedicated `renderXxxRows(arr)` function that writes only the `<tbody>` content. The larger `renderXxx(data)` functions (which handle visibility, KPI cards, charts) call these helpers, making it easy for the sort logic to re-render only the rows without re-computing KPIs or charts.

### Test Coverage (v1.5.0)

- **124 tests** across 6 test files (+25 new)
- `tests/sorting.test.js`: 25 tests covering all `sortArray` behaviours
  - Numeric asc/desc, string asc/desc, null handling, immutability, numeric-string parsing


---

## Features in v1.6.0

### 1. Cardmarket Price Guide Download

The app can download the official Cardmarket price guide JSON and use it to display **current market prices** alongside your purchase cost in the Inventory table.

#### UI
- **Settings → Market Prices** section shows the last downloaded timestamp and a **↓ Download Now** button.
- Prices refresh immediately in the Inventory table after every download.
- On startup, the cached price guide is loaded automatically from disk.

#### Price Guide Source

`
https://downloads.s3.cardmarket.com/productCatalog/priceGuide/price_guide_1.json
`

This is an official, publicly available Cardmarket export (~3 MB, ~121 k entries, updated daily). Saved to `{userData}/price_guide.json`.

#### Price fields used per product

| Field | Description |
|---|---|
| `trend` | 7-day trend price (primary for normal cards) |
| `avg` | 30-day average (fallback) |
| `trend-foil` | Foil trend price |
| `avg-foil` | Foil average (fallback for foil) |

#### Linking prices to inventory
Each row in `purchase_items` stores the Cardmarket `product_id`. `computeInventory` now propagates this to the result so the main process can annotate each inventory row with:

| Field | Description |
|---|---|
| `market_price` | Current market trend/avg price per copy |
| `market_price_foil` | Foil trend/avg price |
| `market_value` | qty_on_hand x market_price |

Rows without a known `product_id` show `—` in the market-price columns.

#### Inventory table new columns

| Column | Description |
|---|---|
| **Mkt Price** | Current market trend price per copy |
| **Mkt Value** | Total current market value (on-hand × Mkt Price), highlighted gold |

Both columns are fully sortable.

---

### 2. Inventory File Path in Settings

A new **Inventory File (ManaBox CSV)** row in **Settings → Data Import** stores a persistent path to your ManaBox inventory export.

- Click **Browse** to pick a CSV file; the file is imported immediately and the path is persisted as `inventory_file_path` in the settings table.
- On every app startup the saved path is automatically re-imported.
- The filename is displayed next to the Browse button for quick reference.

---

## Architecture Notes (v1.6.0)

### `lib/analytics.js` — computeInventory update

`computeInventory(boughtItems, soldItems)` now accepts an optional `product_id` on each bought row, latches the first non-null value seen per `card_name + set_name` key, and includes `product_id` in every result row (null if unavailable).

### `main.js` additions

| Symbol | Purpose |
|---|---|
| `priceGuideCache` | `Map<number, PriceEntry>` — in-memory lookup, loaded on startup |
| `loadPriceGuide()` | Reads `price_guide.json` from userData, populates `priceGuideCache` |
| `downloadToFile(url, dest)` | HTTPS download helper with redirect following |
| `enrichInventoryWithMarketPrices(inv)` | Annotates inventory rows with market prices |
| IPC `download-price-guide` | Downloads, parses, caches, saves timestamp → `{ok, count, updatedAt}` |
| IPC `set-inventory-file` | File dialog, saves `inventory_file_path`, imports → `{path, inserted, skipped}` |

### Test Coverage (v1.6.0)

- **114 tests** across 6 test files (+3 new)
- `tests/analytics.test.js`: 3 new tests for `computeInventory` product_id handling
  - product_id propagation, first-valid-id latching, null when absent

---

## Features in v1.7.0

### 1. Modular Architecture Refactor

v1.7.0 is a structural release with no user-visible behaviour changes. The
codebase was reorganised for long-term maintainability.

#### Main Process Refactoring

`main.js` was reduced from ~915 lines to ~260 lines by extracting all business
logic into focused modules:

| New module | Responsibility |
|---|---|
| `lib/ipcChannels.js` | Frozen constant map of every IPC channel name — single source of truth used by both `main.js` and `preload.js` |
| `lib/settingsStore.js` | `SettingsStore` class — typed read/write wrapper over the SQLite `settings` table with built-in defaults |
| `lib/migrations.js` | `runMigrations(db)` — applies numbered schema migrations once per database, idempotent |
| `lib/priceGuide.js` | Moved price-guide download, cache loading, and inventory enrichment out of `main.js` |
| `lib/repositories/salesRepo.js` | All SQL queries for the Sales dashboard |
| `lib/repositories/purchasesRepo.js` | All SQL queries for the Purchases dashboard |
| `ipc/fileHandlers.js` | IPC handlers for import, export, and folder management |
| `ipc/settingsHandlers.js` | IPC handlers for settings, filter presets, db-clear, auto-updater |
| `ipc/analyticsHandlers.js` | IPC handlers for analytics queries and price guide download |

Each `ipc/` module exports a single `register(ctx)` function, where `ctx` is a
dependency-injection object. This avoids module-level globals and makes handlers
independently testable.

#### Renderer ES Module Split

`renderer.js` was reduced from ~1 427 lines to ~40 lines. The monolith was
split into 17 focused ES modules under `renderer/`:

| Module | Responsibility |
|---|---|
| `renderer/state.js` | Shared mutable state singleton |
| `renderer/utils.js` | Formatting helpers, toast, showLoading, buildFilters |
| `renderer/charts.js` | Chart.js wrapper functions |
| `renderer/sortable.js` | `sortArray()` + `SortableTable` class |
| `renderer/tables.js` | All `renderXxxRows` functions and `SortableTable` instances |
| `renderer/sales.js` | Sales tab: `loadData`, `renderDashboard` |
| `renderer/purchases.js` | Purchases tab: `loadPurchaseData`, `renderPurchases` |
| `renderer/analytics.js` | Analytics tab: `loadAnalyticsData`, `renderAnalytics` |
| `renderer/manabox.js` | Manabox tab: `loadManaboxInventory` |
| `renderer/settings.js` | Settings tab + app `init()` |
| `renderer/features/theme.js` | Theme switching |
| `renderer/features/dragdrop.js` | Drag-and-drop CSV import |
| `renderer/features/datePresets.js` | Date range preset buttons |
| `renderer/features/filterPresets.js` | Saved filter presets |
| `renderer/features/autoUpdate.js` | Auto-update UI |
| `renderer/features/scryfall.js` | Scryfall card image tooltip |

`index.html` now loads `renderer.js` with `type="module"` for native ES module
support without a bundler.

### 2. electron.net for Price Guide Download

`lib/priceGuide.js` now uses `electron.net.fetch()` instead of Node's `https`
module. This provides:

- **System proxy support** — respects OS-level proxy settings
- **OS certificate store** — works in corporate environments with custom CAs
- **60-second timeout** — `AbortController` prevents indefinite hangs
- **Atomic writes** — downloads to `.tmp` then `renameSync`, preventing partial-write corruption

### 3. Database Migrations

`lib/migrations.js` introduces a `schema_version` table and an ordered migration
runner. Migrations are applied exactly once and the system is idempotent —
running `runMigrations(db)` multiple times is safe.

### 4. Typed Settings Store

`lib/settingsStore.js` replaces scattered `INSERT OR REPLACE INTO settings`
calls with a single `SettingsStore` class that handles JSON serialisation,
typed defaults, and a clean `get/set/delete/getAll` API.

### 5. Repository Layer

`lib/repositories/salesRepo.js` and `purchasesRepo.js` are pure functions that
accept a `db` instance. This makes SQL queries independently testable without
starting Electron.

### Architecture Notes (v1.7.0)

See [ARCHITECTURE.md](./ARCHITECTURE.md) for a full description of the module
structure, dependency graph, IPC pattern, migration runner, and settings store.

### Test Coverage (v1.7.0)

- New: `tests/settingsStore.test.js` — 8 tests
- New: `tests/migrations.test.js` — 5 tests
- All existing tests continue to pass

---

## Bug Fixes in v1.7.1

### 1. Preload sandbox — buttons did nothing after build

Electron 20+ enables `sandbox: true` for renderer processes by default.
Inside a sandboxed preload, `require()` for any relative local file fails
silently. `require('./lib/ipcChannels')` returned `undefined`, so
`contextBridge.exposeInMainWorld` exposed an object full of `undefined`
functions — every button call to `window.mtg.*` threw `TypeError`.

**Fix**: removed the `require` call; all 29 channel name strings are now
inlined as a `const CH = { ... }` literal directly in `preload.js`, with a
comment requiring manual sync with `lib/ipcChannels.js`.

### 2. `importFilePath` IPC channel (drag-drop)

Drag-and-drop CSV import needed to pass a known file path to the main process
without opening a system dialog. Added `IMPORT_FILE_PATH` channel end-to-end:
`lib/ipcChannels.js`, `preload.js` (inline CH), and `ipc/fileHandlers.js`.

---

## Bug Fixes in v1.7.2

### 1. Purchases dashboard showed "no purchase data"

`purchasesRepo.getPurchaseStats` returned SQL column aliases that didn't match
the renderer's expected field names:

| Was (SQL alias) | Expected by renderer |
|---|---|
| `total_orders` | `total_purchases` |
| `total_articles` | `total_cards` |
| `avg_order_value` | `avg_purchase_value` |
| `spent` | `amount_spent` (all money queries) |
| `topSellers` (return key) | `bySeller` |

Because `summary.total_purchases` was `undefined`, `hasData` was always
`false` and the empty-state was permanently shown.

**Also added** missing queries: `foilVsNormal` (foil doughnut chart),
`prevSummary` (trend arrows), and `avg_card_cost` (per-item cost KPI).

### 2. Inventory page showed "📦 NO INVENTORY" and no stats

Three separate issues on the Inventory page:

- `analyticsHandlers.js` returned `inventory` as a bare array; `renderInventory`
  guards `!inv.items`, so it always returned early. **Fix**: wrapped as
  `{ items, totalValue }`.
- `renderInventory` never toggled `#inventory-empty-state` / `#inventory-dashboard`.
  **Fix**: added visibility toggle and a 5-KPI grid (Unique Cards, Total on Hand,
  Total Cost, Est. Value, Mkt Value).
- `renderManaboxRows` never showed `#manabox-table-wrap` (default `display:none`).
  **Fix**: added toggle of `#manabox-empty` / `#manabox-table-wrap` based on
  row count.

---

## Bug Fixes in v1.7.3

### 1. Apply / Clear filter buttons had no effect

`btn-apply-filter` and `btn-clear-filter` were present in `index.html` but their
`addEventListener` calls were never migrated from `renderer.legacy.js` to the
modular renderer. **Fix**: added both handlers to `renderer/features/datePresets.js`
alongside the existing preset-button handler, sharing a `reloadAll()` helper.

### 2. Preset modal didn't close after saving

The confirm handler (`btn-confirm-save-preset`) awaited `saveFilterPreset`
without a `try/finally` — any IPC error prevented `classList.remove('show')`.
Additionally, the × button (`preset-modal-close`) and backdrop click had no
listeners at all.

**Fix**: extracted `closePresetModal()` helper; placed `closePresetModal()` in
a `finally` block; added listeners for the × button and backdrop click.

### 3. Five XLSX export buttons had no listeners

`btn-export-{orders,cards,purchases,pnl,inventory}-xlsx` existed in `index.html`
but were never wired in the modular renderer. Added handlers in the respective
tab modules, each passing `{ type, rows }` with the current in-memory data from
`state`.

### 4. `exportXlsx` payload mismatch

Three existing calls (`btn-export-pnl`, `btn-export-inventory`, `btn-export-manabox-xlsx`)
called `window.mtg.exportXlsx('pnl')` etc. with a bare string, but the
`EXPORT_XLSX` handler destructures `{ type, rows }`. All three were updated to
pass the correct object payload.

### 5. `EXPORT_CSV` extended to accept computed rows

P&L and Inventory data is computed in memory — there are no SQL queries for
them in `fileHandlers.js`. `EXPORT_CSV` was updated to accept either a bare
type string (runs a DB query) or `{ type, rows }` (writes `rows` directly to
the file).

### 6. `profitLoss` → `pnl` rename (analytics key mismatch)

`analyticsHandlers.js` returned `profitLoss` but `renderAnalytics` read `d.pnl`
— the P&L table was always empty. Renamed the return key to `pnl`.

### 7. `revenueVsCostByMonth` added to analytics

`renderAnalytics` rendered a Revenue vs Cost bar chart from
`d.revenueVsCostByMonth` but the handler never computed it. Added aggregation
grouped by month from `soldItems` / `boughtItems`.

### 8. `inventory-search` static listener

The inventory search was bound dynamically inside `renderInventory()`, stacking
a new listener on every data refresh. Replaced with a single static
`addEventListener` at module load in `analytics.js`.

---

## Bug Fixes in v1.7.4

### 1. Orders — Repeat-Buyers panel never shown

Three overlapping causes:

- `GET_STATS` (`getSalesStats`) did not include `repeatBuyers` — only `GET_ANALYTICS`
  did. The Orders page calls `GET_STATS`, so `d.repeatBuyers` was always
  `undefined`. **Fix**: the `GET_STATS` handler now augments the `getSalesStats`
  result with `computeRepeatBuyers(stats.allOrders)` before returning.

- `renderDashboard` in `sales.js` never touched `repeat-buyers-panel` (default
  `display:none`). **Fix**: added a repeat-buyers render block at the end of
  `renderDashboard` — shows/hides the panel, fills the 4-KPI grid
  (`repeat-buyers-kpis`), draws the `chart-buyer-distribution` doughnut, and
  calls `renderRepeatBuyersRows(rb.topRepeats)`.

- `renderRepeatBuyersRows` in `tables.js` used wrong field names: `b.buyer`
  (→ `b.buyer_name || b.username`), `b.total_spent` (→ `b.total_revenue`),
  `b.avg_order_value` (→ computed `total_revenue / order_count`). All three
  rendered as `undefined`.

- `renderRepeatBuyers` in `analytics.js` called `renderRepeatBuyersRows(rb)`,
  passing the full object instead of `rb.topRepeats` (an array), causing a
  `TypeError` that silently aborted the rest of `renderAnalytics`. **Fix**:
  changed to `renderRepeatBuyersRows(rb?.topRepeats || [])`.

### 2. Purchases dashboard never shown

All five element IDs used in `purchases.js` did not match the actual IDs in
`index.html`. Both the empty-state and the dashboard content divs were never
toggled, so the Purchases page appeared completely blank regardless of import
state.

| Was (renderer) | Is (HTML) |
|---|---|
| `empty-state-purchases` | `purchase-empty-state` |
| `purchases-content` | `purchase-dashboard` |
| `kpi-grid-purchases` | `purchase-kpi-grid` |
| `chart-purchases-monthly` | `chart-spend-monthly` |
| `chart-purchase-sellers` | `chart-top-sellers` |

**Also added** two previously un-rendered charts:
- `chart-spend-time` — line chart of daily spend from `spendByDay`
- `chart-purchase-rarity` — doughnut of spend by rarity from `byRarity`

---

## Bug Fixes in v1.7.5

The same root cause as previous patches — element IDs in the renderer that didn't
match HTML, or renderer logic that forgot to toggle visibility.

### 1. P&L / Analytics page always showed "No Cross Data Yet"

`renderAnalytics` never toggled `pnl-empty-state` / `pnl-dashboard`.
`pnl-dashboard` defaulted to `display:none` and was never shown regardless of
whether data was present.

**Fix**: added `hasData` check at the top of `renderAnalytics` using
`(d.pnl?.length > 0) || (d.revenueVsCostByMonth?.length > 0)`, toggling both
elements with the same show/hide pattern used by all other pages.

### 2. `pnl-kpi-grid` never populated

`index.html` has a `<div class="kpi-grid" id="pnl-kpi-grid">` at the top of the
P&L dashboard but no renderer code wrote to it.

**Fix**: after `renderPnlRows`, `d.pnl` is reduced to four KPIs — Total Revenue,
Total Cost, Total Profit, and Avg Margin — written to `pnl-kpi-grid`.

### 3. `manabox-count` element missing from HTML

`manabox.js` wrote `${n} cards` to `manabox-count` via an `if (el)` guard.
The element didn't exist; the card count was silently discarded.

**Fix**: added `<span id="manabox-count">` inline in the ManaBox panel title.

### 4. `inventory-count` element missing from HTML

`analytics.js` wrote `${n} cards · €x total value` to `inventory-count` via
an `if (el)` guard. The element didn't exist.

**Fix**: added `<div id="inventory-count">` below `inventory-kpi-grid` in the
inventory page section.

### 5. No Cancel button in preset modal

`filterPresets.js` wired `btn-cancel-save-preset` with `?.addEventListener`
but the button didn't exist in the HTML. The only close paths were the × button
and backdrop click (added in v1.7.3).

**Fix**: added a Cancel button with `id="btn-cancel-save-preset"` alongside the
Save Preset button inside the modal.

---

## IPC Reliability Overhaul in v1.8.0

Nine issues — three runtime bugs and six code-quality problems — discovered
through a targeted audit of the three IPC handler files.

### Bug 1: `revenueVsCostByMonth` always returned an empty array

The SQL queries in `analyticsHandlers.js` that build `soldItems` and
`boughtItems` did not `SELECT` the date columns (`date_of_purchase`,
`date_of_sale`). The downstream grouping code therefore found no dates and
produced an empty result, so the Revenue vs Cost chart was permanently blank.

**Fix**: added `o.date_of_purchase AS date_of_sale` to the sold-items query and
`p.date_of_purchase` to the purchased-items query.

### Bug 2: `IMPORT_INVENTORY_FILE` silently ignored the renderer-supplied path

The IPC handler signature was `async () =>`, discarding Electron's event
argument and the `filePath` passed by the renderer. Every call unconditionally
opened a file-picker dialog, making it impossible to import an inventory file
programmatically (e.g. on startup from a saved settings path).

**Fix**: changed signature to `async (_, filePath)`. When `filePath` is
provided the file is imported directly; otherwise the dialog is shown.

### Bug 3: `INSTALL_UPDATE` downloaded the update a second time instead of installing

`INSTALL_UPDATE` called `autoUpdater.downloadUpdate()` unconditionally. After
the initial download the event `update-downloaded` fires, but the handler never
checked that state — so clicking Install would start another download rather
than calling `quitAndInstall()`.

**Fix**: introduced an `updateDownloaded` flag. `autoUpdater.on('update-downloaded')`
sets the flag to `true`. The handler now calls `quitAndInstall(false, true)`
when the flag is set, and `downloadUpdate()` only on the first invocation.

### Code Quality 4: `require('electron').app` inside an IPC handler

The price-guide path was built with `require('electron').app.getPath(...)` inline
inside the handler body, causing a fresh `require` call on every invocation.

**Fix**: `app` is now destructured from `require('electron')` at the top of the
module alongside the other Electron imports.

### Code Quality 5: Prepared statements compiled on every `GET_ANALYTICS` call

All five SQL statements in `GET_ANALYTICS` were created with `db.prepare()`
inside the handler body, so SQLite compiled them afresh on every IPC call.

**Fix**: all five statements are now compiled once inside `register()` (module
initialisation) and referenced by closure in the handler.

### Code Quality 6: Duplicate import-loop boilerplate in four handlers

The pattern `for (const fp of filePaths) { try { … } catch (e) { … } }` was
copy-pasted into `IMPORT_FOLDER`, `IMPORT_FILE`, `IMPORT_PURCHASE_FILE`, and
`IMPORT_INVENTORY_FILE`.

**Fix**: extracted a shared `importFiles(filePaths, importFn)` helper at the top
of `fileHandlers.js`. All four handlers now delegate to it.

### Code Quality 7: CSV export values not RFC-4180 escaped

The CSV export replaced semicolons with a blank string but did not quote values
or escape internal double-quotes, producing malformed CSV for values that
contained commas, quotes, or newlines.

**Fix**: added a `csvCell(v)` helper that wraps every value in double-quotes and
doubles any internal double-quote characters (`"` → `""`), conforming to
RFC 4180.

### Code Quality 8: `GET_FILTER_PRESETS` bypassed `SettingsStore`, queried the DB directly

The handler built its own SQL query with `db.prepare(...)` instead of going
through the established `SettingsStore` abstraction, creating a second path
for reading presets that could diverge from the store's behaviour.

**Fix**: `GET_FILTER_PRESETS` now calls `settings.getPresets()`, keeping all
settings I/O behind the store interface.

### Code Quality 9: `SettingsStore.getPresets()` did not exist

The above fix required adding the method. The constructor also lacked
`this._db = db`, making ad-hoc `prepare()` calls inside methods impossible.

**Fix**: added `this._db = db` as the first line of the constructor, and
implemented `getPresets()` which returns all keys matching `preset_%` as an
array of `{ name, from, to }` objects.