/**
 * cell.partition — graph partitioning
 */

export interface PartitionCell {
  n: number;
  parts: number;
  assignment: number[];
  load: number[];
  edges: number[][];
}

export function createPartitionCell(n: number, parts: number = 4): PartitionCell {
  const assignment = Array.from({ length: n }, (_, i) => i % parts);
  const load = Array(parts).fill(0);
  for (const a of assignment) load[a]++;
  return { n, parts, assignment, load, edges: Array.from({ length: parts }, () => []) };
}

export function setAssignment(cell: PartitionCell, node: number, part: number): void {
  if (node < 0 || node >= cell.n || part < 0 || part >= cell.parts) return;
  const old = cell.assignment[node];
  cell.assignment[node] = part;
  if (old !== undefined && old !== part) {
    cell.load[old]--;
    cell.load[part]++;
  } else if (old === undefined) {
    cell.load[part]++;
  }
}

export function balanceLoad(cell: PartitionCell): number {
  const target = cell.n / cell.parts;
  let imbalance = 0;
  for (const l of cell.load) imbalance += Math.abs(l - target);
  return imbalance;
}

export function addEdge(cell: PartitionCell, a: number, b: number): void {
  const partA = cell.assignment[a];
  const partB = cell.assignment[b];
  if (partA === undefined || partB === undefined) return;
  if (partA !== partB) {
    cell.edges[partA].push(b);
    cell.edges[partB].push(a);
  }
}

export function cutEdges(cell: PartitionCell): number {
  let total = 0;
  for (const edges of cell.edges) total += edges.length;
  return total / 2;
}
