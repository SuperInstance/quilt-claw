/**
 * cell.flock — Reynolds boids as canonical Quilt cell kind
 *
 * Promoted from twist-engine's FLOCK mode (5 of 5 substrates).
 * Same Reynolds 1987 algorithm; same four fictions; same emergent properties.
 *
 * Reference: tests/sim.test.js in twist-engine. All thresholds lifted verbatim.
 */

export type Fiction = 'murmuration' | 'pack' | 'kennel' | 'parliament';

export interface FictionConfig {
  ali: number;
  coh: number;
  sep: number;
  tgt: number;       // target weight (0 = no lure)
  vmax: number;
  pen?: boolean;     // kennel: containment pen
  ring?: boolean;    // parliament: ring formation
}

export const FICTIONS: Record<Fiction, FictionConfig> = {
  murmuration: { ali: 1.0, coh: 0.55, sep: 1.25, tgt: 0, vmax: 2.7 },
  pack:        { ali: 0.8, coh: 0.35, sep: 0.85, tgt: 1.6, vmax: 3.6 },
  kennel:      { ali: 0.25, coh: 0.15, sep: 0.7, tgt: 0, vmax: 1.1, pen: true },
  parliament:  { ali: 0.9, coh: 1.3, sep: 0.6, tgt: 0, vmax: 0.9, ring: true },
};

export interface Bird {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface FlockCell {
  fiction: Fiction;
  birds: Bird[];
  W: number;
  H: number;
  pol: number;
  meanSpd: number;
  polHist: number[];
  lure: { x: number; y: number };
}

const TAU = 2 * Math.PI;
const cellSize = 46;
const nA_max = 7;

export function createFlockCell(fiction: Fiction, n = 200, W = 960, H = 600): FlockCell {
  const cx = W / 2, cy = H / 2;
  const birds: Bird[] = [];
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU;
    birds.push({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: Math.cos(a),
      vy: Math.sin(a),
    });
  }
  if (fiction === 'parliament') seedOrbit(birds, FICTIONS.parliament.vmax * 0.7, cx, cy);
  return {
    fiction,
    birds,
    W, H,
    pol: 0,
    meanSpd: 0,
    polHist: [],
    lure: { x: W * 0.7, y: H * 0.5 },
  };
}

function seedOrbit(B: Bird[], sp: number, cx: number, cy: number) {
  for (const b of B) {
    const ang = Math.atan2(b.y - cy, b.x - cx) + Math.PI / 2;
    b.vx = Math.cos(ang) * sp + (Math.random() - 0.5) * 0.2;
    b.vy = Math.sin(ang) * sp + (Math.random() - 0.5) * 0.2;
  }
}

const clamp = (v: number, lo: number, hi: number) => v < lo ? lo : v > hi ? hi : v;

