'use strict';

const os   = require('os');
const path = require('path');
const fs   = require('fs');
const { importInventoryFile, parseCSVLine } = require('../lib/inventoryImporter');

// ─── Minimal in-memory DB mock ────────────────────────────────────────────────
class MockInventoryStatement {
  constructor(db, sql) {
    this._db  = db;
    this._sql = sql.trim().toUpperCase();
  }

  run(...args) {
    if (this._sql.includes('INTO MANABOX_INVENTORY')) {
      const [
        card_name, set_code, set_name, collector_num, is_foil, rarity,
        quantity, manabox_id, scryfall_id, purchase_price,
        condition, language, purchase_currency, source_file,
      ] = args;

      const key = `${card_name}||${scryfall_id}`;
      if (this._db._inventory.has(key)) return { changes: 0 };
      this._db._inventory.set(key, {
        id: ++this._db._nextId,
        card_name, set_code, set_name, collector_num, is_foil, rarity,
        quantity, manabox_id, scryfall_id, purchase_price,
        condition, language, purchase_currency, source_file,
      });
      return { changes: 1 };
    }
    throw new Error(`MockInventoryStatement.run: unhandled SQL: ${this._sql}`);
  }
}

class MockInventoryDB {
  constructor() {
    this._inventory = new Map();
    this._nextId    = 0;
  }
  prepare(sql) { return new MockInventoryStatement(this, sql); }
  transaction(fn) { return fn; }
  getAll() { return [...this._inventory.values()]; }
}

// ─── CSV helpers ──────────────────────────────────────────────────────────────
const CSV_HEADER = 'Name,Set code,Set name,Collector number,Foil,Rarity,Quantity,ManaBox ID,Scryfall ID,Purchase price,Misprint,Altered,Condition,Language,Purchase price currency';

function writeTempCSV(content) {
  const p = path.join(os.tmpdir(), `inv-test-${Date.now()}-${Math.random().toString(36).slice(2)}.csv`);
  fs.writeFileSync(p, content, 'utf-8');
  return p;
}

function csvLine(name, setCode = 'ECL', setName = 'Test Set', colNum = '1', foil = 'foil',
  rarity = 'common', qty = '1', mbId = '100', sfId = 'aaaaaaaa-0000-0000-0000-000000000001',
  price = '0.10', condition = 'near_mint', lang = 'de', currency = 'EUR') {
  return `${name},${setCode},${setName},${colNum},${foil},${rarity},${qty},${mbId},${sfId},${price},false,false,${condition},${lang},${currency}`;
}

// ─── parseCSVLine unit tests ──────────────────────────────────────────────────
describe('parseCSVLine', () => {
  test('splits a simple comma-separated line', () => {
    expect(parseCSVLine('a,b,c')).toEqual(['a', 'b', 'c']);
  });

  test('handles quoted field containing a comma', () => {
    expect(parseCSVLine('"Eirdu, Elf // Isilu, Fae",ECL,Test')).toEqual([
      'Eirdu, Elf // Isilu, Fae', 'ECL', 'Test',
    ]);
  });

  test('handles escaped double-quote inside quoted field', () => {
    expect(parseCSVLine('"He said ""hello""",next')).toEqual(['He said "hello"', 'next']);
  });

  test('returns single-element array for empty string', () => {
    expect(parseCSVLine('')).toEqual(['']);
  });

  test('handles trailing comma (empty last field)', () => {
    expect(parseCSVLine('a,b,')).toEqual(['a', 'b', '']);
  });
});

