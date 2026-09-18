const test = require('node:test');
const assert = require('node:assert');
const { createNeighborCell, addPoint, buildGraph, degreeDistribution, meanDegree, components } = require('../dist/cells-neighbor/neighbor.js');

test('cell.neighbor: 4 points in a line connect linearly', () => {
  const cell = createNeighborCell(1.5);
  addPoint(cell, 0, 0); addPoint(cell, 1, 0); addPoint(cell, 2, 0); addPoint(cell, 3, 0);
  buildGraph(cell);
  assert.equal(cell.edges.length, 3);
});

test('cell.neighbor: degree distribution matches expected', () => {
  const cell = createNeighborCell(1.5);
  for (let i = 0; i < 4; i++) addPoint(cell, i, 0);
  buildGraph(cell);
  const dist = degreeDistribution(cell);
  // 4 nodes in a line, each interior has 2 neighbors, end has 1
  assert.equal(dist.get(2), 2);  // 2 interior nodes
  assert.equal(dist.get(1), 2);  // 2 endpoint nodes
});

test('cell.neighbor: connected components counts clusters', () => {
  const cell = createNeighborCell(1.0);
  addPoint(cell, 0, 0); addPoint(cell, 0.5, 0);  // cluster A
  addPoint(cell, 10, 0); addPoint(cell, 10.5, 0);  // cluster B
  buildGraph(cell);
  assert.equal(components(cell), 2);
});

test('cell.neighbor: mean degree for random grid', () => {
  const cell = createNeighborCell(1.5);
  for (let i = 0; i < 25; i++) {
    const x = (i % 5) * 1.0;
    const y = Math.floor(i / 5) * 1.0;
    addPoint(cell, x, y);
  }
  buildGraph(cell);
  const md = meanDegree(cell);
  assert.ok(md > 0 && md < 8, `meanDegree=${md}`);
});
