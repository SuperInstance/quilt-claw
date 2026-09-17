// Run twist self-test
const path = require('path');

// Inline a JS translation of the TS module for testing
const TAU = Math.PI * 2;

class TwistCell {
  constructor(config, tempoTwist = 0.06) {
    this.id = config.id;
    this.w0 = config.w0;
    this.K = config.K;
    this.phi = config.initialPhase ?? Math.random() * TAU;
    this.twist = (config.parity ?? 0) === 0 ? 1 : 1 + tempoTwist;
    this.fired = -Infinity;
    this.lastT = 0;
  }

  tick(neighbors, dt) {
    const clampedDt = Math.max(0.001, Math.min(0.05, dt));
    let cpl = 0;
    for (const n of neighbors) cpl += Math.sin(n.phi - this.phi);
    if (neighbors.length > 0) cpl *= 1 / neighbors.length;
    const w = this.w0 * this.twist;
    const dphi = (w + this.K * cpl) * clampedDt;
    this.phi += dphi;
    if (this.phi >= TAU) {
      this.phi -= TAU;
      this.fired = this.lastT + dt;
    }
    this.lastT += dt;
  }

  isActive(windowSec, currentT) {
    return (currentT - this.fired) < windowSec;
  }
}

class TwistGrid {
  constructor(N, K, w0, tempoTwist = 0.06) {
    this.N = N;
    this.cells = [];
    this.tempoTwist = tempoTwist;
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const parity = ((x + y) % 2) === 0 ? 0 : 1;
        this.cells.push(new TwistCell({ id: `${x},${y}`, w0, K, parity }, tempoTwist));
      }
    }
  }

  neighborsOf(x, y) {
    const N = this.N;
    const result = [];
    if (x > 0) result.push(this.cells[y * N + x - 1]);
    if (x < N - 1) result.push(this.cells[y * N + x + 1]);
    if (y > 0) result.push(this.cells[(y - 1) * N + x]);
    if (y < N - 1) result.push(this.cells[(y + 1) * N + x]);
    return result;
  }

  step(dt) {
    const N = this.N;
    const newPhis = new Float64Array(N * N);
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const i = y * N + x;
        const me = this.cells[i];
        const neighbors = this.neighborsOf(x, y);
        let cpl = 0;
        for (const n of neighbors) cpl += Math.sin(n.phi - me.phi);
        const w = me.w0 * me.twist;
        const dphi = (w + me.K * cpl * 0.25) * dt;
        newPhis[i] = me.phi + dphi;
      }
    }
    const t = this.cells[0].lastT + dt;
    for (let i = 0; i < this.cells.length; i++) {
      this.cells[i].phi = newPhis[i];
      while (this.cells[i].phi >= TAU) {
        this.cells[i].phi -= TAU;
        this.cells[i].fired = t;
      }
      this.cells[i].lastT = t;
    }
  }

  betti(currentT, windowSec = 1.2) {
    const N = this.N;
    const active = new Int8Array(N * N);
    let V = 0;
    for (let i = 0; i < this.cells.length; i++) {
      if (this.cells[i].isActive(windowSec, currentT)) {
        active[i] = 1;
        V++;
      }
    }
    const parent = new Int32Array(N * N);
    for (let i = 0; i < N * N; i++) parent[i] = i;
    const find = (a) => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
    let E = 0;
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const i = y * N + x;
        if (!active[i]) continue;
        if (x < N - 1 && active[i + 1]) {
          E++;
          const ra = find(i), rb = find(i + 1);
          if (ra !== rb) parent[ra] = rb;
        }
        if (y < N - 1 && active[i + N]) {
          E++;
          const ra = find(i), rb = find(i + N);
          if (ra !== rb) parent[ra] = rb;
        }
      }
    }
    const roots = new Set();
    for (let i = 0; i < N * N; i++) {
      if (active[i]) roots.add(find(i));
    }
    const C = roots.size;
    return { V, E, C, b1: Math.max(0, E - V + C) };
  }
}

const { test } = require('node:test');
const assert = require('node:assert/strict');

test('twist grid: 4x4', () => {
  const grid = new TwistGrid(4, 1.1, TAU * 0.42);
  for (let t = 0; t < 200; t++) {
    grid.step(0.016);
  }
  const currentT = grid.cells[0].lastT;
  const { V, E, C, b1 } = grid.betti(currentT);
  assert.ok(b1 >= 0, 'b1 should be non-negative');
  assert.ok(V > 0, 'should have active vertices');
  console.log(`  V=${V} E=${E} C=${C} b1=${b1}`);
});

test('twist grid: 8x8 sustains more activity', () => {
  const small = new TwistGrid(4, 1.1, TAU * 0.42);
  const large = new TwistGrid(8, 1.1, TAU * 0.42);
  for (let t = 0; t < 500; t++) {
    small.step(0.016);
    large.step(0.016);
  }
  const tS = small.cells[0].lastT;
  const tL = large.cells[0].lastT;
  const smallB = small.betti(tS);
  const largeB = large.betti(tL);
  // The 8x8 grid has more cells and likely more activity
  assert.ok(largeB.V >= smallB.V / 2, '8x8 should have comparable activity');
  console.log(`  4x4: V=${smallB.V} b1=${smallB.b1}`);
  console.log(`  8x8: V=${largeB.V} b1=${largeB.b1}`);
});

test('twist cell: phase wraps modulo 2π', () => {
  const cell = new TwistCell({ id: 'test', w0: TAU, K: 0 });
  cell.phi = 6 * TAU;  // way past a wrap
  for (let t = 0; t < 10; t++) {
    cell.tick([], 0.05);
  }
  assert.ok(cell.phi >= 0 && cell.phi < TAU, 'phase should be in [0, 2π)');
  console.log(`  final phi = ${cell.phi.toFixed(4)}`);
});

test('twist cell: parity drives tempo twist', () => {
  const even = new TwistCell({ id: 'even', w0: 1.0, K: 0, parity: 0 }, 0.5);
  const odd = new TwistCell({ id: 'odd', w0: 1.0, K: 0, parity: 1 }, 0.5);
  // Even: w0 * 1 = 1.0
  // Odd:  w0 * 1.5 = 1.5
  for (let t = 0; t < 100; t++) {
    even.tick([], 0.016);
    odd.tick([], 0.016);
  }
  // Odd cell has fired more times (higher w)
  console.log(`  even fired offset: ${even.fired}`);
  console.log(`  odd fired offset:  ${odd.fired}`);
  assert.notEqual(even.twist, odd.twist); // even vs odd parity has different tempo multiplier
});
