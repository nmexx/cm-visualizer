'use strict';

const os   = require('os');
const path = require('path');
const fs   = require('fs');
const { importPurchasedCSVFile } = require('../lib/purchaseImporter');

// ─── Minimal in-memory DB for purchases ──────────────────────────────────────

class MockPurchaseStatement {
  constructor(db, sql) {
    this._db  = db;
    this._sql = sql.trim();
  }

  run(...args) {
    const sql = this._sql.toUpperCase();

    if (sql.startsWith('DELETE FROM PURCHASE_ITEMS')) {
      const [order_id] = args;
      this._db._items = this._db._items.filter(i => i.order_id !== order_id);
      return;
    }

    if (sql.includes('INTO PURCHASES\n') || sql.includes('INTO PURCHASES ') || sql.includes('INTO PURCHASES\r')) {
      const [
        order_id, seller_username, seller_name, city, country, is_professional,
        date_of_purchase, article_count, merchandise_value, shipment_costs,
        trustee_fee, total_value, currency, source_file,
      ] = args;
      this._db._purchases.delete(order_id);
      this._db._purchases.set(order_id, {
        order_id, seller_username, seller_name, city, country, is_professional,
        date_of_purchase, article_count, merchandise_value, shipment_costs,
        trustee_fee, total_value, currency, source_file,
      });
      return;
    }

    if (sql.includes('INTO PURCHASE_ITEMS')) {
      const [
        order_id, product_id, card_name, localized_name, set_name,
        collector_num, rarity, condition, language, is_foil, quantity, price,
      ] = args;
      this._db._items.push({
        id: ++this._db._nextId,
        order_id, product_id, card_name, localized_name, set_name,
        collector_num, rarity, condition, language, is_foil, quantity, price,
      });
      return;
    }

    throw new Error(`MockPurchaseStatement.run: unhandled SQL:\n${this._sql}`);
  }

  get(...args) {
    const sql = this._sql.toUpperCase();
    if (sql.includes('FROM PURCHASES') && sql.includes('WHERE')) {
      const [order_id] = args;
      return this._db._purchases.get(order_id) || undefined;
    }
    throw new Error(`MockPurchaseStatement.get: unhandled SQL:\n${this._sql}`);
  }
}

class MockPurchaseDB {
  constructor() {
    this._purchases = new Map();
    this._items     = [];
    this._nextId    = 0;
  }

  prepare(sql) { return new MockPurchaseStatement(this, sql); }

  transaction(fn) { return fn; }

  getPurchase(order_id) { return this._purchases.get(order_id); }
  getItemsFor(order_id) { return this._items.filter(i => i.order_id === order_id); }
}

// ─── CSV helpers ──────────────────────────────────────────────────────────────

const CSV_HEADER = 'OrderID;Username;Name;Street;City;Country;Is Professional;VAT Number;Date of Purchase;Article Count;Merchandise Value;Shipment Costs;Trustee Service Fee;Total Value;Currency;Description;Product ID;Localized Product Name';

function writeTempCSV(content) {
  const p = path.join(os.tmpdir(), `cm-purch-${Date.now()}-${Math.random().toString(36).slice(2)}.csv`);
  fs.writeFileSync(p, content, 'utf-8');
  return p;
}

