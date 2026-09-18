/**
 * cell.neighbor — nearest-neighbor graph as canonical Quilt cell kind
 *
 * Promoted from sunset-ecosystem/swarm/peer_topology.py.
 * Builds spatial-neighbor graphs; measures connectivity, degree distribution.
 */

export interface NeighborCell {
  points: { x: number; y: number; id: number }[];
  radius: number;
  edges: [number, number][];
  adjacency: Map<number, Set<number>>;
}

export function createNeighborCell(radius: number = 1.0): NeighborCell {
  return { points: [], radius, edges: [], adjacency: new Map() };
}

export function addPoint(cell: NeighborCell, x: number, y: number): number {
  const id = cell.points.length;
  cell.points.push({ x, y, id });
  cell.adjacency.set(id, new Set());
  return id;
}

export function buildGraph(cell: NeighborCell): void {
  cell.edges = [];
  cell.adjacency.clear();
  for (const p of cell.points) cell.adjacency.set(p.id, new Set());
  for (let i = 0; i < cell.points.length; i++) {
    for (let j = i + 1; j < cell.points.length; j++) {
      const dx = cell.points[i].x - cell.points[j].x;
      const dy = cell.points[i].y - cell.points[j].y;
      const d = Math.hypot(dx, dy);
      if (d < cell.radius) {
        cell.edges.push([i, j]);
        cell.adjacency.get(i)!.add(j);
        cell.adjacency.get(j)!.add(i);
      }
    }
  }
}

export function degreeDistribution(cell: NeighborCell): Map<number, number> {
  const dist = new Map<number, number>();
  for (const [_, neighbors] of cell.adjacency) {
    const d = neighbors.size;
    dist.set(d, (dist.get(d) || 0) + 1);
  }
  return dist;
}

export function meanDegree(cell: NeighborCell): number {
  let total = 0;
  for (const [_, neighbors] of cell.adjacency) total += neighbors.size;
  return cell.points.length > 0 ? total / cell.points.length : 0;
}

export function components(cell: NeighborCell): number {
  const visited = new Set<number>();
  let count = 0;
  for (const p of cell.points) {
    if (visited.has(p.id)) continue;
    count++;
    const queue = [p.id];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      for (const n of cell.adjacency.get(current) || []) {
        if (!visited.has(n)) queue.push(n);
      }
    }
  }
  return count;
}
