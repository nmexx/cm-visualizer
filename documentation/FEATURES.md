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
