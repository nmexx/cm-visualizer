/**
 * Baseline CREATE TABLE IF NOT EXISTS DDL for the CM Visualizer database.
 *
 * Applied once at startup via `db.exec(BASELINE_DDL)` before running migrations.
 * All structural changes after the initial schema are handled as numbered
 * migrations in migrations.js — never modify existing columns here.
 */
'use strict';

const BASELINE_DDL = `
  CREATE TABLE IF NOT EXISTS orders (
    order_id          TEXT PRIMARY KEY,
    username          TEXT,
    buyer_name        TEXT,
    city              TEXT,
    country           TEXT,
    is_professional   INTEGER DEFAULT 0,
    date_of_purchase  TEXT,
    article_count     INTEGER,
    merchandise_value REAL,
    shipment_costs    REAL,
    total_value       REAL,
    commission        REAL,
    currency          TEXT,
    source_file       TEXT
  );
  CREATE TABLE IF NOT EXISTS order_items (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id       TEXT,
    product_id     TEXT,
    card_name      TEXT,
    localized_name TEXT,
    set_name       TEXT,
    collector_num  TEXT,
    rarity         TEXT,
    condition      TEXT,
    language       TEXT,
    is_foil        INTEGER DEFAULT 0,
    quantity       INTEGER DEFAULT 1,
    price          REAL,
    FOREIGN KEY (order_id) REFERENCES orders(order_id)
  );
  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT
  );
  CREATE TABLE IF NOT EXISTS purchases (
    order_id          TEXT PRIMARY KEY,
    seller_username   TEXT,
    seller_name       TEXT,
    city              TEXT,
    country           TEXT,
    is_professional   INTEGER DEFAULT 0,
    date_of_purchase  TEXT,
    article_count     INTEGER,
    merchandise_value REAL,
    shipment_costs    REAL,
    trustee_fee       REAL,
    total_value       REAL,
    currency          TEXT,
    source_file       TEXT
  );
  CREATE TABLE IF NOT EXISTS purchase_items (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id       TEXT,
    product_id     TEXT,
    card_name      TEXT,
    localized_name TEXT,
    set_name       TEXT,
    collector_num  TEXT,
    rarity         TEXT,
    condition      TEXT,
    language       TEXT,
    is_foil        INTEGER DEFAULT 0,
    quantity       INTEGER DEFAULT 1,
    price          REAL,
    FOREIGN KEY (order_id) REFERENCES purchases(order_id)
  );
  CREATE TABLE IF NOT EXISTS manabox_inventory (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    card_name         TEXT NOT NULL,
    set_code          TEXT,
    set_name          TEXT,
    collector_num     TEXT,
    is_foil           INTEGER DEFAULT 0,
    rarity            TEXT,
    quantity          INTEGER DEFAULT 1,
    manabox_id        TEXT,
    scryfall_id       TEXT,
    purchase_price    REAL,
    condition         TEXT,
    language          TEXT,
    purchase_currency TEXT,
    source_file       TEXT
  );
`;

module.exports = { BASELINE_DDL };
