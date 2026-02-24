# MTG Dashboard — Feature Documentation

## Version History

| Version | Date       | Summary                                        |
|---------|------------|------------------------------------------------|
| 1.0.0   | 2025‑01    | Initial release — Sold Orders dashboard        |
| 1.1.0   | 2025‑01    | Bug fixes, ESLint + Jest setup, GitHub push    |
| 1.2.0   | 2025‑07    | Purchases dashboard, trend KPIs, pagination, export, offline Chart.js, chokidar auto-sync, missing-month detection |

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
