'use strict';

const {
  computeProfitLoss,
  computeInventory,
  computeRepeatBuyers,
  computeSetROI,
  computeFoilPremium,
  computeTimeToSell,
} = require('../lib/analytics');

// ─── computeProfitLoss ────────────────────────────────────────────────────────

describe('computeProfitLoss', () => {
  test('returns empty array when both inputs are empty', () => {
    expect(computeProfitLoss([], [])).toEqual([]);
  });

  test('returns sold cards with zero cost when no purchases', () => {
    const sold = [{ card_name: 'Brainstorm', set_name: 'Alpha', rarity: 'Common', quantity: 2, price: 5.00 }];
    const result = computeProfitLoss(sold, []);
    expect(result).toHaveLength(1);
    expect(result[0].profit).toBeCloseTo(10.00);
    expect(result[0].total_cost).toBeCloseTo(0);
    expect(result[0].margin_pct).toBeNull();
  });

  test('returns sold cards only in result (bought-only cards omitted)', () => {
    const bought = [{ card_name: 'Opt', set_name: 'M20', rarity: 'Common', quantity: 3, price: 1.00 }];
    // bought-only card should NOT appear in P&L if it was never sold
    const result = computeProfitLoss([], bought);
    expect(result).toHaveLength(0);
  });

  test('computes profit/margin correctly for a matched card', () => {
    const bought = [{ card_name: 'Torpor Orb', set_name: 'NPH', rarity: 'Rare', quantity: 2, price: 3.00 }];
    const sold   = [{ card_name: 'Torpor Orb', set_name: 'NPH', rarity: 'Rare', quantity: 1, price: 8.00 }];
    const [r] = computeProfitLoss(sold, bought);
    expect(r.total_cost).toBeCloseTo(6.00);    // 2 × 3
    expect(r.total_revenue).toBeCloseTo(8.00); // 1 × 8
    expect(r.profit).toBeCloseTo(2.00);        // 8 - 6
    expect(r.margin_pct).toBeCloseTo(33.33, 1);
    expect(r.avg_buy).toBeCloseTo(3.00);
    expect(r.avg_sell).toBeCloseTo(8.00);
  });

  test('sorts results by profit DESC', () => {
    const sold = [
      { card_name: 'A', set_name: 'X', rarity: 'Rare',   quantity: 1, price: 2.00 },
      { card_name: 'B', set_name: 'X', rarity: 'Common', quantity: 1, price: 10.00 },
    ];
    const bought = [
      { card_name: 'A', set_name: 'X', rarity: 'Rare',   quantity: 1, price: 1.00 },
      { card_name: 'B', set_name: 'X', rarity: 'Common', quantity: 1, price: 1.00 },
    ];
    const result = computeProfitLoss(sold, bought);
    expect(result[0].card_name).toBe('B');
    expect(result[1].card_name).toBe('A');
  });

  test('negative profit when sell price < buy price', () => {
    const bought = [{ card_name: 'Slow Card', set_name: 'Y', rarity: 'Rare', quantity: 1, price: 20.00 }];
    const sold   = [{ card_name: 'Slow Card', set_name: 'Y', rarity: 'Rare', quantity: 1, price: 5.00 }];
    const [r] = computeProfitLoss(sold, bought);
    expect(r.profit).toBeCloseTo(-15.00);
    expect(r.margin_pct).toBeCloseTo(-75.00, 1);
  });

  test('card_name + set_name form the matching key (same name, different set = separate)', () => {
    const bought = [{ card_name: 'Forest', set_name: 'Alpha', rarity: 'Land', quantity: 1, price: 100 }];
    const sold   = [{ card_name: 'Forest', set_name: 'M20',   rarity: 'Land', quantity: 1, price: 0.10 }];
    const result = computeProfitLoss(sold, bought);
    // M20 Forest was sold but never bought → cost = 0, profit = 0.10
    expect(result).toHaveLength(1);
    expect(result[0].set_name).toBe('M20');
    expect(result[0].total_cost).toBeCloseTo(0);
  });
});

// ─── computeInventory ─────────────────────────────────────────────────────────

