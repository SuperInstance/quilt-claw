const test = require('node:test');
const assert = require('node:assert');
const { createPathosCell, snapshot, setTask, bumpUrgency, bumpFrustration, setSatisfaction, priority, isCritical, calm, summary } = require('../dist/cells-pathos/pathos.js');

test('cell.pathos: default state is calm', () => {
  const c = createPathosCell();
  assert.equal(c.state.urgency, 'low');
  assert.equal(c.state.frustration, 0);
});

test('cell.pathos: setTask records history', () => {
  const c = createPathosCell();
  setTask(c, 'deploy');
  assert.equal(c.state.task, 'deploy');
  assert.equal(c.state.urgency, 'medium');
  assert.equal(c.history.length, 1);
});

test('cell.pathos: bumpUrgency escalates', () => {
  const c = createPathosCell();
  setTask(c, 'x');
  bumpUrgency(c);
  bumpUrgency(c);
  assert.equal(c.state.urgency, 'critical');
  bumpUrgency(c); // capped
  assert.equal(c.state.urgency, 'critical');
});

test('cell.pathos: bumpFrustration scales 0..1', () => {
  const c = createPathosCell();
  bumpFrustration(c, 0.5);
  assert.equal(c.state.frustration, 0.5);
  bumpFrustration(c, 1);
  assert.equal(c.state.frustration, 1);
  bumpFrustration(c, -1);
  assert.equal(c.state.frustration, 0);
});

test('cell.pathos: high frustration escalates urgency', () => {
  const c = createPathosCell();
  bumpFrustration(c, 0.8);
  assert.equal(c.state.urgency, 'medium');
  bumpFrustration(c, 0.9);
  assert.equal(c.state.urgency, 'high');
});

test('cell.pathos: setSatisfaction(positive) calms', () => {
  const c = createPathosCell();
  bumpFrustration(c, 0.5);
  setSatisfaction(c, 'positive');
  assert.equal(c.state.frustration, 0.2);
});

test('cell.pathos: setSatisfaction(negative) angers', () => {
  const c = createPathosCell();
  setSatisfaction(c, 'negative');
  assert.equal(c.state.frustration, 0.2);
});

test('cell.pathos: priority scales with urgency + frustration', () => {
  const c = createPathosCell();
  const lowPri = priority(c);
  setTask(c, 'x');
  const medPri = priority(c);
  assert.ok(medPri > lowPri);
  bumpFrustration(c, 0.5);
  const highPri = priority(c);
  assert.ok(highPri > medPri);
});

test('cell.pathos: isCritical triggers at critical urgency', () => {
  const c = createPathosCell();
  assert.equal(isCritical(c), false);
  setTask(c, 'x');
  bumpUrgency(c); bumpUrgency(c); bumpUrgency(c);
  assert.equal(isCritical(c), true);
});

test('cell.pathos: isCritical triggers at high frustration + negative', () => {
  const c = createPathosCell();
  bumpFrustration(c, 0.96);
  setSatisfaction(c, 'negative');
  assert.equal(isCritical(c), true);
});

test('cell.pathos: calm resets state', () => {
  const c = createPathosCell();
  setTask(c, 'x');
  bumpFrustration(c, 0.9);
  calm(c);
  assert.equal(c.state.frustration, 0);
  assert.equal(c.state.urgency, 'low');
});

test('cell.pathos: summary includes state', () => {
  const c = createPathosCell('test');
  setTask(c, 'deploy');
  const s = summary(c);
  assert.ok(s.includes('test'));
  assert.ok(s.includes('deploy'));
  assert.ok(s.includes('medium'));
});
