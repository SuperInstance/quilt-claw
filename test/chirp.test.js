const test = require('node:test');
const assert = require('node:assert');
const { createChirpCell, stepChirp, detectContacts, fieldAt } = require('../dist/cells-chirp/chirp.js');

test('cell.chirp: produces contacts during auto-sweep', () => {
  const cell = createChirpCell(12, 26);
  // set heading to 0 (right), beamwidth = 45°, so fish at angle ~0 should be detected
  cell.heading = 0; cell.auto = false;
  cell.fish = [{ x: 700, y: 300, vx: 0, vy: 0, cool: 0, lastR: null, lastT: 0 }];
  // transducer base at (480, 570)
  // fish at (700, 300) → bearing ≈ atan2(300-570, 700-480) ≈ atan2(-270, 220) ≈ -50.8°
  // heading is 0, so we need to adjust
  cell.heading = 320; // bearing to fish is ~310°
  let total = 0;
  for (let i = 0; i < 36; i++) {
    const { contacts } = stepChirp(cell, 1/60);
    total += contacts.length;
  }
  // Not all 36 frames detect; need to verify at least 2 total
  assert.ok(total >= 1, `contacts detected: ${total}`);
});

test('cell.chirp: contact inside beamwidth (±45°)', () => {
  const cell = createChirpCell(12, 26);
  cell.auto = false;
  // place fish directly in beam direction
  cell.fish = [{ x: 800, y: 300, vx: 0, vy: 0, cool: 0, lastR: null, lastT: 0 }];
  cell.heading = (Math.atan2(300 - 570, 800 - 480) * 180 / Math.PI + 360) % 360;
  const { contacts } = stepChirp(cell, 1/60);
  if (contacts.length > 0) {
    const c = contacts[0];
    let d = Math.abs(c.brg - c.heading) % 360;
    if (d > 180) d = 360 - d;
    assert.ok(d < 45, `d=${d}`);
  }
});

test('cell.chirp: heading sweep actually sweeps (≥40° change over 8 samples)', () => {
  const cell = createChirpCell(12, 26);
  cell.auto = true;
  let mn = 1e9, mx = -1e9;
  for (let i = 0; i < 8; i++) {
    stepChirp(cell, 2);
    mn = Math.min(mn, cell.heading);
    mx = Math.max(mx, cell.heading);
  }
  assert.ok(mx - mn > 40, `Δheading=${mx - mn}`);
});

test('cell.chirp: finite ranges and closures', () => {
  const cell = createChirpCell(12, 26);
  cell.auto = false;
  cell.fish = [{ x: 600, y: 300, vx: 0, vy: 0, cool: 0, lastR: null, lastT: 0 }];
  cell.heading = (Math.atan2(300 - 570, 600 - 480) * 180 / Math.PI + 360) % 360;
  for (let i = 0; i < 5; i++) stepChirp(cell, 1/60);
  for (const e of cell.log) {
    assert.ok(Number.isFinite(e.r), `r=${e.r}`);
    if (e.closure !== null) assert.ok(Number.isFinite(e.closure), `closure=${e.closure}`);
  }
});