describe('computeInventory', () => {
  test('returns empty array when nothing bought', () => {
    expect(computeInventory([], [])).toEqual([]);
  });

  test('returns full qty as on-hand when nothing sold', () => {
    const bought = [{ card_name: 'Counterspell', set_name: 'Alpha', rarity: 'Common', quantity: 4, price: 2.50 }];
    const [r] = computeInventory(bought, []);
    expect(r.qty_on_hand).toBe(4);
    expect(r.avg_buy_price).toBeCloseTo(2.50);
    expect(r.estimated_value).toBeCloseTo(10.00);
  });

  test('reduces on-hand by quantity sold', () => {
    const bought = [{ card_name: 'Opt', set_name: 'DOM', rarity: 'Common', quantity: 6, price: 1.00 }];
    const sold   = [{ card_name: 'Opt', set_name: 'DOM', quantity: 4 }];
    const [r] = computeInventory(bought, sold);
    expect(r.qty_on_hand).toBe(2);
    expect(r.qty_sold).toBe(4);
    expect(r.estimated_value).toBeCloseTo(2.00);
  });

  test('excludes cards fully sold (qty_on_hand = 0)', () => {
    const bought = [{ card_name: 'Sold Out', set_name: 'S1', rarity: 'Rare', quantity: 2, price: 5.00 }];
    const sold   = [{ card_name: 'Sold Out', set_name: 'S1', quantity: 2 }];
    expect(computeInventory(bought, sold)).toHaveLength(0);
  });

  test('sorts by estimated_value DESC', () => {
    const bought = [
      { card_name: 'Cheap', set_name: 'X', rarity: 'Common', quantity: 1, price: 1.00 },
      { card_name: 'Pricey', set_name: 'X', rarity: 'Rare',  quantity: 1, price: 50.00 },
    ];
    const result = computeInventory(bought, []);
    expect(result[0].card_name).toBe('Pricey');
  });

  test('handles multiple entries for the same card accumulated correctly', () => {
    const bought = [
      { card_name: 'Bolt', set_name: 'A', rarity: 'Common', quantity: 2, price: 1.00 },
      { card_name: 'Bolt', set_name: 'A', rarity: 'Common', quantity: 3, price: 2.00 },
    ];
    const sold   = [{ card_name: 'Bolt', set_name: 'A', quantity: 1 }];
    const [r] = computeInventory(bought, sold);
    expect(r.qty_bought).toBe(5);
    expect(r.qty_on_hand).toBe(4);
    // avg buy = (2×1 + 3×2) / 5 = 8/5 = 1.60
    expect(r.avg_buy_price).toBeCloseTo(1.60);
  });

  test('includes product_id from first bought row in result', () => {
    const bought = [{ card_name: 'Brainstorm', set_name: 'ICE', rarity: 'Common', quantity: 2, price: 1.5, product_id: '12345' }];
    const [r] = computeInventory(bought, []);
    expect(r.product_id).toBe('12345');
  });

  test('latches first valid product_id when multiple rows exist', () => {
    const bought = [
      { card_name: 'Bolt', set_name: 'A', rarity: 'Common', quantity: 1, price: 1.0, product_id: '111' },
      { card_name: 'Bolt', set_name: 'A', rarity: 'Common', quantity: 1, price: 1.0, product_id: '222' },
    ];
    const [r] = computeInventory(bought, []);
    expect(r.product_id).toBe('111');
  });

  test('sets product_id to null when not provided', () => {
    const bought = [{ card_name: 'Forest', set_name: 'LEA', rarity: 'Land', quantity: 1, price: 0.5 }];
    const [r] = computeInventory(bought, []);
    expect(r.product_id).toBeNull();
  });
});

// ─── computeRepeatBuyers ──────────────────────────────────────────────────────

describe('computeRepeatBuyers', () => {
  test('returns zeros for empty orders', () => {
    const r = computeRepeatBuyers([]);
    expect(r.total).toBe(0);
    expect(r.repeatCount).toBe(0);
    expect(r.repeatPct).toBe(0);
  });

  test('identifies repeat vs single buyers', () => {
    const orders = [
      { username: 'alice', buyer_name: 'Alice', merchandise_value: 10, article_count: 2 },
      { username: 'alice', buyer_name: 'Alice', merchandise_value: 15, article_count: 3 },
      { username: 'bob',   buyer_name: 'Bob',   merchandise_value: 5,  article_count: 1 },
    ];
    const r = computeRepeatBuyers(orders);
    expect(r.total).toBe(2);       // 2 unique buyers
    expect(r.repeatCount).toBe(1); // alice
    expect(r.repeatPct).toBeCloseTo(50);
    expect(r.topRepeats[0].username).toBe('alice');
    expect(r.topRepeats[0].order_count).toBe(2);
  });

  test('computes repeatRevenuePct correctly', () => {
    const orders = [
      { username: 'repeat', buyer_name: 'R', merchandise_value: 80, article_count: 5 },
      { username: 'repeat', buyer_name: 'R', merchandise_value: 20, article_count: 3 },
      { username: 'once',   buyer_name: 'O', merchandise_value: 100, article_count: 4 },
    ];
    const r = computeRepeatBuyers(orders);
    // repeat buyer contributed 100 of total 200 = 50%
    expect(r.repeatRevenuePct).toBeCloseTo(50);
  });

  test('distribution counts match across buckets', () => {
    const orders = [
      { username: 'a', buyer_name: 'A', merchandise_value: 1, article_count: 1 },
      { username: 'b', buyer_name: 'B', merchandise_value: 1, article_count: 1 },
      { username: 'b', buyer_name: 'B', merchandise_value: 1, article_count: 1 },
      { username: 'c', buyer_name: 'C', merchandise_value: 1, article_count: 1 },
      { username: 'c', buyer_name: 'C', merchandise_value: 1, article_count: 1 },
      { username: 'c', buyer_name: 'C', merchandise_value: 1, article_count: 1 },
      { username: 'd', buyer_name: 'D', merchandise_value: 1, article_count: 1 },
      { username: 'd', buyer_name: 'D', merchandise_value: 1, article_count: 1 },
      { username: 'd', buyer_name: 'D', merchandise_value: 1, article_count: 1 },
      { username: 'd', buyer_name: 'D', merchandise_value: 1, article_count: 1 },
    ];
    const r = computeRepeatBuyers(orders);
    expect(r.distribution.once).toBe(1);   // a
    expect(r.distribution.twice).toBe(1);  // b
    expect(r.distribution.thrice).toBe(1); // c
    expect(r.distribution.more).toBe(1);   // d
  });
});

