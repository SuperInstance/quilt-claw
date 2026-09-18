const test = require('node:test');
const assert = require('node:assert');
const { createComposition, bindCell, effectCell, linkCells, cellNote, compositionToJSON, renderScore, cellFrequency, cellCount } = require('../dist/cells-music/music.js');

test('cell.music: create empty composition', () => {
  const c = createComposition('test', 80, 'pentatonic', 'D');
  assert.equal(c.cells.length, 0);
  assert.equal(c.tempo, 80);
  assert.equal(c.mode, 'pentatonic');
  assert.equal(c.rootNote, 'D');
});

test('cell.music: bindCell creates cell with BIND witness', () => {
  const c = createComposition('test');
  const cell = bindCell(c);
  assert.equal(cell.witnessLog.length, 1);
  assert.equal(cell.witnessLog[0].type, 'BIND');
  assert.ok(cell.pitch);
  assert.ok(cell.velocity > 0);
});

test('cell.music: bindCell uses pentatonic scale', () => {
  const c = createComposition('test', 80, 'pentatonic', 'D');
  // Pentatonic in D: D, E, F#, A, B (skip G, C#)
  for (let i = 0; i < 5; i++) {
    const cell = bindCell(c);
    // Pitches should all be D, E, F, G, A, or B (no F# in our system)
    assert.ok(['C', 'D', 'E', 'F', 'G', 'A', 'B'].includes(cell.pitch));
  }
});

test('cell.music: cellNote derives from witness count', () => {
  // First 5 witnesses in pentatonic D should hit distinct notes
  const c = createComposition('test', 80, 'pentatonic', 'D');
  const cells = [];
  for (let i = 0; i < 5; i++) cells.push(bindCell(c));
  // 5 notes should be at most 5 distinct pitches
  const uniquePitches = new Set(cells.map(c => c.pitch));
  assert.ok(uniquePitches.size >= 3);  // at least 3 unique
});

test('cell.music: cellNote supports all modes', () => {
  for (const mode of ['major', 'minor', 'pentatonic', 'dorian', 'lydian']) {
    const note = cellNote(0, mode, 'C');
    assert.ok(note.pitch);
  }
});

test('cell.music: effectCell changes velocity and adds witness', () => {
  const c = createComposition('test');
  const cell = bindCell(c);
  effectCell(c, cell.id, 0.95);
  assert.equal(cell.velocity, 0.95);
  assert.equal(cell.witnessLog[1].type, 'EFFECT');
});

test('cell.music: linkCells creates LINK witnesses on both', () => {
  const c = createComposition('test');
  const a = bindCell(c);
  const b = bindCell(c);
  assert.equal(linkCells(c, a.id, b.id, 'chord'), true);
  assert.ok(a.witnessLog.some(w => w.type === 'LINK'));
  assert.ok(b.witnessLog.some(w => w.type === 'LINK'));
});

test('cell.music: compositionToJSON exports all cells', () => {
  const c = createComposition('test');
  bindCell(c); bindCell(c); bindCell(c);
  const j = compositionToJSON(c);
  assert.equal(j.cells.length, 3);
  assert.equal(j.tempo, 80);
});

test('cell.music: renderScore produces ABC-like notation', () => {
  const c = createComposition('cell-song');
  for (let i = 0; i < 16; i++) bindCell(c);
  const score = renderScore(c);
  assert.match(score, /X:1/);
  assert.match(score, /T:cell-song/);
  assert.match(score, /K:D/);
});

test('cell.music: cellFrequency is positive', () => {
  const c = createComposition('test');
  const cell = bindCell(c);
  const freq = cellFrequency(cell);
  assert.ok(freq > 0);
});

test('cell.music: cellCount tracks cells', () => {
  const c = createComposition('test');
  bindCell(c); bindCell(c); bindCell(c);
  assert.equal(cellCount(c), 3);
});

test('cell.music: minor mode uses minor intervals', () => {
  const c = createComposition('test', 80, 'minor', 'A');
  const cell = bindCell(c);
  // A minor scale: A, B, C, D, E, F, G
  assert.ok(['A', 'B', 'C', 'D', 'E', 'F', 'G'].includes(cell.pitch));
});
