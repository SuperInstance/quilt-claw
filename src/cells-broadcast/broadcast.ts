/**
 * cell.broadcast — gossip protocol as canonical Quilt cell kind
 */

export interface BroadcastNode {
  id: string;
  messageLog: Map<string, number>;
  peers: Set<string>;
  fanout: number;
}

export interface BroadcastCell {
  nodes: Map<string, BroadcastNode>;
  messages: Map<string, { origin: string; t: number; hops: number }>;
  ttl: number;
  tick_count: number;
}

export function createBroadcastCell(ttl: number = 5): BroadcastCell {
  return { nodes: new Map(), messages: new Map(), ttl, tick_count: 0 };
}

export function addNode(cell: BroadcastCell, id: string, peers: string[] = [], fanout: number = 3): void {
  // Create the node
  cell.nodes.set(id, { id, messageLog: new Map(), peers: new Set(peers), fanout });
  // Auto-create peers with reciprocal links
  for (const peerId of peers) {
    if (!cell.nodes.has(peerId)) {
      // Create empty peer; will be filled if added explicitly later
      cell.nodes.set(peerId, { id: peerId, messageLog: new Map(), peers: new Set([id]), fanout });
    } else {
      const peer = cell.nodes.get(peerId)!;
      peer.peers.add(id);
    }
  }
}

export function broadcast(cell: BroadcastCell, origin: string, messageId: string): number {
  if (!cell.nodes.has(origin)) return 0;
  cell.messages.set(messageId, { origin, t: cell.tick_count, hops: 0 });
  let delivered = 0;
  const queue: string[] = [origin];
  const visited = new Set<string>();
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);
    const node = cell.nodes.get(nodeId);
    if (!node) continue;
    if (!node.messageLog.has(messageId)) {
      node.messageLog.set(messageId, cell.tick_count);
      delivered++;
    }
    const msg = cell.messages.get(messageId)!;
    if (msg.hops >= cell.ttl) continue;
    msg.hops++;
    let i = 0;
    for (const peerId of node.peers) {
      if (i >= node.fanout) break;
      if (!visited.has(peerId)) queue.push(peerId);
      i++;
    }
  }
  return delivered;
}

export function tickBroadcast(cell: BroadcastCell): void {
  cell.tick_count++;
}
