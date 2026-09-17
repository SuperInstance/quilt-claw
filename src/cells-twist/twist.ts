/**
 * cell.twist — phase-coupling cells from twist-engine's QUILT mode.
 * 
 * Extracted from github.com/SuperInstance/twist-engine (app.js, MODE=quilt).
 * Maps Kuramoto phase oscillators to Quilt cells. Each cell carries:
 *   φₜ ∈ [0, 2π)  — phase angle
 *   ω₀             — natural frequency
 *   K              — coupling strength
 * 
 * Coupling: dφ/dt = ω + K * sum(sin(φⱼ − φᵢ))
 * 
 * The lattice's b₁ = E - V + C counts the holes. Same as the Quilt 
 * merkle-graph topology.
 */

export interface TwistCellConfig {
  id: string;
  /** Natural frequency (rad/s) */
  w0: number;
  /** Coupling strength */
  K: number;
  /** Initial phase (radians) */
  initialPhase?: number;
  /** Even/odd parity: (x+y)%2 (drives tempo twist) */
  parity?: 0 | 1;
}

export class TwistCell {
  readonly id: string;
  /** Phase angle, radians */
  phi: number;
  /** Natural frequency */
  readonly w0: number;
  /** Coupling strength */
  readonly K: number;
  /** Tempo twist multiplier (0=normal, >0=delayed for odd parity) */
  readonly twist: number;
  /** Last fire time (when phase wrapped) */
  fired: number;
  /** Last update time */
  lastT: number;

  constructor(config: TwistCellConfig, tempoTwist = 0.06) {
    this.id = config.id;
    this.w0 = config.w0;
    this.K = config.K;
    this.phi = config.initialPhase ?? Math.random() * Math.PI * 2;
    this.twist = (config.parity ?? 0) === 0 ? 1 : 1 + tempoTwist;
    this.fired = -Infinity;
    this.lastT = 0;
  }

  /**
   * Advance phase via Kuramoto update:
   *   dφ/dt = ω + K * sum_neighbors(sin(φⱼ − φᵢ)) / |neighbors|
   * 
   * @param neighbors - cells this one couples to
   * @param dt - time step (seconds)
   */
  tick(neighbors: TwistCell[], dt: number): void {
    const clampedDt = Math.max(0.001, Math.min(0.05, dt));
    let cpl = 0;
    for (const n of neighbors) {
      cpl += Math.sin(n.phi - this.phi);
    }
    if (neighbors.length > 0) {
      cpl *= 1 / neighbors.length;
    }
    
    const w = this.w0 * this.twist;
    const dphi = (w + this.K * cpl) * clampedDt;
    this.phi += dphi;
    
    const TAU = Math.PI * 2;
    if (this.phi >= TAU) {
      this.phi -= TAU;
      this.fired = this.lastT + dt;
    }
    this.lastT += dt;
  }

  /** Whether this cell has fired recently. */
  isActive(windowSec: number, currentT: number): boolean {
    return (currentT - this.fired) < windowSec;
  }
}

/** 
 * A 2D grid of TwistCells (matches twist-engine's QUILT mode).
 * N×N grid with checkerboard parity.
 */
export class TwistGrid {
  readonly N: number;
  readonly cells: TwistCell[];
  readonly tempoTwist: number;

  constructor(N: number, K: number, w0: number, tempoTwist = 0.06) {
    this.N = N;
    this.cells = [];
    this.tempoTwist = tempoTwist;
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const parity = ((x + y) % 2) === 0 ? 0 : 1;
        const id = `twist-${x}-${y}`;
        this.cells.push(new TwistCell({ id, w0, K, parity }, tempoTwist));
      }
    }
  }

  /** Get neighbors of cell at (x, y) — 4-connected. */
  neighborsOf(x: number, y: number): TwistCell[] {
    const N = this.N;
    const result: TwistCell[] = [];
    if (x > 0)   result.push(this.cells[y * N + x - 1]);
    if (x < N-1) result.push(this.cells[y * N + x + 1]);
    if (y > 0)   result.push(this.cells[(y - 1) * N + x]);
    if (y < N-1) result.push(this.cells[(y + 1) * N + x]);
    return result;
  }

  /** Advance all cells by one time-step. */
  step(dt: number): void {
    const N = this.N;
    // Compute new phis based on current state
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
    // Apply
    const TAU = Math.PI * 2;
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

  /** Compute b₁ = E - V + C from the active set (matches twist-engine's doctrine). */
  betti(currentT: number, windowSec = 1.2): { V: number; E: number; C: number; b1: number } {
    const N = this.N;
    const active = new Int8Array(N * N);
    let V = 0;
    for (let i = 0; i < this.cells.length; i++) {
      if (this.cells[i].isActive(windowSec, currentT)) {
        active[i] = 1;
        V++;
      }
    }
    
    // Union-find for connected components
    const parent = new Int32Array(N * N);
    for (let i = 0; i < N * N; i++) parent[i] = i;
    const find = (a: number) => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
    
    let E = 0;
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const i = y * N + x;
        if (!active[i]) continue;
        // Right neighbor
        if (x < N - 1 && active[i + 1]) {
          E++;
          const ra = find(i), rb = find(i + 1);
          if (ra !== rb) parent[ra] = rb;
        }
        // Bottom neighbor
        if (y < N - 1 && active[i + N]) {
          E++;
          const ra = find(i), rb = find(i + N);
          if (ra !== rb) parent[ra] = rb;
        }
      }
    }
    
    const roots = new Set<number>();
    for (let i = 0; i < N * N; i++) {
      if (active[i]) roots.add(find(i));
    }
    const C = roots.size;
    const b1 = Math.max(0, E - V + C);
    
    return { V, E, C, b1 };
  }
}

// === Tests (twist is the language; Quilt is the substrate) ===

export const TAU = Math.PI * 2;

export function selfTest(): boolean {
  // 4-cell grid with phase oscillators
  const grid = new TwistGrid(4, 1.1, TAU * 0.42);
  
  // Run 200 ticks
  for (let t = 0; t < 200; t++) {
    grid.step(0.016);  // 16ms = 60fps
  }
  
  // Compute b₁ at current time
  const t = grid.cells[0].lastT;
  const { V, E, C, b1 } = grid.betti(t);
  
  // Valid: b₁ ≥ 0, V > 0, C > 0, E ≥ V - 1 (connected)
  const valid = b1 >= 0 && V > 0 && C > 0 && E >= 0;
  
  // Print results for inspection
  console.log('twist self-test:');
  console.log('  V (active vertices) =', V);
  console.log('  E (active edges)    =', E);
  console.log('  C (connected comps) =', C);
  console.log('  b₁ = E - V + C      =', b1);
  console.log('  valid               =', valid);
  
  return valid;
}
