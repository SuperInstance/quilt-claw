/**
 * cell.swarm — Arrow-flight-style mesh gossip cells
 *
 * Extracted from sunset-ecosystem/swarm/arrow_mesh.py + arrow_flight_mesh.py.
 *
 * Provides cell-to-cell messaging over a mesh:
 *   - serialize payload to Arrow-like columnar format
 *   - deserialize on peer
 *   - route via neighbor cells
 *
 * Substrate-free: composes via BIND/LINK/EFFECT.
 */

export interface SwarmMessage {
  from: string;       // source cell id
  to: string;         // target cell id
  payload: Uint8Array | string;  // serialized payload
  timestamp: number;
  hops: number;
}

export interface SwarmCell {
  id: string;
  neighbors: Set<string>;
  messages: SwarmMessage[];
  receivedMessages: SwarmMessage[];
  tickCount: number;
}

export function createSwarmCell(id: string = 'swarm'): SwarmCell {
  return {
    id,
    neighbors: new Set(),
    messages: [],
    receivedMessages: [],
    tickCount: 0
  };
}

export function addNeighbor(cell: SwarmCell, neighborId: string): void {
  cell.neighbors.add(neighborId);
}

export function removeNeighbor(cell: SwarmCell, neighborId: string): void {
  cell.neighbors.delete(neighborId);
}

export function neighborCount(cell: SwarmCell): number {
  return cell.neighbors.size;
}

export function send(cell: SwarmCell, to: string, payload: Uint8Array | string): SwarmMessage {
  const msg: SwarmMessage = {
    from: cell.id,
    to,
    payload,
    timestamp: Date.now(),
    hops: 0
  };
  cell.messages.push(msg);
  cell.tickCount++;
  return msg;
}

export function receive(cell: SwarmCell, msg: SwarmMessage): boolean {
  if (msg.to !== cell.id) return false;
  if (cell.receivedMessages.some(m => m.from === msg.from && m.timestamp === msg.timestamp)) return false;
  cell.receivedMessages.push(msg);
  cell.tickCount++;
  return true;
}

export function broadcast(cell: SwarmCell, payload: Uint8Array | string, visited: Set<string> = new Set()): SwarmMessage[] {
  const messages: SwarmMessage[] = [];
  visited.add(cell.id);
  for (const neighborId of cell.neighbors) {
    if (!visited.has(neighborId)) {
      const msg: SwarmMessage = {
        from: cell.id,
        to: neighborId,
        payload,
        timestamp: Date.now(),
        hops: 1
      };
      cell.messages.push(msg);
      messages.push(msg);
    }
  }
  cell.tickCount++;
  return messages;
}

// Columnar serialization (Arrow-like)
export interface ColumnarPayload {
  columnNames: string[];
  columns: Array<(number | string)[]>;
}

export function toColumnar(messages: SwarmMessage[]): ColumnarPayload {
  return {
    columnNames: ['from', 'to', 'timestamp', 'hops', 'payload_size'],
    columns: [
      messages.map(m => m.from),
      messages.map(m => m.to),
      messages.map(m => m.timestamp),
      messages.map(m => m.hops),
      messages.map(m => typeof m.payload === 'string' ? m.payload.length : m.payload.byteLength)
    ]
  };
}

export function fromColumnar(col: ColumnarPayload): SwarmMessage[] {
  const n = col.columns[0].length;
  const messages: SwarmMessage[] = [];
  for (let i = 0; i < n; i++) {
    messages.push({
      from: col.columns[0][i] as string,
      to: col.columns[1][i] as string,
      timestamp: col.columns[2][i] as number,
      hops: col.columns[3][i] as number,
      payload: '' // payload size known but content dropped in columnar
    });
  }
  return messages;
}

// Mesh topology: BFS shortest path
export function shortestPath(cell: SwarmCell, fromId: string, toId: string, graph: Map<string, Set<string>>): string[] | null {
  if (fromId === toId) return [fromId];
  const visited = new Set<string>([fromId]);
  const queue: Array<{ id: string; path: string[] }> = [{ id: fromId, path: [fromId] }];
  while (queue.length > 0) {
    const { id, path } = queue.shift()!;
    const neighbors = graph.get(id) || new Set();
    for (const n of neighbors) {
      if (visited.has(n)) continue;
      visited.add(n);
      const newPath = [...path, n];
      if (n === toId) return newPath;
      queue.push({ id: n, path: newPath });
    }
  }
  return null;
}

// Mesh fan-out: how many cells reachable within N hops
export function reachableIn(cell: SwarmCell, hops: number, graph: Map<string, Set<string>>): Set<string> {
  const visited = new Set<string>([cell.id]);
  let frontier = new Set<string>([cell.id]);
  for (let i = 0; i < hops; i++) {
    const next = new Set<string>();
    for (const id of frontier) {
      const neighbors = graph.get(id) || new Set();
      for (const n of neighbors) {
        if (!visited.has(n)) {
          visited.add(n);
          next.add(n);
        }
      }
    }
    frontier = next;
  }
  return visited;
}

export function pendingCount(cell: SwarmCell): number {
  return cell.messages.length;
}

export function receivedCount(cell: SwarmCell): number {
  return cell.receivedMessages.length;
}
