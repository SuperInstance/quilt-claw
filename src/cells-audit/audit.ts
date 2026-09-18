/**
 * cell.audit — witness log forensic analysis
 *
 * Promoted from sunset-ecosystem/audit/.
 * Analyzes witness chains: detects missing entries, computes Merkle roots, finds anomalies.
 */

export interface Witness {
  type: string;
  address: string;
  t: number;
  data?: any;
}

export interface AuditCell {
  log: Witness[];
  expectedCount: number;
}

export function createAuditCell(log: Witness[], expectedCount?: number): AuditCell {
  return { log, expectedCount: expectedCount ?? log.length };
}

export function detectGaps(cell: AuditCell): number[] {
  // Detect missing witness indices (assumes sequential addresses 0..N)
  const addresses = cell.log.map(w => parseInt(w.address.replace(/\D/g, '')) || 0);
  const max = Math.max(...addresses);
  const seen = new Set(addresses);
  const gaps: number[] = [];
  for (let i = 0; i <= max; i++) {
    if (!seen.has(i)) gaps.push(i);
  }
  return gaps;
}

export function merkleRoot(cell: AuditCell): string {
  // Simple hash chain: hash of all witness signatures
  // In production: SHA-256 over canonicalized witnesses
  let h = 0;
  for (const w of cell.log) {
    h = ((h << 5) - h + w.type.length + w.address.length + w.t) | 0;
  }
  return h.toString(16).padStart(8, '0');
}

export function detectAnomalies(cell: AuditCell, expectedType: string): Witness[] {
  return cell.log.filter(w => w.type !== expectedType);
}

export function completeness(cell: AuditCell): number {
  if (cell.expectedCount === 0) return 1;
  return cell.log.length / cell.expectedCount;
}
