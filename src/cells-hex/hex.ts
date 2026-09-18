/**
 * cell.hex — hexagonal lattice moiré as canonical Quilt cell kind
 */

export interface HexCell {
  s: number;
  theta: number;
  R0: number;
  base0: { x: number; y: number }[];   // layer 0 (fixed)
  layer1: { x: number; y: number }[];  // layer 1 (rotated by theta)
  windows: [number, number][];
  S: number;
}

const TAU = 2 * Math.PI;

export function createHexCell(s: number = 28, theta: number = 0, R0: number = 450): HexCell {
  const cell: HexCell = { s, theta, R0, base0: [], layer1: [], windows: [], S: 1 };
  rebuildBase0(cell);
  rotateLayer1(cell);
  computeWindows(cell);
  return cell;
}

function rebuildBase0(cell: HexCell): void {
  cell.base0 = [];
  const r = cell.R0;
  const dx = cell.s * Math.sqrt(3) / 2;
  const dy = cell.s * 1.5;
  for (let y = -r; y < r; y += dy) {
    const rowOffset = Math.floor(y / dy) % 2 === 0 ? 0 : dx / 2;
    for (let x = -r; x < r; x += dx) {
      const px = x + rowOffset;
      const py = y;
      if (Math.hypot(px, py) > r) continue;
      cell.base0.push({ x: px, y: py });
    }
  }
}

function rotateLayer1(cell: HexCell): void {
  cell.layer1 = cell.base0.map(p => {
    const c = Math.cos(cell.theta), sn = Math.sin(cell.theta);
    return { x: p.x * c - p.y * sn, y: p.x * sn + p.y * c };
  });
}

/** Alignment R(θ) using spatial hashing for speed */
function alignmentAt(cell: HexCell, theta: number): number {
  const old = cell.theta;
  cell.theta = theta;
  rotateLayer1(cell);
  
  const sigma = 0.24 * cell.s;
  const cellSize = sigma * 2;
  const grid = new Map<string, number[]>();
  for (let i = 0; i < cell.base0.length; i++) {
    const gx = Math.floor(cell.base0[i].x / cellSize), gy = Math.floor(cell.base0[i].y / cellSize);
    const k = gx + ',' + gy;
    const arr = grid.get(k);
    if (arr) arr.push(i);
    else grid.set(k, [i]);
  }
  
  let sum = 0;
  const twoSigma2 = 2 * sigma * sigma;
  for (const a of cell.layer1) {
    const gx = Math.floor(a.x / cellSize), gy = Math.floor(a.y / cellSize);
    let best = 0;
    for (let i2 = -1; i2 <= 1; i2++) {
      for (let j2 = -1; j2 <= 1; j2++) {
        const arr = grid.get((gx + i2) + ',' + (gy + j2));
        if (!arr) continue;
        for (const j of arr) {
          const b = cell.base0[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 > 9 * sigma * sigma) continue;
          const g = Math.exp(-d2 / twoSigma2);
          if (g > best) best = g;
        }
      }
    }
    sum += best;
  }
  
  cell.theta = old;
  rotateLayer1(cell);
  return cell.layer1.length > 0 ? sum / cell.layer1.length : 0;
}

export function computeWindows(cell: HexCell, maxDeg: number = 10, stepDeg: number = 0.1): void {
  cell.windows = [];
  let prevS = 1, prevR = 0;
  const N = Math.floor(maxDeg / stepDeg);
  for (let i = 0; i < N; i++) {
    const th = i * stepDeg * Math.PI / 180;
    const R = alignmentAt(cell, th);
    const S = 1 - R;
    // detect peak alignment (low S)
    if (R > 0.10 && R > prevR && R > 0.10) {
      cell.windows.push([th, R]);
    }
    prevR = R;
    prevS = S;
  }
  cell.windows.sort((a, b) => b[1] - a[1]);
  cell.windows = cell.windows.slice(0, 12);
  if (cell.windows.length > 0) {
    cell.theta = cell.windows[0][0];
    rotateLayer1(cell);
    const R = cell.windows[0][1];
    cell.S = 1 - R;
  }
}

export function lambda(cell: HexCell): number {
  return cell.s / (2 * Math.sin(cell.theta / 2));
}

export function setTheta(cell: HexCell, theta: number): void {
  cell.theta = theta;
  rotateLayer1(cell);
  const sigma = 0.24 * cell.s;
  const cellSize = sigma * 2;
  const grid = new Map<string, number[]>();
  for (let i = 0; i < cell.base0.length; i++) {
    const gx = Math.floor(cell.base0[i].x / cellSize), gy = Math.floor(cell.base0[i].y / cellSize);
    const k = gx + ',' + gy;
    const arr = grid.get(k);
    if (arr) arr.push(i);
    else grid.set(k, [i]);
  }
  const twoSigma2 = 2 * sigma * sigma;
  let sum = 0;
  for (const a of cell.layer1) {
    const gx = Math.floor(a.x / cellSize), gy = Math.floor(a.y / cellSize);
    let best = 0;
    for (let i2 = -1; i2 <= 1; i2++) {
      for (let j2 = -1; j2 <= 1; j2++) {
        const arr = grid.get((gx + i2) + ',' + (gy + j2));
        if (!arr) continue;
        for (const j of arr) {
          const b = cell.base0[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 > 9 * sigma * sigma) continue;
          const g = Math.exp(-d2 / twoSigma2);
          if (g > best) best = g;
        }
      }
    }
    sum += best;
  }
  cell.S = cell.layer1.length > 0 ? 1 - sum / cell.layer1.length : 1;
}

export function snapNext(cell: HexCell): boolean {
  if (cell.windows.length === 0) return false;
  const sorted = cell.windows.slice().sort((a, b) => a[0] - b[0]);
  for (const w of sorted) {
    if (w[0] > cell.theta + 0.001) {
      setTheta(cell, w[0]);
      return true;
    }
  }
  return false;
}
