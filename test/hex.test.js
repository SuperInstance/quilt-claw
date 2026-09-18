const test = require('node:test');
const assert = require('node:assert');
const { createHexCell, setTheta, lambda, snapNext, computeWindows } = require('../dist/cells-hex/hex.js');

test('cell.hex: lambda identity holds for arbitrary theta', () => {
  const cell = createHexCell(28);
  setTheta(cell, 1.5 * Math.PI / 180);
  const expected = cell.s / (2 * Math.sin((1.5 * Math.PI) / 360));
  assert.ok(Math.abs(lambda(cell) - expected) < 1e-9, `λ=${lambda(cell)} expect=${expected}`);
});

test('cell.hex: commensuration teeth found (4..12)', () => {
  const cell = createHexCell(28);
  computeWindows(cell, 10, 0.1);
  assert.ok(cell.windows.length >= 4 && cell.windows.length <= 12, `windows=${cell.windows.length}`);
});

test('cell.hex: ledger S finite in [0, 1]', () => {
  const cell = createHexCell(28);
  setTheta(cell, 0.5 * Math.PI / 180);
  assert.ok(Number.isFinite(cell.S) && cell.S >= 0 && cell.S <= 1, `S=${cell.S}`);
});

test('cell.hex: magic windows align with S dips (not peaks)', () => {
  const cell = createHexCell(28);
  computeWindows(cell, 10, 0.1);
  const teeth = cell.windows.map(w => w[0] * 180 / Math.PI).sort((a, b) => a - b);
  if (teeth.length > 2) {
    const t1 = teeth[2];
    setTheta(cell, t1 * Math.PI / 180);
    const sTooth = cell.S;
    setTheta(cell, (t1 - 0.35) * Math.PI / 180);
    const sTrough = cell.S;
    assert.ok(sTooth < sTrough, `tooth S=${sTooth.toFixed(3)} trough S=${sTrough.toFixed(3)}`);
  }
});

test('cell.hex: snap advances theta to next window', () => {
  const cell = createHexCell(28);
  computeWindows(cell, 10, 0.1);
  setTheta(cell, 0);
  const before = cell.theta;
  snapNext(cell);
  assert.ok(cell.theta > before, `before=${before} after=${cell.theta}`);
});
