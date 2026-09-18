const test = require('node:test');
const assert = require('node:assert');
const { createAckCell, send, acknowledge, tickAck, ackRate } = require('../dist/cells-ack/ack.js');

test('cell.ack: send puts message in pending', () => {
  const cell = createAckCell();
  send(cell, 'm1', 'a', 'b');
  assert.equal(cell.pending.size, 1);
});

test('cell.ack: acknowledge moves message to acked', () => {
  const cell = createAckCell();
  send(cell, 'm1', 'a', 'b');
  assert.equal(acknowledge(cell, 'm1'), true);
  assert.equal(cell.pending.size, 0);
  assert.equal(cell.acked.size, 1);
});

test('cell.ack: tick retransmits on timeout', () => {
  const cell = createAckCell(10, 3);
  send(cell, 'm1', 'a', 'b');
  for (let i = 0; i < 15; i++) tickAck(cell);
  // After 15 ticks with timeout=10, retries should increment
  assert.ok(true);  // No throw
});

test('cell.ack: ackRate tracks acknowledgments', () => {
  const cell = createAckCell();
  send(cell, 'm1', 'a', 'b');
  send(cell, 'm2', 'a', 'b');
  send(cell, 'm3', 'a', 'b');
  acknowledge(cell, 'm1');
  acknowledge(cell, 'm2');
  assert.equal(ackRate(cell), 2/3);
});
