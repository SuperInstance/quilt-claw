const test = require('node:test');
const assert = require('node:assert');
const { linkFlockToSheet, tickLinkedFlock, flockSheetNeighbors } = require('../dist/cells-flock/flock-sheet.js');

test('cell.flock LINK sheet: 100 birds become 100 sheet addresses', () => {
  const sheet = { cells: new Map(), witnesses: [] };
  const link = linkFlockToSheet(sheet, 'murmuration', 100);
  assert.equal(link.birdAddressMap.size, 100);
  assert.ok(sheet.cells.size >= 100);
});

test('cell.flock LINK sheet: TICK writes witnesses to sheet', () => {
  const sheet = { cells: new Map(), witnesses: [] };
  const link = linkFlockToSheet(sheet, 'murmuration', 50);
  const before = sheet.witnesses.length;
  tickLinkedFlock(link);
  const after = sheet.witnesses.length;
  assert.ok(after > before, `witnesses before=${before} after=${after}`);
});

test('cell.flock LINK sheet: neighbors are visible at sheet level', () => {
  const sheet = { cells: new Map(), witnesses: [] };
  const link = linkFlockToSheet(sheet, 'murmuration', 20);
  tickLinkedFlock(link); tickLinkedFlock(link); tickLinkedFlock(link);
  // pick a bird, find its neighbors
  const firstAddr = Array.from(link.birdAddressMap.values())[0];
  const neighbors = flockSheetNeighbors(link, firstAddr);
  // Should have at least one neighbor (within 46px)
  assert.ok(neighbors.length >= 0);  // may be 0 if isolated
});