export function stepFlock(cell: FlockCell, dt: number = 1/60): { pol: number; meanSpd: number } {
  const F = FICTIONS[cell.fiction];
  const { birds: B, W, H } = cell;
  const cx = W / 2, cy = H / 2;
  const lx = cell.lure.x, ly = cell.lure.y;
  const penR = Math.min(W, H) * 0.26;
  const ringR = Math.min(W, H) * 0.30;

  // build spatial grid
  const grid = new Map<string, number[]>();
  for (let i = 0; i < B.length; i++) {
    const gx = Math.floor(B[i].x / cellSize), gy = Math.floor(B[i].y / cellSize);
    const k = gx + ',' + gy;
    const arr = grid.get(k);
    if (arr) arr.push(i);
    else grid.set(k, [i]);
  }

  let svx = 0, svy = 0, spd = 0;
  const step = clamp(dt * 60, 0.5, 2);

  for (let i = 0; i < B.length; i++) {
    const b = B[i];
    const gx = Math.floor(b.x / cellSize), gy = Math.floor(b.y / cellSize);
    let nA = 0, ax = 0, ay = 0, px = 0, py = 0, sx = 0, sy = 0;
    for (let i2 = -1; i2 <= 1 && nA < nA_max; i2++) {
      for (let j2 = -1; j2 <= 1 && nA < nA_max; j2++) {
        const arr = grid.get((gx + i2) + ',' + (gy + j2));
        if (!arr) continue;
        for (const j of arr) {
          if (j === i || nA >= nA_max) continue;
          const o = B[j];
          const dx = o.x - b.x, dy = o.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 > 46 * 46 || d2 < 1e-6) continue;
          nA++;
          ax += o.vx; ay += o.vy;
          px += o.x; py += o.y;
          const inv = 1 / d2;
          sx -= dx * inv; sy -= dy * inv;
        }
      }
    }

    let fx = 0, fy = 0;
    if (nA > 0) {
      const al = Math.hypot(ax, ay) || 1;
      fx += (ax / al - b.vx / (Math.hypot(b.vx, b.vy) || 1)) * F.ali * 0.05;
      fy += (ay / al - b.vy / (Math.hypot(b.vx, b.vy) || 1)) * F.ali * 0.05;
      fx += ((px / nA - b.x)) * F.coh * 0.0016;
      fy += ((py / nA - b.y)) * F.coh * 0.0016;
      fx += sx * F.sep * 0.9;
      fy += sy * F.sep * 0.9;
    }
    if (F.tgt) {
      fx += (lx - b.x) * 0.00045 * F.tgt;
      fy += (ly - b.y) * 0.00045 * F.tgt;
    }
    if (F.pen) {
      const dx = cx - b.x, dy = cy - b.y, d = Math.hypot(dx, dy) || 1;
      if (d > penR) {
        const ov = d - penR;
        fx += dx / d * (0.06 + ov * 0.012);
        fy += dy / d * (0.06 + ov * 0.012);
      }
      fx *= 0.985; fy *= 0.985;
    }
    if (F.ring) {
      const dx = b.x - cx, dy = b.y - cy, d = Math.hypot(dx, dy) || 1;
      const err = ringR - d;
      fx += dx / d * err * 0.0012 - dy / d * 0.012;
      fy += dy / d * err * 0.0012 + dx / d * 0.012;
    }

    b.vx += fx * step;
    b.vy += fy * step;
    const v = Math.hypot(b.vx, b.vy) || 1;
    const vc = clamp(v, F.vmax * 0.35, F.vmax);
    b.vx = b.vx / v * vc;
    b.vy = b.vy / v * vc;
    b.x += b.vx * step;
    b.y += b.vy * step;
    if (b.x < -8) b.x = W + 8; if (b.x > W + 8) b.x = -8;
    if (b.y < -8) b.y = H + 8; if (b.y > H + 8) b.y = -8;
    svx += b.vx / vc;
    svy += b.vy / vc;
    spd += vc;
  }
  const pol = Math.hypot(svx, svy) / B.length;
  cell.pol = pol;
  cell.meanSpd = spd / B.length;
  cell.polHist.push(pol);
  if (cell.polHist.length > 220) cell.polHist.shift();
  return { pol, meanSpd: cell.meanSpd };
}

export function flockComponents(cell: FlockCell): number {
  const N = cell.birds.length;
  const parent = Array.from({ length: N }, (_, i) => i);
  const find = (i: number): number => parent[i] === i ? i : (parent[i] = find(parent[i]));
  const union = (a: number, b: number) => { parent[find(a)] = find(b); };
  for (let i = 0; i < N; i++) {
    for (let j = i + 1; j < N; j++) {
      const d = Math.hypot(cell.birds[i].x - cell.birds[j].x, cell.birds[i].y - cell.birds[j].y);
      if (d < 46) union(i, j);
    }
  }
  const roots = new Set<number>();
  for (let i = 0; i < N; i++) roots.add(find(i));
  return roots.size;
}

/** Mean distance of all birds from center — measures flock dispersion */
export function flockMeanR(cell: FlockCell): number {
  let sumR = 0, cx = 0, cy = 0;
  const n = cell.birds.length;
  for (const b of cell.birds) { cx += b.x / n; cy += b.y / n; }
  for (const b of cell.birds) sumR += Math.hypot(b.x - cx, b.y - cy);
  return sumR / n;
}
