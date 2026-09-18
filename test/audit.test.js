const test = require('node:test');
const assert = require('node:assert');
const { createAuditCell, detectGaps, merkleRoot, detectAnomalies, completeness } = require('../dist/cells-audit/audit.js');

test('cell.audit: complete log has no gaps', () => {
  const log = [];
  for (let i = 0; i < 10; i++) log.push({ type: 'BIND', address: String(i), t: i });
  const cell = createAuditCell(log);
  assert.deepEqual(detectGaps(cell), []);
});

test('cell.audit: detects missing witnesses', () => {
  const log = [
    { type: 'BIND', address: '0', t: 0 },
    { type: 'BIND', address: '1', t: 1 },
    { type: 'BIND', address: '3', t: 3 },  // gap at 2
    { type: 'BIND', address: '5', t: 5 },  // gap at 4
  ];
  const cell = createAuditCell(log);
  assert.deepEqual(detectGaps(cell), [2, 4]);
});

test('cell.audit: merkle root is deterministic', () => {
  const log = [{ type: 'BIND', address: '0', t: 0 }];
  const cell1 = createAuditCell(log);
  const cell2 = createAuditCell(log);
  assert.equal(merkleRoot(cell1), merkleRoot(cell2));
});

test('cell.audit: detectAnomalies finds wrong-type witnesses', () => {
  const log = [
    { type: 'BIND', address: '0', t: 0 },
    { type: 'FORGET', address: '1', t: 1 },  // anomaly
    { type: 'BIND', address: '2', t: 2 },
  ];
  const cell = createAuditCell(log);
  const anomalies = detectAnomalies(cell, 'BIND');
  assert.equal(anomalies.length, 1);
  assert.equal(anomalies[0].type, 'FORGET');
});

test('cell.audit: completeness ratio correct', () => {
  const log = Array.from({length: 7}, (_, i) => ({ type: 'BIND', address: String(i), t: i }));
  const cell = createAuditCell(log, 10);
  assert.equal(completeness(cell), 0.7);
});
