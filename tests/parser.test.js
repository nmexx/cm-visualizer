'use strict';

const { parseFloat_eu, parseDescriptionItem, parseCSVLine, parseDelimitedLine, sanitizeDate } = require('../lib/parser');

// ─── parseFloat_eu ────────────────────────────────────────────────────────────
describe('parseFloat_eu', () => {
  test('parses a dot-decimal float', () => {
    expect(parseFloat_eu('3.98')).toBe(3.98);
  });

  test('parses a comma-decimal float (EU format)', () => {
    expect(parseFloat_eu('3,98')).toBe(3.98);
  });

  test('parses an integer string', () => {
    expect(parseFloat_eu('10')).toBe(10);
  });

  test('parses zero', () => {
    expect(parseFloat_eu('0,00')).toBe(0);
  });

  test('returns 0 for empty string', () => {
    expect(parseFloat_eu('')).toBe(0);
  });

  test('returns 0 for null', () => {
    expect(parseFloat_eu(null)).toBe(0);
  });

  test('returns 0 for undefined', () => {
    expect(parseFloat_eu(undefined)).toBe(0);
  });

  test('parses large amounts', () => {
    expect(parseFloat_eu('1234,56')).toBe(1234.56);
  });

  test('parses EU amounts with dot-thousands separator ("1.234,56" \u2192 1234.56)', () => {
    expect(parseFloat_eu('1.234,56')).toBe(1234.56);
  });


  test('parses dot-decimal float unchanged ("3.98" \u2192 3.98)', () => {
    expect(parseFloat_eu('3.98')).toBe(3.98);
  });
});

// ─── parseCSVLine ─────────────────────────────────────────────────────────────
describe('parseCSVLine', () => {
  test('splits a simple semicolon-delimited line', () => {
    expect(parseCSVLine('a;b;c')).toEqual(['a', 'b', 'c']);
  });

  test('preserves empty fields', () => {
    expect(parseCSVLine('a;;c')).toEqual(['a', '', 'c']);
  });

  test('handles a single field', () => {
    expect(parseCSVLine('hello')).toEqual(['hello']);
  });

  test('handles a real Cardmarket header prefix', () => {
    const line = 'OrderID;Username;Name;Street;City;Country';
    expect(parseCSVLine(line)[0]).toBe('OrderID');
    expect(parseCSVLine(line)[5]).toBe('Country');
  });
});

// ─── parseDelimitedLine ─────────────────────────────────────────────────────
describe('parseDelimitedLine', () => {
  test('splits a simple comma-separated line', () => {
    expect(parseDelimitedLine('a,b,c')).toEqual(['a', 'b', 'c']);
  });

  test('uses a custom separator', () => {
    expect(parseDelimitedLine('a;b;c', ';')).toEqual(['a', 'b', 'c']);
  });

  test('handles quoted field containing the delimiter', () => {
    expect(parseDelimitedLine('"Eirdu, Fae",ECL,Test')).toEqual(['Eirdu, Fae', 'ECL', 'Test']);
  });

  test('handles escaped double-quote inside quoted field', () => {
    expect(parseDelimitedLine('"He said ""hello""",next')).toEqual(['He said "hello"', 'next']);
  });

  test('returns single-element array for empty string', () => {
    expect(parseDelimitedLine('')).toEqual(['']);
  });

  test('handles trailing delimiter (empty last field)', () => {
    expect(parseDelimitedLine('a,b,')).toEqual(['a', 'b', '']);
  });

  test('handles empty fields between delimiters', () => {
    expect(parseDelimitedLine('a,,c')).toEqual(['a', '', 'c']);
  });
});

// ─── sanitizeDate ─────────────────────────────────────────────────────────────
describe('sanitizeDate', () => {
  test('accepts a valid ISO date', () => {
    expect(sanitizeDate('2024-01-15')).toBe('2024-01-15');
  });

  test('trims surrounding whitespace', () => {
    expect(sanitizeDate(' 2024-01-15 ')).toBe('2024-01-15');
  });

  test('rejects a US-formatted date', () => {
    expect(sanitizeDate('01/15/2024')).toBeNull();
  });

  test('rejects a partial date', () => {
    expect(sanitizeDate('2024-01')).toBeNull();
  });

  test('rejects a datetime string', () => {
    expect(sanitizeDate('2024-01-15 12:00:00')).toBeNull();
  });

  test('rejects a SQL injection payload', () => {
    expect(sanitizeDate("2024-01-15'; DROP TABLE orders;--")).toBeNull();
  });

  test('returns null for empty string', () => {
    expect(sanitizeDate('')).toBeNull();
  });

  test('returns null for null', () => {
    expect(sanitizeDate(null)).toBeNull();
  });

  test('returns null for undefined', () => {
    expect(sanitizeDate(undefined)).toBeNull();
  });

  test('returns null for a non-string value', () => {
    expect(sanitizeDate(20240115)).toBeNull();
  });
});

