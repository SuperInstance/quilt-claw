const test = require('node:test');
const assert = require('node:assert');
const { createTriageCell, detectDrift, submit, highestPriority, filterBySeverity, dedupByRepo, summary } = require('../dist/cells-triage/triage.js');

test('cell.triage: create empty cell', () => {
  const c = createTriageCell('test');
  assert.equal(c.id, 'test');
  assert.equal(c.reports.size, 0);
});

test('cell.triage: detectDrift assigns low severity when clean', () => {
  const r = detectDrift('repo-a', {});
  assert.equal(r.severity, 'low');
});

test('cell.triage: detectDrift assigns high on test regressions', () => {
  const r = detectDrift('repo-a', { testRegressions: ['test1', 'test2'] });
  assert.ok(['medium', 'high'].includes(r.severity));
});

test('cell.triage: detectDrift assigns critical on many issues', () => {
  const r = detectDrift('repo-a', {
    staleDeps: ['a', 'b', 'c', 'd', 'e'],
    testRegressions: ['t1', 't2'],
    licenseChange: 'MIT→Apache'
  });
  assert.equal(r.severity, 'critical');
});

test('cell.triage: submit stores report by repo', () => {
  const c = createTriageCell();
  const r = detectDrift('repo-a', { testRegressions: ['t1'] });
  submit(c, r);
  assert.equal(c.reports.size, 1);
});

test('cell.triage: highestPriority returns most severe', () => {
  const c = createTriageCell();
  submit(c, detectDrift('repo-low', {}));
  submit(c, detectDrift('repo-high', { testRegressions: ['t1', 't2', 't3'] }));
  const best = highestPriority(c);
  assert.equal(best.repo, 'repo-high');
});

test('cell.triage: filterBySeverity returns sorted', () => {
  const c = createTriageCell();
  submit(c, detectDrift('repo-a', {}));
  submit(c, detectDrift('repo-b', { testRegressions: ['t1', 't2'] }));
  const filtered = filterBySeverity(c, 'medium');
  assert.ok(filtered.length >= 1);
  assert.equal(filtered[0].repo, 'repo-b');
});

test('cell.triage: dedupByRepo keeps highest severity', () => {
  const c = createTriageCell();
  submit(c, detectDrift('repo-a', {}));
  submit(c, detectDrift('repo-a', { testRegressions: ['t1', 't2', 't3'] }));
  dedupByRepo(c);
  assert.equal(c.reports.size, 1);
  assert.equal(c.reports.get('repo-a').severity, 'high');
});

test('cell.triage: summary counts per severity', () => {
  const c = createTriageCell();
  submit(c, detectDrift('repo-a', {}));
  submit(c, detectDrift('repo-b', { testRegressions: ['t1'] }));
  const s = summary(c);
  assert.ok(s.low + s.medium + s.high + s.critical === 2);
});
