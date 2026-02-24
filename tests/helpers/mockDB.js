'use strict';

/**
 * Lightweight in-memory database mock that exposes the subset of the
 * better-sqlite3 synchronous API used by lib/importer.js.
 *
 * Backed by plain JavaScript Maps/arrays so no native binaries are needed.
 */

class MockStatement {
  constructor(db, sql) {
    this._db  = db;
    this._sql = sql.trim();
  }

  /**
   * Determine which table a DML statement targets, then dispatch to the
   * appropriate in-memory store.
   */
  run(...args) {
    const sql = this._sql.toUpperCase();

    // --- DELETE FROM order_items WHERE order_id = ? ---
    if (sql.startsWith('DELETE FROM ORDER_ITEMS')) {
      const [order_id] = args;
      this._db._items = this._db._items.filter(i => i.order_id !== order_id);
      return;
    }

    // --- INSERT OR REPLACE INTO orders ---
    if (sql.includes('INTO ORDERS')) {
      const [
        order_id, username, buyer_name, city, country, is_professional,
        date_of_purchase, article_count, merchandise_value, shipment_costs,
        total_value, commission, currency, source_file,
      ] = args;

      // REPLACE semantics: delete existing then insert
      this._db._orders.delete(order_id);
      this._db._orders.set(order_id, {
        order_id, username, buyer_name, city, country, is_professional,
        date_of_purchase, article_count, merchandise_value, shipment_costs,
        total_value, commission, currency, source_file,
      });
      return;
    }

    // --- INSERT INTO order_items ---
    if (sql.includes('INTO ORDER_ITEMS')) {
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

    throw new Error(`MockStatement.run: unhandled SQL: ${this._sql}`);
  }

  /** SELECT … WHERE order_id = ? */
  get(...args) {
    const sql = this._sql.toUpperCase();

    if (sql.includes('FROM ORDERS') && sql.includes('WHERE')) {
      const [order_id] = args;
      return this._db._orders.get(order_id) || undefined;
    }

    throw new Error(`MockStatement.get: unhandled SQL: ${this._sql}`);
  }

  /** SELECT * FROM order_items WHERE order_id = ? */
  all(...args) {
    const sql = this._sql.toUpperCase();

    if (sql.includes('FROM ORDER_ITEMS')) {
      const [order_id] = args;
      return order_id
        ? this._db._items.filter(i => i.order_id === order_id)
        : [...this._db._items];
    }

    if (sql.includes("FROM ORDERS WHERE ORDER_ID = '")) {
      // inline literal (used in test helpers)
      const match = this._sql.match(/'([^']+)'/);
      const id    = match ? match[1] : null;
      return id ? [this._db._orders.get(id)].filter(Boolean) : [];
    }

    if (sql.includes('FROM ORDERS')) {
      return [...this._db._orders.values()];
    }

    throw new Error(`MockStatement.all: unhandled SQL: ${this._sql}`);
  }
}

class MockDB {
  constructor() {
    this._orders = new Map();   // order_id → row object
    this._items  = [];          // array of item row objects
    this._nextId = 0;
  }

  prepare(sql) {
    return new MockStatement(this, sql);
  }

  /**
   * better-sqlite3 transaction wraps a function; we call it synchronously.
   */
  transaction(fn) {
    return fn;   // fn will be called immediately by the importer
  }

  // ── Inspection helpers (not part of the real API) ──────────────────────
  allOrders() { return [...this._orders.values()]; }
  allItems()  { return [...this._items]; }
  getOrder(id) { return this._orders.get(id); }
  getItemsFor(order_id) { return this._items.filter(i => i.order_id === order_id); }
}

module.exports = { MockDB };
