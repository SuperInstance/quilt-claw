const test = require('node:test');
const assert = require('node:assert');
const { createPermCell, swap, twistBlock, recompute, subfactorial, walk } = require('../dist/cells-perm/perm.js');

test('cell.perm: identity at boot', () => {
  const c = createPermCell(6);
  assert.equal(c.inv, 0);
  assert.equal(c.cyc, 6);
  assert.equal(c.lisV, 6);
  assert.equal(c.fixed, 6);
  assert.equal(c.deranged, false);
});

test('cell.perm: subfactorial reference (!4=9, !6=265)', () => {
  assert.equal(subfactorial(4), 9);
  assert.equal(subfactorial(6), 265);
});

test('cell.perm: twist k=3 is a 3-cycle (inv 2, cyc n-2)', () => {
  const c = createPermCell(6);
  twistBlock(c, 3);
  assert.equal(c.inv, 2);
  assert.equal(c.cyc, c.n - 2);
  assert.equal(c.inv % 2, 0);
});

test('cell.perm: full twist is an n-cycle (deranged, one cycle)', () => {
  const c = createPermCell(6);
  twistBlock(c, c.n);
  assert.equal(c.deranged, true);
  assert.equal(c.cyc, 1);
  assert.equal(c.inv, c.n - 1);
});

test('cell.perm: adjacent swap then swap again returns (involution)', () => {
  const c = createPermCell(6);
  swap(c, 2);
  const d1 = c.inv;
  swap(c, 2);
  const d2 = c.inv;
  assert.equal(d1, 1);
  assert.equal(d2, 0);
});

test('cell.perm: random walk samples approximately n(n-1)/4 inversions', () => {
  const c = createPermCell(6);
  walk(c, 700);
  const mu = c.walkInv.reduce((a, x) => a + x, 0) / c.walkInv.length;
  const expected = c.n * (c.n - 1) / 4; // 7.5
  assert.ok(Math.abs(mu - expected) < 1.5, `mu=${mu.toFixed(2)} expected=${expected}`);
});
