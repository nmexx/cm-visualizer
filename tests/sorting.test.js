'use strict';

const { sortArray } = require('../lib/sortUtils');

// ─── Fixtures ────────────────────────────────────────────────────────────────

const CARDS = [
  { card_name: 'Ragavan',      set_name: 'MH2', revenue: 45.00, qty_sold: 3 },
  { card_name: 'Black Lotus',  set_name: 'LEA', revenue: 999.99, qty_sold: 1 },
  { card_name: 'Ancestral Recall', set_name: 'LEA', revenue: 350.00, qty_sold: 2 },
  { card_name: 'Force of Will', set_name: 'ALL', revenue: 80.50, qty_sold: 5 },
];

const SETS = [
  { set_name: 'Zendikar',   qty: 10, revenue: 30.00 },
  { set_name: 'Alara',      qty: 5,  revenue: 120.50 },
  { set_name: 'Mirrodin',   qty: 20, revenue: 15.00 },
];

const MIXED_NULL = [
  { card_name: null,         revenue: 5.0  },
  { card_name: 'Brainstorm', revenue: null },
  { card_name: 'Counterspell', revenue: 3.0 },
];

// ─── sortArray — numeric sorting ─────────────────────────────────────────────

describe('sortArray — numeric (revenue)', () => {
  test('sorts ascending', () => {
    const result = sortArray(CARDS, 'revenue', 'num', 'asc');
    const revenues = result.map(r => r.revenue);
    expect(revenues).toEqual([45.00, 80.50, 350.00, 999.99]);
  });

  test('sorts descending', () => {
    const result = sortArray(CARDS, 'revenue', 'num', 'desc');
    const revenues = result.map(r => r.revenue);
    expect(revenues).toEqual([999.99, 350.00, 80.50, 45.00]);
  });

  test('null numeric values treated as 0', () => {
    const result = sortArray(MIXED_NULL, 'revenue', 'num', 'asc');
    expect(result[0].card_name).toBe('Brainstorm'); // null → 0 sorts first
  });

  test('zero-length array returns empty array', () => {
    expect(sortArray([], 'revenue', 'num', 'asc')).toEqual([]);
  });
});

// ─── sortArray — string sorting ───────────────────────────────────────────────

describe('sortArray — string (card_name)', () => {
  test('sorts alphabetically ascending', () => {
    const result = sortArray(CARDS, 'card_name', 'str', 'asc');
    expect(result[0].card_name).toBe('Ancestral Recall');
    expect(result[result.length - 1].card_name).toBe('Ragavan');
  });

  test('sorts alphabetically descending', () => {
    const result = sortArray(CARDS, 'card_name', 'str', 'desc');
    expect(result[0].card_name).toBe('Ragavan');
    expect(result[result.length - 1].card_name).toBe('Ancestral Recall');
  });

  test('null string values treated as empty string, sort first ascending', () => {
    const result = sortArray(MIXED_NULL, 'card_name', 'str', 'asc');
    expect(result[0].card_name).toBeNull();
  });

  test('sorts sets by name ascending', () => {
    const result = sortArray(SETS, 'set_name', 'str', 'asc');
    expect(result.map(r => r.set_name)).toEqual(['Alara', 'Mirrodin', 'Zendikar']);
  });

  test('sorts sets by name descending', () => {
    const result = sortArray(SETS, 'set_name', 'str', 'desc');
    expect(result.map(r => r.set_name)).toEqual(['Zendikar', 'Mirrodin', 'Alara']);
  });
});

// ─── sortArray — immutability ─────────────────────────────────────────────────

describe('sortArray — does not mutate source', () => {
  test('original array order is preserved after sort', () => {
    const original = [...CARDS];
    sortArray(CARDS, 'revenue', 'num', 'asc');
    expect(CARDS.map(r => r.card_name)).toEqual(original.map(r => r.card_name));
  });
});

// ─── sortArray — default direction ───────────────────────────────────────────

describe('sortArray — unrecognised direction defaults to asc', () => {
  test('unknown dir treated as ascending', () => {
    const result = sortArray(SETS, 'revenue', 'num', 'unknown');
    expect(result[0].revenue).toBe(15.00);
  });
});

// ─── sortArray — numeric string values parse correctly ───────────────────────

describe('sortArray — numeric strings', () => {
  const rows = [
    { label: 'C', value: '10' },
    { label: 'A', value: '2'  },
    { label: 'B', value: '100'},
  ];

  test('parses numeric strings correctly (not lexicographic)', () => {
    const result = sortArray(rows, 'value', 'num', 'asc');
    expect(result.map(r => r.label)).toEqual(['A', 'C', 'B']);
  });
});