// ─── computeSetROI ────────────────────────────────────────────────────────────

describe('computeSetROI', () => {
  test('returns empty for empty inputs', () => {
    expect(computeSetROI([], [])).toEqual([]);
  });

  test('computes roi_pct from avg sell vs avg buy', () => {
    const bought = [{ set_name: 'Alpha', quantity: 2, price: 5.00 }];
    const sold   = [{ set_name: 'Alpha', quantity: 2, price: 10.00 }];
    const [r] = computeSetROI(sold, bought);
    expect(r.avg_buy).toBeCloseTo(5.00);
    expect(r.avg_sell).toBeCloseTo(10.00);
    expect(r.roi_pct).toBeCloseTo(100.00);
  });

  test('sold-only sets appear with null roi_pct (no cost basis)', () => {
    const result = computeSetROI([{ set_name: 'SoldOnly', quantity: 1, price: 5 }], []);
    expect(result).toHaveLength(1);
    expect(result[0].set_name).toBe('SoldOnly');
    expect(result[0].roi_pct).toBeNull();
    expect(result[0].qty_bought).toBe(0);
    expect(result[0].total_revenue).toBeCloseTo(5);
  });

  test('sold-only set sorts after sets with a cost basis (nulls last)', () => {
    const bought = [{ set_name: 'Bought', quantity: 1, price: 5.00 }];
    const sold   = [
      { set_name: 'Bought',   quantity: 1, price: 10.00 }, // +100% roi
      { set_name: 'SoldOnly', quantity: 1, price: 3.00  }, // null roi
    ];
    const result = computeSetROI(sold, bought);
    expect(result).toHaveLength(2);
    expect(result[0].set_name).toBe('Bought');
    expect(result[1].set_name).toBe('SoldOnly');
    expect(result[1].roi_pct).toBeNull();
  });

  test('bought-but-not-sold set has roi_pct of -100 (full loss)', () => {
    const bought = [{ set_name: 'Unsold', quantity: 1, price: 10.00 }];
    const result = computeSetROI([], bought);
    expect(result).toHaveLength(1);
    expect(result[0].roi_pct).toBeCloseTo(-100.00);
  });

  test('negative ROI when avg sell < avg buy', () => {
    const bought = [{ set_name: 'Beta', quantity: 1, price: 20.00 }];
    const sold   = [{ set_name: 'Beta', quantity: 1, price: 10.00 }];
    const [r] = computeSetROI(sold, bought);
    expect(r.roi_pct).toBeCloseTo(-50.00);
  });

  test('sorts with highest ROI first, nulls last', () => {
    const bought = [
      { set_name: 'G', quantity: 1, price: 1.00 },
      { set_name: 'B', quantity: 1, price: 10.00 },
    ];
    const sold = [
      { set_name: 'G', quantity: 1, price: 5.00 },   // +400%
      { set_name: 'B', quantity: 1, price: 1.00 },   // -90%
    ];
    const result = computeSetROI(sold, bought);
    expect(result[0].set_name).toBe('G');
    expect(result[1].set_name).toBe('B');
  });

  test('skips rows with empty set_name', () => {
    const bought = [
      { set_name: '',      quantity: 1, price: 5.00 },
      { set_name: 'Kept', quantity: 1, price: 5.00 },
    ];
    // empty set_name entry is filtered out; 'Kept' appears with roi_pct = -100 (no sales)
    const result = computeSetROI([], bought);
    expect(result).toHaveLength(1);
    expect(result[0].set_name).toBe('Kept');

    const sold = [{ set_name: 'Kept', quantity: 1, price: 10.00 }];
    const r2 = computeSetROI(sold, bought);
    expect(r2).toHaveLength(1);
    expect(r2[0].roi_pct).toBeCloseTo(100.00); // bought @ 5, sold @ 10 = +100%
  });
});

