'use strict';

/**
 * Sort a shallow copy of `arr` by the given object key.
 *
 * @param {Object[]}          arr  - source array (never mutated)
 * @param {string}            key  - property name to sort by
 * @param {'str'|'num'}       type - 'num' uses numeric comparison; any other value falls
 *                                   back to locale-aware string comparison
 * @param {'asc'|'desc'}      dir  - sort direction; any unrecognised value is treated as 'asc'
 * @returns {Object[]} new sorted array
 */
function sortArray(arr, key, type, dir) {
  const d = dir === 'desc' ? -1 : 1;
  return [...arr].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    if (type === 'num') {
      return d * ((parseFloat(av) || 0) - (parseFloat(bv) || 0));
    }
    return d * String(av ?? '').localeCompare(String(bv ?? ''), undefined, {
      numeric: true,
      sensitivity: 'base',
    });
  });
}

module.exports = { sortArray };
