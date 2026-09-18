/**
 * cell.ack — acknowledgment protocol as canonical Quilt cell kind
 *
 * Promoted from sunset-ecosystem/swarm (acknowledgment patterns).
 * Tracks pending requests, timeouts, retransmissions.
 */

export interface AckMessage {
  id: string;
  sender: string;
  receiver: string;
  sentAt: number;
  ackedAt: number | null;
  retries: number;
}

export interface AckCell {
  pending: Map<string, AckMessage>;
  acked: Map<string, AckMessage>;
  timeoutMs: number;
  maxRetries: number;
  tick_count: number;
}

export function createAckCell(timeoutMs: number = 1000, maxRetries: number = 3): AckCell {
  return { pending: new Map(), acked: new Map(), timeoutMs, maxRetries, tick_count: 0 };
}

export function send(cell: AckCell, id: string, sender: string, receiver: string): void {
  cell.pending.set(id, { id, sender, receiver, sentAt: cell.tick_count, ackedAt: null, retries: 0 });
}

export function acknowledge(cell: AckCell, id: string): boolean {
  const msg = cell.pending.get(id);
  if (!msg) return false;
  msg.ackedAt = cell.tick_count;
  cell.acked.set(id, msg);
  cell.pending.delete(id);
  return true;
}

export function tickAck(cell: AckCell): { timed_out: string[] } {
  const timed_out: string[] = [];
  cell.tick_count++;
  for (const [id, msg] of cell.pending) {
    const age = cell.tick_count - msg.sentAt;
    if (age > cell.timeoutMs) {
      if (msg.retries >= cell.maxRetries) {
        // Final timeout — give up
        timed_out.push(id);
      } else {
        msg.retries++;
        msg.sentAt = cell.tick_count;
      }
    }
  }
  // Clean up timed-out from pending
  for (const id of timed_out) cell.pending.delete(id);
  return { timed_out };
}

export function ackRate(cell: AckCell): number {
  if (cell.pending.size + cell.acked.size === 0) return 1;
  return cell.acked.size / (cell.pending.size + cell.acked.size);
}
