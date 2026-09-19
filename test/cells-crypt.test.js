const test = require('node:test');
const assert = require('node:assert');
const { createCryptCell, generateKeypair, witness, verifyChain, detectTamper, rootHash, witnessAt, countByOp, witnessesBetween, forget, replay } = require('../dist/cells-crypt/crypt.js');

test('cell.crypt: generate keypair', () => {
  const kp = generateKeypair();
  assert.equal(kp.secretKey.length, 32);
  assert.equal(kp.publicKey.length, 64); // hex sha256
});

test('cell.crypt: create empty cell', () => {
  const c = createCryptCell('test');
  assert.equal(c.witnesses.length, 0);
});

test('cell.crypt: witness creates hash-chained entry', () => {
  const c = createCryptCell('test');
  const w = witness(c, 'BIND', 'hello');
  assert.equal(w.hash.length, 64);
  assert.equal(w.prevHash, '0'.repeat(64));
  assert.equal(w.signature.length, 64);
});

test('cell.crypt: subsequent witnesses chain to previous', () => {
  const c = createCryptCell('test');
  const w1 = witness(c, 'BIND', 'one');
  const w2 = witness(c, 'LINK', 'two');
  assert.equal(w2.prevHash, w1.hash);
});

test('cell.crypt: verifyChain returns valid for untampered', () => {
  const c = createCryptCell('test');
  witness(c, 'BIND', 'a');
  witness(c, 'LINK', 'b');
  witness(c, 'EFFECT', 'c');
  const r = verifyChain(c);
  assert.equal(r.valid, true);
  assert.equal(r.brokenAt, null);
});

test('cell.crypt: verifyChain detects tampered data', () => {
  const c = createCryptCell('test');
  witness(c, 'BIND', 'original');
  c.witnesses[0].data = 'tampered';
  const r = verifyChain(c);
  assert.equal(r.valid, false);
  assert.equal(r.brokenAt, 0);
});

test('cell.crypt: detectTamper finds bad signature', () => {
  const c = createCryptCell('test');
  witness(c, 'BIND', 'a');
  witness(c, 'LINK', 'b');
  c.witnesses[1].signature = '0'.repeat(64);
  const bad = detectTamper(c);
  assert.ok(bad);
  assert.equal(bad.op, 'LINK');
});

test('cell.crypt: rootHash is latest witness hash', () => {
  const c = createCryptCell('test');
  assert.equal(rootHash(c), '0'.repeat(64));
  const w = witness(c, 'BIND', 'a');
  assert.equal(rootHash(c), w.hash);
});

test('cell.crypt: witnessAt returns by index', () => {
  const c = createCryptCell('test');
  witness(c, 'BIND', 'a');
  witness(c, 'LINK', 'b');
  assert.equal(witnessAt(c, 0).data, 'a');
  assert.equal(witnessAt(c, 1).data, 'b');
  assert.equal(witnessAt(c, 99), null);
});

test('cell.crypt: countByOp filters', () => {
  const c = createCryptCell('test');
  witness(c, 'BIND', 'a');
  witness(c, 'BIND', 'b');
  witness(c, 'LINK', 'c');
  assert.equal(countByOp(c, 'BIND'), 2);
  assert.equal(countByOp(c, 'LINK'), 1);
  assert.equal(countByOp(c, 'EFFECT'), 0);
});

test('cell.crypt: witnessesBetween filters by time', () => {
  const c = createCryptCell('test');
  const before = Date.now();
  witness(c, 'BIND', 'a');
  witness(c, 'LINK', 'b');
  const after = Date.now();
  const all = witnessesBetween(c, before - 1000, after + 1000);
  assert.equal(all.length, 2);
  const none = witnessesBetween(c, after + 1000, after + 2000);
  assert.equal(none.length, 0);
});

test('cell.crypt: forget removes oldest n', () => {
  const c = createCryptCell('test');
  witness(c, 'BIND', 'a');
  witness(c, 'LINK', 'b');
  witness(c, 'EFFECT', 'c');
  const removed = forget(c, 2);
  assert.equal(removed.length, 2);
  assert.equal(c.witnesses.length, 1);
  assert.equal(c.witnesses[0].data, 'c');
});

test('cell.crypt: replay returns copy', () => {
  const c = createCryptCell('test');
  witness(c, 'BIND', 'a');
  const replayed = replay(c);
  assert.notEqual(replayed, c.witnesses); // different array
  assert.equal(replayed.length, 1);
});
