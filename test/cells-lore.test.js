const test = require('node:test');
const assert = require('node:assert');
const { createLoreCell, scanFiles, recordSnapshot, scanDebtMarkers, latestSnapshot, debtByType, totalDebt, topLanguages, biggestFiles, debtHotspots, growthRate, summary } = require('../dist/cells-lore/lore.js');

test('cell.lore: empty cell has no snapshots', () => {
  const c = createLoreCell();
  assert.equal(c.snapshots.length, 0);
  assert.equal(summary(c), 'no snapshot');
});

test('cell.lore: scanDebtMarkers finds TODO', () => {
  const content = '// TODO: fix this\nconst x = 1;\n';
  const m = scanDebtMarkers(content);
  assert.equal(m.length, 1);
  assert.equal(m[0].type, 'TODO');
});

test('cell.lore: scanDebtMarkers finds multiple types', () => {
  const content = '// TODO: thing\n// FIXME: bug\n// HACK: workaround\n';
  const m = scanDebtMarkers(content);
  assert.equal(m.length, 3);
});

test('cell.lore: scanFiles aggregates language counts', () => {
  const files = [
    { path: 'a.py', content: 'print(1)\n', size: 9 },
    { path: 'b.py', content: 'print(2)\n', size: 9 },
    { path: 'c.js', content: 'console.log(1);\n', size: 17 }
  ];
  const s = scanFiles(files, '/test');
  assert.equal(s.languages.get('Python'), 2);
  assert.equal(s.languages.get('JavaScript'), 1);
});

test('cell.lore: scanFiles counts total lines', () => {
  const files = [
    { path: 'a.py', content: 'line1\nline2\nline3', size: 18 },
    { path: 'b.py', content: 'line4', size: 6 }
  ];
  const s = scanFiles(files, '/test');
  assert.equal(s.totalLines, 4);
});

test('cell.lore: recordSnapshot adds to history', () => {
  const c = createLoreCell();
  const s = scanFiles([], '/empty');
  recordSnapshot(c, s);
  assert.equal(c.snapshots.length, 1);
});

test('cell.lore: latestSnapshot returns most recent', () => {
  const c = createLoreCell();
  recordSnapshot(c, scanFiles([{ path: 'a.txt', content: 'one', size: 3 }], '/p'));
  recordSnapshot(c, scanFiles([{ path: 'a.txt', content: 'one', size: 3 }, { path: 'b.txt', content: 'two', size: 3 }], '/p'));
  const s = latestSnapshot(c);
  assert.equal(s.totalFiles, 2);
});

test('cell.lore: debtByType returns count', () => {
  const c = createLoreCell();
  const files = [
    { path: 'a.ts', content: '// TODO: x\n// TODO: y\n// FIXME: z\n', size: 30 }
  ];
  recordSnapshot(c, scanFiles(files, '/p'));
  assert.equal(debtByType(c, 'TODO'), 2);
  assert.equal(debtByType(c, 'FIXME'), 1);
  assert.equal(debtByType(c, 'HACK'), 0);
});

test('cell.lore: totalDebt sums all markers', () => {
  const c = createLoreCell();
  const files = [
    { path: 'a.ts', content: '// TODO\n// FIXME\n// HACK\n// XXX\n', size: 32 }
  ];
  recordSnapshot(c, scanFiles(files, '/p'));
  assert.equal(totalDebt(c), 4);
});

test('cell.lore: topLanguages sorts by count', () => {
  const c = createLoreCell();
  const files = [
    { path: 'a.py', content: '', size: 0 },
    { path: 'b.py', content: '', size: 0 },
    { path: 'c.py', content: '', size: 0 },
    { path: 'd.rs', content: '', size: 0 }
  ];
  recordSnapshot(c, scanFiles(files, '/p'));
  const top = topLanguages(c, 2);
  assert.equal(top[0][0], 'Python');
  assert.equal(top[0][1], 3);
});

test('cell.lore: biggestFiles sorts by size', () => {
  const c = createLoreCell();
  const files = [
    { path: 'a.txt', content: 'small', size: 5 },
    { path: 'b.txt', content: 'bigbigbigbigbig', size: 15 },
    { path: 'c.txt', content: 'med', size: 3 }
  ];
  recordSnapshot(c, scanFiles(files, '/p'));
  const big = biggestFiles(c);
  assert.equal(big[0].path, 'b.txt');
});

test('cell.lore: debtHotspots sorts by marker count', () => {
  const c = createLoreCell();
  const files = [
    { path: 'a.ts', content: '// TODO\n// FIXME\n', size: 20 },
    { path: 'b.ts', content: '// TODO\n', size: 10 }
  ];
  recordSnapshot(c, scanFiles(files, '/p'));
  const hot = debtHotspots(c);
  assert.equal(hot[0].path, 'a.ts');
});

test('cell.lore: growthRate computes lines/day', () => {
  const c = createLoreCell();
  // First snapshot now
  recordSnapshot(c, scanFiles([{ path: 'a.py', content: 'one', size: 3 }], '/p'));
  // Manually adjust timestamps
  c.snapshots[0].timestamp = 0;
  c.snapshots[0].totalLines = 100;
  // Add second snapshot 1 day later
  const s2 = scanFiles([{ path: 'a.py', content: 'one', size: 3 }], '/p');
  s2.timestamp = 24 * 60 * 60 * 1000;
  s2.totalLines = 200;
  recordSnapshot(c, s2);
  const rate = growthRate(c);
  assert.ok(rate > 0);
});

test('cell.lore: summary returns string', () => {
  const c = createLoreCell();
  recordSnapshot(c, scanFiles([{ path: 'a.py', content: '', size: 0 }], '/p'));
  const s = summary(c);
  assert.ok(s.includes('1 files'));
});
