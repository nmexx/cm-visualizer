/**
 * Order details modal — shows cards from a specific order with search and pagination.
 */
import { state, PAGE_SIZE } from './state.js';
import { fmt, esc, rarityBadge, toast } from './utils.js';

const modal = document.getElementById('order-details-modal');
const modalTitle = document.getElementById('order-details-modal-title');
const closeBtn = document.getElementById('order-details-modal-close');
const searchInput = document.getElementById('order-items-search');
const table = document.getElementById('order-items-table');
const pageInfo = document.getElementById('order-items-page-info');
const prevBtn = document.getElementById('order-items-prev');
const nextBtn = document.getElementById('order-items-next');

let filteredItems = [];

/**
 * Show order details modal for a specific order
 */
export async function showOrderDetails(order_id, type, orderDescription = '') {
  state.orderDetailsPage = 1;
  
  try {
    const result = await window.mtg.getOrderItems({ order_id, type });
    
    if (!result.ok) {
      toast('Failed to load order items: ' + (result.error || 'Unknown error'), 'error');
      return;
    }
    
    state.orderDetailsItems = result.items || [];
    state.orderDetailsInfo = result.orderInfo || {};
    
    // Update modal title
    const typeLabel = type === 'purchase' ? 'Purchase' : 'Sale';
    modalTitle.textContent = `${typeLabel} Order ${order_id}${orderDescription ? ' — ' + orderDescription : ''}`;
    
    // Reset search
    searchInput.value = '';
    filteredItems = [...state.orderDetailsItems];
    
    renderItems();
    modal.style.display = 'flex';
  } catch (e) {
    toast('Error loading order: ' + e.message, 'error');
  }
}

function renderItems() {
  // Apply search filter
  const query = searchInput.value.toLowerCase().trim();
  if (query) {
    filteredItems = state.orderDetailsItems.filter(item =>
      (item.card_name || '').toLowerCase().includes(query) ||
      (item.set_name || '').toLowerCase().includes(query) ||
      (item.rarity || '').toLowerCase().includes(query)
    );
  } else {
    filteredItems = [...state.orderDetailsItems];
  }
  
  // Calculate pagination
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  if (state.orderDetailsPage > totalPages) {
    state.orderDetailsPage = totalPages;
  }
  
  const start = (state.orderDetailsPage - 1) * PAGE_SIZE;
  const slice = filteredItems.slice(start, start + PAGE_SIZE);
  
  // Render table rows
  table.querySelector('tbody').innerHTML = slice.map((item, i) => `
    <tr>
      <td class="dim">${start + i + 1}</td>
      <td data-card-name="${esc(item.card_name)}" data-set-name="${esc(item.set_name)}">${esc(item.card_name)}</td>
      <td class="dim">${esc(item.set_name)}</td>
      <td>${rarityBadge(item.rarity)}</td>
      <td class="mono">${item.quantity || 1}</td>
      <td class="mono">${fmt(item.price)}</td>
      <td class="mono gold">${fmt(item.total)}</td>
    </tr>
  `).join('');
  
  // Update pagination info
  pageInfo.textContent = `${filteredItems.length} item${filteredItems.length !== 1 ? 's' : ''} · page ${state.orderDetailsPage} / ${totalPages}`;
  prevBtn.disabled = state.orderDetailsPage <= 1;
  nextBtn.disabled = state.orderDetailsPage >= totalPages;
}

// Event handlers
closeBtn.addEventListener('click', () => {
  modal.style.display = 'none';
});

modal.addEventListener('click', (e) => {
  if (e.target === modal) {
    modal.style.display = 'none';
  }
});

searchInput.addEventListener('input', () => {
  state.orderDetailsPage = 1;
  renderItems();
});

prevBtn.addEventListener('click', () => {
  if (state.orderDetailsPage > 1) {
    state.orderDetailsPage--;
    renderItems();
  }
});

nextBtn.addEventListener('click', () => {
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  if (state.orderDetailsPage < totalPages) {
    state.orderDetailsPage++;
    renderItems();
  }
});