// ─── parseDescriptionItem ─────────────────────────────────────────────────────
describe('parseDescriptionItem', () => {
  test('parses a basic single card', () => {
    const raw = '1x Torpor Orb (Mystery Booster 2) - 236 - Rare - NM - English - 3,98 EUR';
    const result = parseDescriptionItem(raw);

    expect(result.quantity).toBe(1);
    expect(result.card_name).toBe('Torpor Orb');
    expect(result.set_name).toBe('Mystery Booster 2');
    expect(result.collector_num).toBe('236');
    expect(result.rarity).toBe('Rare');
    expect(result.condition).toBe('NM');
    expect(result.language).toBe('English');
    expect(result.price).toBeCloseTo(3.98);
    expect(result.is_foil).toBe(0);
  });

  test('parses a foil card', () => {
    const raw = '1x Glasswing Grace // Age-Graced Chapel (Modern Horizons 3) - 254 - Uncommon - NM - English - Foil - 0,31 EUR';
    const result = parseDescriptionItem(raw);

    expect(result.card_name).toBe('Glasswing Grace // Age-Graced Chapel');
    expect(result.set_name).toBe('Modern Horizons 3');
    expect(result.rarity).toBe('Uncommon');
    expect(result.is_foil).toBe(1);
    expect(result.price).toBeCloseTo(0.31);
  });

  test('parses a multi-quantity row', () => {
    const raw = '2x All That Glitters (Commander Masters: Extras) - 622 - Common - NM - English - 0,35 EUR';
    const result = parseDescriptionItem(raw);

    expect(result.quantity).toBe(2);
    expect(result.card_name).toBe('All That Glitters');
    expect(result.set_name).toBe('Commander Masters: Extras');
    expect(result.rarity).toBe('Common');
    expect(result.price).toBeCloseTo(0.35);
  });

  test('parses a card with a version suffix in the name (V.2)', () => {
    const raw = '1x Polluted Bonds (V.2) (Enchanting Tales) - 75 - Rare - NM - English - Foil - 8,00 EUR';
    const result = parseDescriptionItem(raw);

    // The version "(V.2)" is part of the card name; "(Enchanting Tales)" is the set.
    expect(result.set_name).toBe('Enchanting Tales');
    expect(result.card_name).toBe('Polluted Bonds (V.2)');
    expect(result.rarity).toBe('Rare');
    expect(result.is_foil).toBe(1);
    expect(result.price).toBeCloseTo(8.0);
  });

  test('parses a dual-faced / fused card name', () => {
    const raw = '1x Gisela, the Broken Blade / Brisela, Voice of Nightmares (Innistrad Remastered) - 24 - Mythic - NM - English - 14,27 EUR';
    const result = parseDescriptionItem(raw);

    expect(result.card_name).toBe('Gisela, the Broken Blade / Brisela, Voice of Nightmares');
    expect(result.set_name).toBe('Innistrad Remastered');
    expect(result.rarity).toBe('Mythic');
    expect(result.price).toBeCloseTo(14.27);
    expect(result.is_foil).toBe(0);
  });

  test('parses a non-English card', () => {
    const raw = "1x Victor, Valgavoth's Seneschal (Duskmourn: House of Horror: Extras) - 364 - Rare - NM - German - 0,20 EUR";
    const result = parseDescriptionItem(raw);

    expect(result.language).toBe('German');
    expect(result.card_name).toBe("Victor, Valgavoth's Seneschal");
    expect(result.set_name).toBe('Duskmourn: House of Horror: Extras');
    expect(result.price).toBeCloseTo(0.20);
  });

  test('defaults quantity to 1 when no prefix is given', () => {
    const raw = 'Opt (Dominaria) - 60 - Common - NM - English - 0,10 EUR';
    const result = parseDescriptionItem(raw);
    expect(result.quantity).toBe(1);
  });

  test('returns 0 price when no EUR amount found', () => {
    const raw = '1x Mystery Card (Some Set) - 001 - Rare - NM - English';
    const result = parseDescriptionItem(raw);
    expect(result.price).toBe(0);
  });

  test('handles leading/trailing whitespace gracefully', () => {
    const raw = '  1x Opt (Dominaria) - 60 - Common - NM - English - 0,10 EUR  ';
    const result = parseDescriptionItem(raw);
    expect(result.card_name).toBe('Opt');
    expect(result.price).toBeCloseTo(0.10);
  });
});
