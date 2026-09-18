const test = require('node:test');
const assert = require('node:assert');
const { createThermalCell, stepThermal } = require('../dist/cells-thermal/thermal.js');

test('cell.thermal: progress increases over time', () => {
  const cell = createThermalCell(10);
  let prev = 0;
  for (let i = 0; i < 100; i++) {
    const { mean_progress } = stepThermal(cell);
    assert.ok(mean_progress >= prev - 0.001, `mean_progress=${mean_progress} prev=${prev}`);
    prev = mean_progress;
  }
  assert.ok(prev > 0, `final progress=${prev}`);
});

test('cell.thermal: tasks complete eventually', () => {
  const cell = createThermalCell(5);
  for (let i = 0; i < 1000; i++) stepThermal(cell);
  const allDone = cell.tasks.every(t => t.done >= 1.0);
  assert.ok(allDone);
});

test('cell.thermal: temperature stays bounded', () => {
  const cell = createThermalCell(10);
  let maxT = 0;
  for (let i = 0; i < 100; i++) {
    const { mean_temp } = stepThermal(cell);
    maxT = Math.max(maxT, mean_temp);
  }
  assert.ok(maxT < 5, `max_temp=${maxT}`);
});
