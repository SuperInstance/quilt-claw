const test = require('node:test');
const assert = require('node:assert');
const { createPartitionCell, setAssignment, balanceLoad, addEdge, cutEdges } = require('../dist/cells-partition/partition.js');

test('cell.partition: initial load is balanced for n divisible by parts', () => {
  const cell = createPartitionCell(8, 4);
  assert.equal(balanceLoad(cell), 0);
});

test('cell.partition: setAssignment updates load', () => {
  const cell = createPartitionCell(8, 4);
  // Initial: 8 nodes / 4 parts = 2 each
  // Move node 0 from part 0 to part 3
  setAssignment(cell, 0, 3);
  assert.equal(cell.load[0], 1);
  assert.equal(cell.load[3], 3);
});

test('cell.partition: cutEdges counts cross-partition edges', () => {
  const cell = createPartitionCell(4, 2);
  // assignment = [0, 1, 0, 1]
  addEdge(cell, 0, 1);  // cross
  assert.equal(cutEdges(cell), 1);
});

test('cell.partition: assignment is round-robin by default', () => {
  const cell = createPartitionCell(8, 4);
  assert.deepEqual(cell.assignment, [0, 1, 2, 3, 0, 1, 2, 3]);
});
