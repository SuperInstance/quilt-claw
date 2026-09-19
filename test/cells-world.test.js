const test = require('node:test');
const assert = require('node:assert');
const { createWorldCell, predict, registerRoom, observeAndPredict, calibrateRoom, detectDrift, reset, recentErrors, averageError, roomCount } = require('../dist/cells-world/world.js');

test('cell.world: create empty cell', () => {
  const c = createWorldCell('w', { latentDim: 4, hiddenDim: 8 });
  assert.equal(roomCount(c), 0);
  assert.equal(c.errors.length, 0);
});

test('cell.world: predict returns vector of latentDim', () => {
  const c = createWorldCell('w', { latentDim: 4, hiddenDim: 8 });
  const p = predict(c, [0.1, 0.2, 0.3, 0.4]);
  assert.equal(p.length, 4);
});

test('cell.world: registerRoom adds room', () => {
  const c = createWorldCell('w', { latentDim: 3 });
  registerRoom(c, 'a', [1, 2, 3]);
  registerRoom(c, 'b', [4, 5, 6]);
  assert.equal(roomCount(c), 2);
});

test('cell.world: observeAndPredict returns error', () => {
  const c = createWorldCell('w', { latentDim: 3 });
  registerRoom(c, 'a', [1, 0, 0]);
  registerRoom(c, 'b', [0, 1, 0]);
  const pe = observeAndPredict(c, 'a', 'b');
  assert.ok(pe);
  assert.ok(typeof pe.error === 'number');
  assert.ok(pe.error > 0);
});

test('cell.world: observeAndPredict returns null if rooms missing', () => {
  const c = createWorldCell('w');
  const pe = observeAndPredict(c, 'a', 'b');
  assert.equal(pe, null);
});

test('cell.world: calibrateRoom adjusts latent', () => {
  const c = createWorldCell('w', { latentDim: 3 });
  registerRoom(c, 'a', [1, 0, 0]);
  registerRoom(c, 'b', [0, 1, 0]);
  for (let i = 0; i < 5; i++) observeAndPredict(c, 'a', 'b');
  const before = c.rooms.get('a').latent;
  calibrateRoom(c, 'a');
  const after = c.rooms.get('a').latent;
  assert.notDeepEqual(before, after);
});

test('cell.world: detectDrift triggers on high error', () => {
  const c = createWorldCell('w', { latentDim: 4, driftThreshold: 0.1 });
  registerRoom(c, 'a', [0, 0, 0, 0]);
  registerRoom(c, 'b', [10, 10, 10, 10]);
  for (let i = 0; i < 5; i++) observeAndPredict(c, 'a', 'b');
  assert.equal(detectDrift(c, 'b'), true);
});

test('cell.world: detectDrift returns false for no errors', () => {
  const c = createWorldCell('w');
  registerRoom(c, 'a', [1, 0]);
  assert.equal(detectDrift(c, 'a'), false);
});

test('cell.world: reset clears errors', () => {
  const c = createWorldCell('w', { latentDim: 3 });
  registerRoom(c, 'a', [1, 0, 0]);
  registerRoom(c, 'b', [0, 1, 0]);
  observeAndPredict(c, 'a', 'b');
  reset(c);
  assert.equal(c.errors.length, 0);
});

test('cell.world: recentErrors returns last N', () => {
  const c = createWorldCell('w', { latentDim: 2 });
  registerRoom(c, 'a', [1, 0]);
  registerRoom(c, 'b', [0, 1]);
  for (let i = 0; i < 15; i++) observeAndPredict(c, 'a', 'b');
  assert.equal(recentErrors(c, 5).length, 5);
  assert.equal(recentErrors(c, 100).length, 15);
});

test('cell.world: averageError computes mean', () => {
  const c = createWorldCell('w', { latentDim: 2 });
  registerRoom(c, 'a', [0, 0]);
  registerRoom(c, 'b', [1, 1]);
  observeAndPredict(c, 'a', 'b');
  observeAndPredict(c, 'a', 'b');
  const avg = averageError(c);
  assert.ok(avg > 0);
});
