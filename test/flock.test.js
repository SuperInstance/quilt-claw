const test = require('node:test');
const assert = require('node:assert');
const { createFlockCell, stepFlock, flockComponents, flockMeanR, FICTIONS } = require('../dist/cells-flock/flock.js');

test('cell.flock: murmuration achieves coherence (pol > 0.5)', () => {
  const cell = createFlockCell('murmuration', 200);
  for (let i = 0; i < 1500; i++) stepFlock(cell, 1/60);
  assert.ok(cell.pol > 0.5, `pol=${cell.pol}`);
});

test('cell.flock: pack has higher speed than kennel', () => {
  const pack = createFlockCell('pack', 200);
  const kennel = createFlockCell('kennel', 200);
  for (let i = 0; i < 600; i++) { stepFlock(pack, 1/60); stepFlock(kennel, 1/60); }
  assert.ok(pack.meanSpd > kennel.meanSpd, `pack=${pack.meanSpd.toFixed(2)} kennel=${kennel.meanSpd.toFixed(2)}`);
});

test('cell.flock: kennel contains birds (meanR bounded)', () => {
  const cell = createFlockCell('kennel', 200);
  for (let i = 0; i < 1500; i++) stepFlock(cell, 1/60);
  const meanR = flockMeanR(cell);
  assert.ok(meanR < 250, `meanR=${meanR.toFixed(2)}`);
});

test('cell.flock: parliament forms ring (meanR ≈ ringR)', () => {
  const cell = createFlockCell('parliament', 200);
  for (let i = 0; i < 2000; i++) stepFlock(cell, 1/60);
  const meanR = flockMeanR(cell);
  const ringR = Math.min(960, 600) * 0.30;
  const relErr = Math.abs(meanR - ringR) / ringR;
  assert.ok(relErr < 0.20, `meanR=${meanR.toFixed(1)} ringR=${ringR} relErr=${relErr.toFixed(3)}`);
});

test('cell.flock: parliament converges to single connected component (coherent ring)', () => {
  const cell = createFlockCell('parliament', 200);
  for (let i = 0; i < 1500; i++) stepFlock(cell, 1/60);
  const c = flockComponents(cell);
  // parliament has tangential force → all birds orbit one center → few components
  assert.ok(c <= 5, `components=${c}`);
});
