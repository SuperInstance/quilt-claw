const test = require('node:test');
const assert = require('node:assert');
const { createDyingCell, tickDyingCell, witnessCount, isAlive } = require('../dist/cells-death/death.js');

test('cell.death: young cell TICKs without death', () => {
  const cell = createDyingCell(10000);
  for (let i = 0; i < 10; i++) tickDyingCell(cell);
  assert.equal(cell.state, 'alive');
  assert.equal(witnessCount(cell), 10);
});

test('cell.death: expired cell dies on next TICK', async () => {
  const cell = createDyingCell(50);  // 50ms lifespan
  await new Promise(r => setTimeout(r, 60));
  tickDyingCell(cell);
  assert.equal(cell.state, 'dead');
});

test('cell.death: dead cell is garbage-collectable', async () => {
  const cell = createDyingCell(30);
  await new Promise(r => setTimeout(r, 40));
  tickDyingCell(cell);
  // log cleared after death
  assert.equal(witnessCount(cell), 0);
  assert.equal(isAlive(cell), false);
});

test('cell.death: dead cell does not TICK further', async () => {
  const cell = createDyingCell(20);
  await new Promise(r => setTimeout(r, 30));
  tickDyingCell(cell);
  const before = witnessCount(cell);
  tickDyingCell(cell); tickDyingCell(cell); tickDyingCell(cell);
  assert.equal(witnessCount(cell), before);  // no more witnesses
});
