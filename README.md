# MTG Sales Dashboard

A desktop app for analysing your Cardmarket sales data. Dark, fast, local-first.

## Requirements

- [Node.js](https://nodejs.org/) v18 or later
- npm (comes with Node.js)

## Setup

`better-sqlite3` ships prebuilt binaries for Electron, so no C++ compiler is needed.

```bash
# 1. Install JS dependencies (skip better-sqlite3's own node-gyp script)
npm install --ignore-scripts

# 2. Download the Electron binary
node node_modules/electron/install.js

# 3. Build better-sqlite3 against the bundled Electron runtime
npm run rebuild

# 4. Launch the app
npm start
```

> On subsequent `npm install` runs you only need step 1 + 3 (or just `npm run rebuild`
> if you already have the Electron binary).

## First Use

1. Launch the app with `npm start`
2. Click **+ Import CSV** to import individual Cardmarket export files, or
3. Go to **Settings (⚙️)** → set your CSV folder → future syncs with **⟳ Sync Folder**

## CSV Format

Export from Cardmarket: *Account → Sold Orders → Export as CSV*.
Filename format: `Sold_Orders-byPurchaseDate-YYYY-MM-DD_YYYY-MM-DD.csv`

The app accepts multiple CSV files and deduplicates by Order ID — safe to re-import.

## Features

- **Overview**: KPIs (revenue, net revenue, unique buyers, commission rate, cards sold, avg order), daily revenue chart, monthly bar, country breakdown, foil vs normal, rarity split
- **Cards**: Top 20 cards by revenue with rarity badges, language breakdown, rarity analysis
- **Orders**: Last 50 orders with professional-buyer indicator and live text search
- **Sets**: Revenue by set, set breakdown table, monthly revenue trend
- **Filters**: Date range filter across all views
- **Database**: SQLite stored in your OS app data folder (shown in Settings)

## Build a distributable

```bash
npm run build
```
Outputs a `.exe` / `.dmg` / `.AppImage` in the `dist/` folder.

## Project Structure

```
cm-visualizer/
  main.js      — Electron main process, SQLite, CSV parser, IPC handlers
  preload.js   — Secure contextBridge between main and renderer
  index.html   — Full dashboard UI (Chart.js, vanilla JS, no framework)
  package.json
  Data/        — Place your Cardmarket CSV exports here
```
