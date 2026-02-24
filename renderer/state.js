/**
 * Shared mutable state for all renderer modules.
 * Each property is mutated in place — modules import this object and read/write it.
 */
export const state = {
  charts:            {},
  currentData:       null,
  purchaseData:      null,
  analyticsData:     null,
  filters:           {},
  orderPage:         1,
  ordersDisplayBase: null,  // sorted override for orders table (null = canonical order)
  sortedInventory:   null,  // sorted override for inventory table
  sortedManabox:     null,  // sorted override for manabox table
  manaboxItems:      [],
};

export const PAGE_SIZE = 50;
