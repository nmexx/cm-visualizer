'use strict';

const os   = require('os');
const path = require('path');
const fs   = require('fs');
const { importCSVFile } = require('../lib/importer');
const { MockDB }        = require('./helpers/mockDB');

// ─── Test CSV helpers ─────────────────────────────────────────────────────────
const CSV_HEADER = 'OrderID;Username;Name;Street;City;Country;Is Professional;VAT Number;Date of Purchase;Article Count;Merchandise Value;Shipment Costs;Total Value;Commission;Currency;Description;Product ID;Localized Product Name';

function writeTempCSV(content) {
  const p = path.join(os.tmpdir(), `cm-test-${Date.now()}-${Math.random().toString(36).slice(2)}.csv`);
  fs.writeFileSync(p, content, 'utf-8');
  return p;
}

function csvLines(...rows) {
  return [CSV_HEADER, ...rows].join('\n');
}

// ─── Tests ────────────────────────────────────────────────────────────────────
describe('importCSVFile', () => {
  let db;

  beforeEach(() => { db = new MockDB(); });

  test('returns { inserted:0, replaced:0 } for a header-only file', () => {
    const p = writeTempCSV(CSV_HEADER + '\n');
    expect(importCSVFile(db, p)).toEqual({ inserted: 0, replaced: 0 });
    fs.unlinkSync(p);
  });

  test('inserts a single order and its item', () => {
    const p = writeTempCSV(csvLines(
      '1001;buyer1;John Doe;Main St 1;Berlin;Germany;;;2024-06-01 10:00:00;1;3,98;1,25;5,23;0,20;EUR;1x Torpor Orb (Mystery Booster 2) - 236 - Rare - NM - English - 3,98 EUR;790959;Torpor Orb',
    ));
    const result = importCSVFile(db, p);
    fs.unlinkSync(p);

    expect(result.inserted).toBe(1);
    expect(result.replaced).toBe(0);

    const order = db.getOrder('1001');
    expect(order).toBeDefined();
    expect(order.country).toBe('Germany');
    expect(order.merchandise_value).toBeCloseTo(3.98);
    expect(order.commission).toBeCloseTo(0.20);
    expect(order.source_file).toEqual(expect.stringContaining('.csv'));

    const items = db.getItemsFor('1001');
    expect(items).toHaveLength(1);
    expect(items[0].card_name).toBe('Torpor Orb');
    expect(items[0].set_name).toBe('Mystery Booster 2');
    expect(items[0].rarity).toBe('Rare');
    expect(items[0].condition).toBe('NM');
    expect(items[0].language).toBe('English');
    expect(items[0].is_foil).toBe(0);
    expect(items[0].price).toBeCloseTo(3.98);
  });

  test('inserts an order with multiple pipe-separated items', () => {
    const p = writeTempCSV(csvLines(
      "1002;buyer2;Jane Smith;Road 2;Munich;Germany;;;2024-06-02 12:00:00;3;2,19;1,25;3,44;0,13;EUR;" +
      "1x Cast Down (Commander Legends: Battle for Baldur's Gate) - 119 - Uncommon - NM - English - 0,62 EUR | " +
      "1x Snow-Covered Forest (Mystery Booster 2) - 120 - Land - NM - English - 1,47 EUR | " +
      "1x Hazard of the Dunes (Aetherdrift) - 165 - Common - NM - English - 0,10 EUR;" +
      "660726 | 784594 | 809179;Cast Down | Snow-Covered Forest | Hazard of the Dunes",
    ));
    const result = importCSVFile(db, p);
    fs.unlinkSync(p);

    expect(result.inserted).toBe(1);

    const items = db.getItemsFor('1002');
    expect(items).toHaveLength(3);
    expect(items[0].card_name).toBe('Cast Down');
    expect(items[1].card_name).toBe('Snow-Covered Forest');
    expect(items[1].rarity).toBe('Land');
    expect(items[2].card_name).toBe('Hazard of the Dunes');
    expect(items[2].price).toBeCloseTo(0.10);
  });

  test('correctly marks a foil item', () => {
    const p = writeTempCSV(csvLines(
      '1003;buyer3;Alice;Ave 3;Hamburg;Germany;;;2024-06-03 09:00:00;1;0,31;1,25;1,56;0,05;EUR;' +
      '1x Glasswing Grace // Age-Graced Chapel (Modern Horizons 3) - 254 - Uncommon - NM - English - Foil - 0,31 EUR;771544;Glasswing Grace // Age-Graced Chapel',
    ));
    importCSVFile(db, p);
    fs.unlinkSync(p);

    const items = db.getItemsFor('1003');
    expect(items[0].is_foil).toBe(1);
    expect(items[0].card_name).toBe('Glasswing Grace // Age-Graced Chapel');
  });

  test('marks professional buyers (is_professional = 1)', () => {
    const p = writeTempCSV(csvLines(
      '1004;proshop;Pro Shop GmbH;Biz Ave 5;Frankfurt;Germany;X;DE123456789;2024-06-04 15:00:00;1;5,00;1,40;6,40;0,30;EUR;1x Some Card (Some Set) - 1 - Rare - NM - English - 5,00 EUR;111111;Some Card',
    ));
    importCSVFile(db, p);
    fs.unlinkSync(p);

    expect(db.getOrder('1004').is_professional).toBe(1);
  });

  test('marks non-professional buyers (is_professional = 0)', () => {
    const p = writeTempCSV(csvLines(
      '1005;normal;Regular User;Main St 1;Cologne;Germany;;;2024-06-05 10:00:00;1;2,00;1,25;3,25;0,12;EUR;1x Opt (Dominaria) - 60 - Common - NM - English - 2,00 EUR;100001;Opt',
    ));
    importCSVFile(db, p);
    fs.unlinkSync(p);

    expect(db.getOrder('1005').is_professional).toBe(0);
  });

  test('counts re-import of existing order as replaced and overwrites items', () => {
    const row = '1006;buyer6;Tom;Lane 6;Dortmund;Germany;;;2024-06-06 08:00:00;1;4,00;1,25;5,25;0,22;EUR;1x Brainstorm (Commander Legends) - 10 - Common - NM - English - 4,00 EUR;200001;Brainstorm';

    let p = writeTempCSV(csvLines(row));
    const first = importCSVFile(db, p);
    fs.unlinkSync(p);
    expect(first.inserted).toBe(1);

    p = writeTempCSV(csvLines(row));
    const second = importCSVFile(db, p);
    fs.unlinkSync(p);

    expect(second.inserted).toBe(0);
    expect(second.replaced).toBe(1);
    expect(db.allOrders()).toHaveLength(1);
    expect(db.getItemsFor('1006')).toHaveLength(1);
  });

  test('inserts multiple orders from a single CSV', () => {
    const p = writeTempCSV(csvLines(
      '2001;a;A;St 1;Berlin;Germany;;;2024-07-01 10:00:00;1;1,00;1,25;2,25;0,06;EUR;1x Plains (Core Set 2021) - 250 - Land - NM - English - 1,00 EUR;300001;Plains',
      '2002;b;B;St 2;Munich;Germany;;;2024-07-02 11:00:00;1;2,00;1,25;3,25;0,12;EUR;1x Island (Core Set 2021) - 251 - Land - NM - English - 2,00 EUR;300002;Island',
      '2003;c;C;St 3;Hamburg;Germany;;;2024-07-03 12:00:00;1;3,00;1,25;4,25;0,18;EUR;1x Swamp (Core Set 2021) - 252 - Land - NM - English - 3,00 EUR;300003;Swamp',
    ));
    const result = importCSVFile(db, p);
    fs.unlinkSync(p);

    expect(result.inserted).toBe(3);
    expect(result.replaced).toBe(0);
    expect(db.allOrders()).toHaveLength(3);
  });

  test('assigns product IDs and localized names to items', () => {
    const p = writeTempCSV(csvLines(
      "1007;buyer7;Hans;Str 7;Köln;Germany;;;2024-06-07 10:00:00;2;5,00;1,40;6,40;0,30;EUR;" +
      "1x Cast Down (Dominaria) - 81 - Uncommon - NM - German - 0,25 EUR | " +
      "1x Brainstorm (Commander Legends) - 10 - Common - NM - English - 4,75 EUR;" +
      "123 | 456;Hinabwerfen | Brainstorm",
    ));
    importCSVFile(db, p);
    fs.unlinkSync(p);

    const items = db.getItemsFor('1007');
    expect(items[0].product_id).toBe('123');
    expect(items[0].localized_name).toBe('Hinabwerfen');
    expect(items[1].product_id).toBe('456');
    expect(items[1].localized_name).toBe('Brainstorm');
  });

  test('ignores blank / whitespace-only lines inside the CSV', () => {
    const p = writeTempCSV([
      CSV_HEADER,
      '3001;x;X;St 1;Berlin;Germany;;;2024-08-01 10:00:00;1;1,50;1,25;2,75;0,09;EUR;1x Lightning Bolt (The List) - 42 - Common - NM - English - 1,50 EUR;400001;Lightning Bolt',
      '',
      '   ',
    ].join('\n'));
    const result = importCSVFile(db, p);
    fs.unlinkSync(p);

    expect(result.inserted).toBe(1);
  });

  test('parses multi-quantity items correctly', () => {
    const p = writeTempCSV(csvLines(
      '4001;buyer4;A;B;C;Germany;;;2024-09-01 10:00:00;2;0,70;1,25;1,95;0,05;EUR;2x All That Glitters (Commander Masters: Extras) - 622 - Common - NM - English - 0,35 EUR;723545;All That Glitters',
    ));
    importCSVFile(db, p);
    fs.unlinkSync(p);

    const items = db.getItemsFor('4001');
    expect(items[0].quantity).toBe(2);
    expect(items[0].card_name).toBe('All That Glitters');
  });

  test('correctly parses CRLF line endings (Windows CSV)', () => {
    const row = '5001;buyercrlf;Test User;St 1;Berlin;Germany;;;2024-10-01 10:00:00;1;1,00;1,25;2,25;0,06;EUR;1x Plains (Core Set 2021) - 250 - Land - NM - English - 1,00 EUR;300001;Plains';
    const p = writeTempCSV(CSV_HEADER + '\r\n' + row + '\r\n');
    const result = importCSVFile(db, p);
    fs.unlinkSync(p);

    expect(result.inserted).toBe(1);
    const order = db.getOrder('5001');
    expect(order).toBeDefined();
    // country must not have a trailing \r
    expect(order.country).toBe('Germany');
  });
});