// ─── computeFoilPremium ───────────────────────────────────────────────────────

describe('computeFoilPremium', () => {
  test('returns empty for empty input', () => {
    expect(computeFoilPremium([])).toEqual([]);
  });

  test('excludes cards with only foil or only normal sales', () => {
    const items = [
      { card_name: 'Foil Only', set_name: 'X', rarity: 'Rare', is_foil: 1, quantity: 1, price: 10 },
      { card_name: 'Normal Only', set_name: 'X', rarity: 'Common', is_foil: 0, quantity: 1, price: 1 },
    ];
    expect(computeFoilPremium(items)).toHaveLength(0);
  });

  test('computes premium correctly', () => {
    const items = [
      { card_name: 'Bolt', set_name: 'A', rarity: 'Common', is_foil: 0, quantity: 2, price: 1.00 },
      { card_name: 'Bolt', set_name: 'A', rarity: 'Common', is_foil: 1, quantity: 1, price: 4.00 },
    ];
    const [r] = computeFoilPremium(items);
    expect(r.avg_normal_price).toBeCloseTo(1.00);
    expect(r.avg_foil_price).toBeCloseTo(4.00);
    expect(r.foil_premium_pct).toBeCloseTo(300.00);
  });

  test('sorts by foil_premium_pct DESC', () => {
    const items = [
      { card_name: 'Low', set_name: 'A', rarity: 'Common', is_foil: 0, quantity: 1, price: 1.00 },
      { card_name: 'Low', set_name: 'A', rarity: 'Common', is_foil: 1, quantity: 1, price: 2.00 }, // +100%
      { card_name: 'High', set_name: 'A', rarity: 'Rare',  is_foil: 0, quantity: 1, price: 1.00 },
      { card_name: 'High', set_name: 'A', rarity: 'Rare',  is_foil: 1, quantity: 1, price: 5.00 }, // +400%
    ];
    const result = computeFoilPremium(items);
    expect(result[0].card_name).toBe('High');
    expect(result[1].card_name).toBe('Low');
  });
});

// ─── computeTimeToSell ────────────────────────────────────────────────────────

describe('computeTimeToSell', () => {
  test('returns empty when no overlap between bought and sold', () => {
    const bought = [{ card_name: 'A', set_name: 'X', date_of_purchase: '2024-01-01' }];
    const sold   = [{ card_name: 'B', set_name: 'X', date_of_sale: '2024-02-01' }];
    expect(computeTimeToSell(bought, sold)).toHaveLength(0);
  });

  test('computes correct days between purchase and sale', () => {
    const bought = [{ card_name: 'Opt', set_name: 'DOM', date_of_purchase: '2024-01-01' }];
    const sold   = [{ card_name: 'Opt', set_name: 'DOM', date_of_sale: '2024-01-31' }];
    const [r] = computeTimeToSell(bought, sold);
    expect(r.days_to_sell).toBe(30);
    expect(r.card_name).toBe('Opt');
  });

  test('uses FIRST purchase date (earliest)', () => {
    const bought = [
      { card_name: 'C', set_name: 'S', date_of_purchase: '2024-03-15' },
      { card_name: 'C', set_name: 'S', date_of_purchase: '2024-01-01' },
    ];
    const sold = [{ card_name: 'C', set_name: 'S', date_of_sale: '2024-04-01' }];
    const [r] = computeTimeToSell(bought, sold);
    // Should use 2024-01-01 as first bought → 91 days to 2024-04-01
    expect(r.first_bought).toBe('2024-01-01');
    expect(r.days_to_sell).toBe(91);
  });

  test('excludes cards sold before they were bought (negative days)', () => {
    const bought = [{ card_name: 'Weird', set_name: 'W', date_of_purchase: '2024-06-01' }];
    const sold   = [{ card_name: 'Weird', set_name: 'W', date_of_sale: '2024-01-01' }];
    expect(computeTimeToSell(bought, sold)).toHaveLength(0);
  });

  test('sorts by days_to_sell ASC (fastest first)', () => {
    const bought = [
      { card_name: 'Fast', set_name: 'X', date_of_purchase: '2024-01-01' },
      { card_name: 'Slow', set_name: 'X', date_of_purchase: '2024-01-01' },
    ];
    const sold = [
      { card_name: 'Fast', set_name: 'X', date_of_sale: '2024-01-05' },
      { card_name: 'Slow', set_name: 'X', date_of_sale: '2024-06-01' },
    ];
    const result = computeTimeToSell(bought, sold);
    expect(result[0].card_name).toBe('Fast');
    expect(result[1].card_name).toBe('Slow');
  });
});
