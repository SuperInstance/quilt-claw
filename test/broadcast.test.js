const test = require('node:test');
const assert = require('node:assert');
const { createBroadcastCell, addNode, broadcast, tickBroadcast } = require('../dist/cells-broadcast/broadcast.js');

test('cell.broadcast: message spreads through gossip', () => {
  const cell = createBroadcastCell(10);
  addNode(cell, 'a', ['b', 'c']);
  addNode(cell, 'b', ['a', 'd']);
  addNode(cell, 'c', ['a', 'd']);
  addNode(cell, 'd', ['b', 'c', 'e']);
  addNode(cell, 'e', ['d']);
  tickBroadcast(cell);
  const delivered = broadcast(cell, 'a', 'msg1');
  assert.equal(delivered, 5);
});

test('cell.broadcast: TTL bounds propagation', () => {
  const cell = createBroadcastCell(2);  // only 2 hops
  addNode(cell, 'a', ['b']);
  addNode(cell, 'b', ['c']);
  addNode(cell, 'c', ['d']);
  addNode(cell, 'd', ['e']);
  addNode(cell, 'e', []);
  tickBroadcast(cell);
  const delivered = broadcast(cell, 'a', 'msg2');
  // With TTL=2 and fanout=3 default, only a/b/c should get it
  assert.ok(delivered >= 2);
  assert.ok(delivered <= 4);
});

test('cell.broadcast: peer reciprocity', () => {
  const cell = createBroadcastCell();
  addNode(cell, 'x', ['y']);
  // y should now have x in its peers
  assert.ok(cell.nodes.get('y').peers.has('x'));
});