// ─── importInventoryFile unit tests ───────────────────────────────────────────
describe('importInventoryFile', () => {
  let db;
  beforeEach(() => { db = new MockInventoryDB(); });

  test('returns { inserted:0, skipped:0 } for header-only file', () => {
    const p = writeTempCSV(CSV_HEADER + '\n');
    expect(importInventoryFile(db, p)).toEqual({ inserted: 0, skipped: 0 });
    fs.unlinkSync(p);
  });

  test('inserts a single foil card', () => {
    const p = writeTempCSV([CSV_HEADER, csvLine('Brambleback Brute')].join('\n'));
    const r = importInventoryFile(db, p);
    fs.unlinkSync(p);

    expect(r.inserted).toBe(1);
    expect(r.skipped).toBe(0);
    const items = db.getAll();
    expect(items).toHaveLength(1);
    expect(items[0].card_name).toBe('Brambleback Brute');
    expect(items[0].is_foil).toBe(1);
    expect(items[0].set_code).toBe('ECL');
    expect(items[0].scryfall_id).toBe('aaaaaaaa-0000-0000-0000-000000000001');
    expect(items[0].purchase_price).toBeCloseTo(0.10);
    expect(items[0].condition).toBe('near_mint');
    expect(items[0].language).toBe('de');
  });

  test('inserts a non-foil card (Foil column = "normal")', () => {
    const p = writeTempCSV([CSV_HEADER,
      csvLine('Shore Lurker', 'ECL', 'Test', '34', 'normal'),
    ].join('\n'));
    const r = importInventoryFile(db, p);
    fs.unlinkSync(p);
    expect(r.inserted).toBe(1);
    expect(db.getAll()[0].is_foil).toBe(0);
  });

  test('skips duplicate (OR IGNORE) — same card_name + scryfall_id', () => {
    const line = csvLine('Lightning Bolt', 'ECL', 'T', '1', 'foil', 'common', '1',
      '123', 'aaaaaaaa-0000-0000-0000-000000000099', '0.50');
    const p = writeTempCSV([CSV_HEADER, line, line].join('\n'));
    const r = importInventoryFile(db, p);
    fs.unlinkSync(p);
    expect(r.inserted).toBe(1);
    expect(r.skipped).toBe(1);
  });

  test('inserts multiple rows from the same file', () => {
    const rows = [
      csvLine('Card A', 'ECL', 'S', '1', 'foil', 'common', '1', '1', 'aaaaaaaa-0000-0000-0000-000000000001'),
      csvLine('Card B', 'ECL', 'S', '2', 'foil', 'rare',   '2', '2', 'aaaaaaaa-0000-0000-0000-000000000002'),
      csvLine('Card C', 'ECL', 'S', '3', 'normal','mythic','1', '3', 'aaaaaaaa-0000-0000-0000-000000000003'),
    ];
    const p = writeTempCSV([CSV_HEADER, ...rows].join('\n'));
    const r = importInventoryFile(db, p);
    fs.unlinkSync(p);
    expect(r.inserted).toBe(3);
    expect(db.getAll()).toHaveLength(3);
  });

  test('parses quantity and purchase_price correctly', () => {
    const p = writeTempCSV([CSV_HEADER,
      csvLine('Mythic Card', 'ECL', 'S', '1', 'normal', 'mythic', '3', '999',
        'aaaaaaaa-0000-0000-0000-000000000005', '25.59'),
    ].join('\n'));
    const r = importInventoryFile(db, p);
    fs.unlinkSync(p);
    expect(r.inserted).toBe(1);
    const item = db.getAll()[0];
    expect(item.quantity).toBe(3);
    expect(item.purchase_price).toBeCloseTo(25.59);
    expect(item.rarity).toBe('mythic');
  });

  test('handles quoted card name with comma', () => {
    const p = writeTempCSV(
      CSV_HEADER + '\n' +
      '"Eirdu, Carrier of Dawn // Isilu, Carrier of Twilight",ECL,Lorwyn,286,normal,mythic,1,108970,ec3c80c4-4935-455c-a14f-a0532b6a41a8,14.44,false,false,near_mint,de,EUR'
    );
    const r = importInventoryFile(db, p);
    fs.unlinkSync(p);
    expect(r.inserted).toBe(1);
    expect(db.getAll()[0].card_name).toBe('Eirdu, Carrier of Dawn // Isilu, Carrier of Twilight');
  });

  test('records source_file as basename', () => {
    const p = writeTempCSV([CSV_HEADER, csvLine('Test Card')].join('\n'));
    importInventoryFile(db, p);
    fs.unlinkSync(p);
    expect(db.getAll()[0].source_file).toMatch(/\.csv$/);
    expect(db.getAll()[0].source_file).not.toContain(path.sep);
  });

  test('skips empty rows', () => {
    const p = writeTempCSV([CSV_HEADER, '', csvLine('Real Card'), '', ''].join('\n'));
    const r = importInventoryFile(db, p);
    fs.unlinkSync(p);
    expect(r.inserted).toBe(1);
  });

  test('returns { inserted:0, skipped:0 } for completely empty file', () => {
    const p = writeTempCSV('');
    expect(importInventoryFile(db, p)).toEqual({ inserted: 0, skipped: 0 });
    fs.unlinkSync(p);
  });

  test('throws if Name column is missing', () => {
    const badHeader = 'Set code,Set name\nECL,Test Set';
    const p = writeTempCSV(badHeader);
    expect(() => importInventoryFile(db, p)).toThrow('Missing required column: Name');
    fs.unlinkSync(p);
  });

  test('default quantity is 1 when field is empty', () => {
    // Build row with empty Quantity field
    const line = `Card X,ECL,S,1,foil,common,,999,aaaaaaaa-0000-0000-0000-000000000088,0.10,false,false,near_mint,de,EUR`;
    const p = writeTempCSV([CSV_HEADER, line].join('\n'));
    importInventoryFile(db, p);
    fs.unlinkSync(p);
    expect(db.getAll()[0].quantity).toBe(1);
  });

  test('explicit zero quantity is preserved as 0 (not coerced to 1)', () => {
    const line = `Zero Card,ECL,S,1,foil,common,0,998,aaaaaaaa-0000-0000-0000-000000000099,0.10,false,false,near_mint,de,EUR`;
    const p = writeTempCSV([CSV_HEADER, line].join('\n'));
    importInventoryFile(db, p);
    fs.unlinkSync(p);
    expect(db.getAll()[0].quantity).toBe(0);
  });
});
