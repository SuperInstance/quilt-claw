const test = require('node:test');
const assert = require('node:assert');
const { createSwarmCell, addNeighbor, removeNeighbor, neighborCount, send, receive, broadcast, toColumnar, fromColumnar, shortestPath, reachableIn, pendingCount, receivedCount } = require('../dist/cells-swarm/swarm.js');

test('cell.swarm: create empty cell', () => {
  const c = createSwarmCell();
  assert.equal(c.messages.length, 0);
  assert.equal(c.receivedMessages.length, 0);
  assert.equal(neighborCount(c), 0);
});

test('cell.swarm: addNeighbor + neighborCount', () => {
  const c = createSwarmCell();
  addNeighbor(c, 'a');
  addNeighbor(c, 'b');
  addNeighbor(c, 'a'); // duplicate
  assert.equal(neighborCount(c), 2);
});

test('cell.swarm: removeNeighbor', () => {
  const c = createSwarmCell();
  addNeighbor(c, 'a');
  addNeighbor(c, 'b');
  removeNeighbor(c, 'a');
  assert.equal(neighborCount(c), 1);
});

test('cell.swarm: send queues message', () => {
  const c = createSwarmCell('sender');
  send(c, 'recv', 'hello');
  assert.equal(pendingCount(c), 1);
});

test('cell.swarm: receive accepts matching message', () => {
  const c = createSwarmCell('recv');
  const msg = { from: 'a', to: 'recv', payload: 'hi', timestamp: 1, hops: 0 };
  assert.equal(receive(c, msg), true);
  assert.equal(receivedCount(c), 1);
});

test('cell.swarm: receive rejects non-matching', () => {
  const c = createSwarmCell('recv');
  const msg = { from: 'a', to: 'OTHER', payload: 'hi', timestamp: 1, hops: 0 };
  assert.equal(receive(c, msg), false);
});

test('cell.swarm: receive deduplicates', () => {
  const c = createSwarmCell('recv');
  const msg = { from: 'a', to: 'recv', payload: 'hi', timestamp: 1, hops: 0 };
  receive(c, msg);
  assert.equal(receive(c, msg), false); // duplicate
});

test('cell.swarm: broadcast fan-out to neighbors', () => {
  const c = createSwarmCell('hub');
  addNeighbor(c, 'a');
  addNeighbor(c, 'b');
  addNeighbor(c, 'c');
  const msgs = broadcast(c, 'hello');
  assert.equal(msgs.length, 3);
});

test('cell.swarm: toColumnar extracts schema', () => {
  const msgs = [
    { from: 'a', to: 'b', payload: 'hi', timestamp: 1, hops: 0 },
    { from: 'c', to: 'd', payload: 'yo', timestamp: 2, hops: 1 }
  ];
  const col = toColumnar(msgs);
  assert.equal(col.columnNames.length, 5);
  assert.equal(col.columns[0].length, 2);
});

test('cell.swarm: fromColumnar reconstructs', () => {
  const msgs = [
    { from: 'a', to: 'b', payload: 'hi', timestamp: 1, hops: 0 }
  ];
  const col = toColumnar(msgs);
  const reconstructed = fromColumnar(col);
  assert.equal(reconstructed.length, 1);
  assert.equal(reconstructed[0].from, 'a');
});

test('cell.swarm: shortestPath finds direct path', () => {
  const graph = new Map();
  graph.set('a', new Set(['b']));
  graph.set('b', new Set(['a', 'c']));
  const c = createSwarmCell('a');
  const path = shortestPath(c, 'a', 'c', graph);
  assert.deepEqual(path, ['a', 'b', 'c']);
});

test('cell.swarm: shortestPath returns null when unreachable', () => {
  const graph = new Map();
  graph.set('a', new Set());
  graph.set('b', new Set());
  const c = createSwarmCell('a');
  const path = shortestPath(c, 'a', 'b', graph);
  assert.equal(path, null);
});

test('cell.swarm: reachableIn finds all within N hops', () => {
  const graph = new Map();
  graph.set('a', new Set(['b']));
  graph.set('b', new Set(['a', 'c']));
  graph.set('c', new Set(['b', 'd']));
  const c = createSwarmCell('a');
  const r2 = reachableIn(c, 2, graph);
  assert.ok(r2.has('a'));
  assert.ok(r2.has('b'));
  assert.ok(r2.has('c'));
  assert.ok(!r2.has('d'));
});
