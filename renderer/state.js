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
  topCardsPage:      1,     // pagination for top cards
  topCardsDisplayBase: null, // sorted override for top cards
  orderPage:         1,
  ordersDisplayBase: null,  // sorted override for orders table (null = canonical order)
  boughtCardsPage:   1,     // pagination for bought cards
  boughtCardsDisplayBase: null,  // sorted override for bought cards
  inventoryPage:     1,     // pagination for inventory
  inventoryDisplayBase: null,  // sorted override for inventory
  manaboxPage:       1,     // pagination for manabox inventory
  manaboxDisplayBase: null, // sorted override for manabox
  sortedInventory:   null,  // sorted override for inventory table
  sortedManabox:     null,  // sorted override for manabox table
  manaboxItems:      [],
  selectedBoughtCards: new Set(),  // card names marked for bulk exclusion from P&L
  orderDetailsPage:  1,     // pagination for order items detail modal
  orderDetailsItems: [],    // items (cards) from the currently viewed order
  orderDetailsInfo:  null,  // order info (seller, date, etc)
};

export const PAGE_SIZE = 50;