function csvLines(...rows) {
  return [CSV_HEADER, ...rows].join('\n');
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('importPurchasedCSVFile', () => {
  let db;

  beforeEach(() => { db = new MockPurchaseDB(); });

  test('returns { inserted:0, skipped:0 } for a header-only file', () => {
    const p = writeTempCSV(CSV_HEADER + '\n');
    expect(importPurchasedCSVFile(db, p)).toEqual({ inserted: 0, skipped: 0 });
    fs.unlinkSync(p);
  });

  test('inserts a single purchase order and its item', () => {
    const p = writeTempCSV(csvLines(
      '2001;seller1;Card Shop GmbH;Marktplatz 1;Vienna;Austria;;;2024-07-01 10:00:00;1;1,50;1,20;0,10;2,80;EUR;1x Opt (Dominaria) - 60 - Common - NM - English - 1,50 EUR;100001;Opt',
    ));
    const result = importPurchasedCSVFile(db, p);
    fs.unlinkSync(p);

    expect(result.inserted).toBe(1);
    expect(result.skipped).toBe(0);

    const order = db.getPurchase('2001');
    expect(order).toBeDefined();
    expect(order.seller_username).toBe('seller1');
    expect(order.country).toBe('Austria');
    expect(order.merchandise_value).toBeCloseTo(1.50);
    expect(order.shipment_costs).toBeCloseTo(1.20);
    expect(order.trustee_fee).toBeCloseTo(0.10);     // col 12
    expect(order.total_value).toBeCloseTo(2.80);     // col 13
    expect(order.source_file).toMatch(/\.csv$/);

    const items = db.getItemsFor('2001');
    expect(items).toHaveLength(1);
    expect(items[0].card_name).toBe('Opt');
    expect(items[0].rarity).toBe('Common');
    expect(items[0].condition).toBe('NM');
    expect(items[0].language).toBe('English');
    expect(items[0].is_foil).toBe(0);
    expect(items[0].price).toBeCloseTo(1.50);
  });

  test('inserts a purchase with multiple pipe-separated items', () => {
    const p = writeTempCSV(csvLines(
      '2002;seller2;Andere Shop;Straße 5;Berlin;Germany;;;2024-07-02 12:00:00;3;5,10;1,20;0,15;6,45;EUR;' +
      '1x Brainstorm (Commander Legends) - 10 - Common - NM - English - 2,00 EUR | ' +
      '1x Torpor Orb (Mystery Booster 2) - 236 - Rare - NM - English - 2,10 EUR | ' +
      '1x Opt (Dominaria) - 60 - Common - NM - English - 1,00 EUR;' +
      '200001 | 790959 | 100001;Brainstorm | Torpor Orb | Opt',
    ));
    const result = importPurchasedCSVFile(db, p);
    fs.unlinkSync(p);

    expect(result.inserted).toBe(1);

    const items = db.getItemsFor('2002');
    expect(items).toHaveLength(3);
    expect(items[0].card_name).toBe('Brainstorm');
    expect(items[1].card_name).toBe('Torpor Orb');
    expect(items[1].rarity).toBe('Rare');
    expect(items[2].card_name).toBe('Opt');
    expect(items[2].price).toBeCloseTo(1.00);
  });

  test('trustee_fee is col 12 and total_value is col 13 (not swapped)', () => {
    // Sold orders have: col12=total, col13=commission
    // Purchased orders have: col12=trustee_fee, col13=total_value
    const p = writeTempCSV(csvLines(
      '2003;seller3;Trustee Test;Str 1;Madrid;Spain;;;2024-07-03 09:00:00;1;10,00;2,50;0,50;13,00;EUR;1x Some Card (Some Set) - 1 - Rare - NM - English - 10,00 EUR;999;Some Card',
    ));
    importPurchasedCSVFile(db, p);
    fs.unlinkSync(p);

    const order = db.getPurchase('2003');
    expect(order.trustee_fee).toBeCloseTo(0.50);   // col 12 = 0,50
    expect(order.total_value).toBeCloseTo(13.00);  // col 13 = 13,00
  });

  test('correctly identifies a foil purchased item', () => {
    const p = writeTempCSV(csvLines(
      '2004;foilseller;Foil Trader;Ring Rd;London;United Kingdom;;;2024-07-04 11:00:00;1;5,00;1,50;0,20;6,70;EUR;' +
      '1x Glasswing Grace // Age-Graced Chapel (Modern Horizons 3) - 254 - Uncommon - NM - English - Foil - 5,00 EUR;771544;Glasswing Grace',
    ));
    importPurchasedCSVFile(db, p);
    fs.unlinkSync(p);

    const items = db.getItemsFor('2004');
    expect(items[0].is_foil).toBe(1);
    expect(items[0].card_name).toBe('Glasswing Grace // Age-Graced Chapel');
  });

  test('counts re-import of existing order as skipped and refreshes its items', () => {
    const row = '2005;re-seller;Repeat Inc;Ave 9;Paris;France;;;2024-07-05 08:00:00;1;3,00;1,20;0,10;4,30;EUR;1x Counterspell (Alpha Edition) - 54 - Common - NM - English - 3,00 EUR;50001;Counterspell';

    let p = writeTempCSV(csvLines(row));
    importPurchasedCSVFile(db, p);
    fs.unlinkSync(p);

    // Second import of the same file
    p = writeTempCSV(csvLines(row));
    const result = importPurchasedCSVFile(db, p);
    fs.unlinkSync(p);

    expect(result.skipped).toBe(1);
    // items from the second import replace the first
    expect(db.getItemsFor('2005')).toHaveLength(1);
  });

  test('skips blank/empty rows gracefully', () => {
    const content = [CSV_HEADER, '', '  ', '2006;seller6;Shop;St 1;Rome;Italy;;;2024-07-06 10:00:00;1;2,00;1,20;0,10;3,30;EUR;1x Llanowar Elves (M19) - 180 - Common - NM - English - 2,00 EUR;60001;Llanowar Elves', ''].join('\n');
    const p = writeTempCSV(content);
    const result = importPurchasedCSVFile(db, p);
    fs.unlinkSync(p);

    expect(result.inserted).toBe(1);
    expect(db.getPurchase('2006')).toBeDefined();
  });
});
