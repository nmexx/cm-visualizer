/**
 * sortArray + SortableTable — extracted from renderer.js so either the
 * browser module (renderer) or Node tests (lib/sortUtils.js) can use the logic.
 */

/**
 * Return a sorted shallow copy of `arr` by the given property key.
 * Never mutates the source array.
 * @param {object[]}     arr
 * @param {string}       key   - object property to sort by
 * @param {'str'|'num'}  type
 * @param {'asc'|'desc'} dir
 * @returns {object[]}
 */
export function sortArray(arr, key, type, dir) {
  const d = dir === 'desc' ? -1 : 1;
  return [...arr].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    if (type === 'num') {
      return d * ((parseFloat(av) || 0) - (parseFloat(bv) || 0));
    }
    return d * String(av ?? '').localeCompare(String(bv ?? ''), undefined, {
      numeric: true, sensitivity: 'base',
    });
  });
}

/**
 * Attaches click-to-sort behaviour to a `.data-table`.
 *
 * @param {string}   tableId   - DOM id of the <table>
 * @param {Array<{key:string,type:'str'|'num'}|null>} cols
 *   One entry per <th>. null = not sortable (e.g. rank "#").
 * @param {(arr: object[]) => void} renderFn
 *   Called with the sorted array to re-render the tbody.
 * @param {() => object[]} getDataFn
 *   Returns the current canonical (unsorted) source array.
 */
export class SortableTable {
  constructor(tableId, cols, renderFn, getDataFn) {
    this.tableId   = tableId;
    this.cols      = cols;
    this.renderFn  = renderFn;
    this.getDataFn = getDataFn;
    this.sortCol   = -1;
    this.sortDir   = 'asc';
    this._init();
  }

  _init() {
    const table = document.getElementById(this.tableId);
    if (!table) { return; }
    table.querySelectorAll('thead th').forEach((th, i) => {
      if (!this.cols[i]) { return; }
      th.classList.add('sortable');
      th.addEventListener('click', () => this._sort(i));
    });
  }

  _sort(col) {
    const table = document.getElementById(this.tableId);
    if (!table || !this.cols[col]) { return; }
    this.sortDir = (this.sortCol === col && this.sortDir === 'asc') ? 'desc' : 'asc';
    this.sortCol = col;
    table.querySelectorAll('thead th').forEach((th, i) => {
      th.classList.remove('sort-asc', 'sort-desc');
      if (i === col) { th.classList.add('sort-' + this.sortDir); }
    });
    const { key, type } = this.cols[col];
    this.renderFn(sortArray(this.getDataFn(), key, type, this.sortDir));
  }

  /** Reset visual indicators and internal sort state (call when table structure changes). */
  reset() {
    this.sortCol = -1;
    this.sortDir = 'asc';
    const table = document.getElementById(this.tableId);
    if (table) {
      table.querySelectorAll('thead th').forEach(th => th.classList.remove('sort-asc', 'sort-desc'));
    }
  }

  /** Clear visual sort indicators only, preserving internal sort state (call when data reloads). */
  clearVisualsOnly() {
    const table = document.getElementById(this.tableId);
    if (table) {
      table.querySelectorAll('thead th').forEach(th => th.classList.remove('sort-asc', 'sort-desc'));
    }
  }
}
