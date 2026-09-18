const test = require('node:test');
const assert = require('node:assert');
const { createChaosCell, stepChaos, injectChaos, resetChaos } = require('../dist/cells-chaos/chaos.js');

test('cell.chaos: initial chaos rate set', () => {
  const cell = createChaosCell(0.3, 0.95, 0.05);
  assert.equal(cell.current, 0.3);
});

test('cell.chaos: chaos decays toward minimum over many steps', () => {
  const cell = createChaosCell(1.0, 0.95, 0.05);
  for (let i = 0; i < 200; i++) stepChaos(cell, 0);
  assert.ok(cell.current <= 0.06, `current=${cell.current}`);
  assert.ok(cell.current >= 0.05, `current=${cell.current}`);
});

test('cell.chaos: high adaptation accelerates decay', () => {
  const cell = createChaosCell(1.0, 0.95, 0.05);
  for (let i = 0; i < 50; i++) stepChaos(cell, 1.0);  // perfect adaptation
  assert.ok(cell.current <= 0.1, `current=${cell.current}`);
});

test('cell.chaos: injectChaos returns boolean and records events', () => {
  const cell = createChaosCell(1.0, 0.95, 0.05);
  let rng = () => 0.0; // always inject
  const injected = injectChaos(cell, rng);
  assert.equal(injected, true);
  assert.ok(cell.events.length > 0);
});

test('cell.chaos: resetChaos returns to initial', () => {
  const cell = createChaosCell(0.3, 0.95, 0.05);
  for (let i = 0; i < 100; i++) stepChaos(cell, 1.0);
  resetChaos(cell);
  assert.equal(cell.current, 0.3);
  assert.equal(cell.stepCount, 0);
});
