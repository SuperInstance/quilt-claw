/**
 * cell.perm — permutations as canonical Quilt cell kind
 *
 * Promoted from twist-engine's PERM mode (5 of 5 substrates).
 * Twist law in S_n: inversions, cycles, derangements, subfactorials, random walks.
 *
 * Reference: tests/sim.test.js in twist-engine. Inversion CLT and adj-swap walks.
 */

export interface PermCell {
  n: number;
  arr: number[];        // arr[i] = image of i (or arr[i] = position of i depending on convention)
  inv: number;          // inversion count
  cyc: number;          // number of cycles
  lisV: number;         // longest increasing subsequence length
  fixed: number;        // number of fixed points
  deranged: boolean;    // no fixed points
  steps: number;        // total operations applied
  walkInv: number[];    // inversion count at each step of walk
}

export function subfactorial(n: number): number {
  if (n <= 1) return 0;
  let a = 1, b = 0;
  for (let i = 2; i <= n; i++) { const t = (i - 1) * (a + b); a = b; b = t; }
  return b;
}

export function createPermCell(n: number = 6): PermCell {
  const cell: PermCell = { n, arr: [], inv: 0, cyc: 0, lisV: 0, fixed: 0, deranged: false, steps: 0, walkInv: [] };
  for (let i = 0; i < n; i++) cell.arr.push(i);
  recompute(cell);
  return cell;
}

/** Adjacent transposition σ_i: swap arr[i] and arr[i+1] */
export function swap(cell: PermCell, i: number): void {
  if (i < 0 || i >= cell.n - 1) return;
  [cell.arr[i], cell.arr[i + 1]] = [cell.arr[i + 1], cell.arr[i]];
  recompute(cell);
  cell.steps++;
}

/** Twist block: apply σ_k · σ_{k+1} · ... · σ_{k+n-1}, equivalent to a k-cycle on the first n elements */
export function twistBlock(cell: PermCell, k: number): void {
  const len = Math.min(k, cell.n);
  // cycle the first len elements right by 1
  if (len < 2) return;
  const last = cell.arr[len - 1];
  for (let i = len - 1; i > 0; i--) cell.arr[i] = cell.arr[i - 1];
  cell.arr[0] = last;
  recompute(cell);
  cell.steps++;
}

/** Recompute all metrics */
export function recompute(cell: PermCell): void {
  const n = cell.n;
  // inversions
  let inv = 0;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (cell.arr[i] > cell.arr[j]) inv++;
  cell.inv = inv;
  // cycles (treat arr as permutation: arr[i] = σ(i))
  const seen = new Array(n).fill(false);
  let cyc = 0, fixed = 0;
  for (let i = 0; i < n; i++) {
    if (seen[i]) continue;
    cyc++;
    let j = i;
    while (!seen[j]) { seen[j] = true; j = cell.arr[j]; }
  }
  cell.cyc = cyc;
  cell.fixed = cell.arr.filter((v, i) => v === i).length;
  cell.deranged = cell.fixed === 0;
  // LIS length (O(n²) is fine for small n)
  const dp = new Array(n).fill(1);
  for (let i = 0; i < n; i++) for (let j = 0; j < i; j++) if (cell.arr[j] < cell.arr[i]) dp[i] = Math.max(dp[i], dp[j] + 1);
  cell.lisV = Math.max(...dp);
}

/** Random adjacent-swap walk. Records inversion count each step. */
export function walk(cell: PermCell, steps: number, rng: () => number = Math.random): void {
  for (let s = 0; s < steps; s++) {
    const i = Math.floor(rng() * (cell.n - 1));
    swap(cell, i);
    cell.walkInv.push(cell.inv);
  }
}
