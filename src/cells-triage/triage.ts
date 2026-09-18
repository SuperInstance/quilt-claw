/**
 * cell.triage — Priority assignment via drift detection
 *
 * Extracted from sunset-ecosystem/triage/drift_detect.py (SPEC-REPO-METRIC §7).
 *
 * Detects structural drift and assigns priority:
 *   - Stale dependencies (security advisories)
 *   - Test regression (tests that were passing now failing)
 *   - Documentation drift (README references missing files)
 *   - Dead code accumulation (unimported files)
 *   - Branch divergence (local vs remote)
 *
 * Severity: low / medium / high / critical.
 *
 * Substrate-free: composes via BIND/LINK/EFFECT.
 */

export type Severity = 'low' | 'medium' | 'high' | 'critical';

export interface DriftReport {
  repo: string;
  staleDependencies: string[];
  testRegression: string | null;
  docDrift: string[];
  deadCode: string[];
  branchDivergence: string | null;
  licenseChange: string | null;
  severity: Severity;
}

export interface TriageCell {
  id: string;
  reports: Map<string, DriftReport>;
  tickCount: number;
}

export function createTriageCell(id: string = 'triage'): TriageCell {
  return { id, reports: new Map(), tickCount: 0 };
}

const SEVERITY_RANK: Record<Severity, number> = {
  'low': 1,
  'medium': 2,
  'high': 3,
  'critical': 4
};

export function detectDrift(repo: string, signals: {
  staleDeps?: string[];
  testRegressions?: string[];
  docDrift?: string[];
  deadCode?: string[];
  branchDivergence?: string;
  licenseChange?: string;
}): DriftReport {
  const score =
    (signals.staleDeps?.length || 0) * 2 +
    (signals.testRegressions?.length || 0) * 3 +
    (signals.docDrift?.length || 0) * 1 +
    (signals.deadCode?.length || 0) * 1 +
    (signals.branchDivergence ? 2 : 0) +
    (signals.licenseChange ? 4 : 0);
  let severity: Severity = 'low';
  if (score >= 10) severity = 'critical';
  else if (score >= 6) severity = 'high';
  else if (score >= 3) severity = 'medium';

  return {
    repo,
    staleDependencies: signals.staleDeps || [],
    testRegression: signals.testRegressions?.length ? signals.testRegressions.join(',') : null,
    docDrift: signals.docDrift || [],
    deadCode: signals.deadCode || [],
    branchDivergence: signals.branchDivergence || null,
    licenseChange: signals.licenseChange || null,
    severity
  };
}

export function submit(cell: TriageCell, report: DriftReport): void {
  cell.reports.set(report.repo, report);
  cell.tickCount++;
}

export function highestPriority(cell: TriageCell): DriftReport | null {
  let best: DriftReport | null = null;
  for (const r of cell.reports.values()) {
    if (!best || SEVERITY_RANK[r.severity] > SEVERITY_RANK[best.severity]) {
      best = r;
    }
  }
  return best;
}

export function filterBySeverity(cell: TriageCell, min: Severity): DriftReport[] {
  const threshold = SEVERITY_RANK[min];
  return Array.from(cell.reports.values())
    .filter(r => SEVERITY_RANK[r.severity] >= threshold)
    .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);
}

export function dedupByRepo(cell: TriageCell): number {
  // If two reports for same repo, keep highest severity
  const seen = new Map<string, DriftReport>();
  let removed = 0;
  for (const r of cell.reports.values()) {
    const existing = seen.get(r.repo);
    if (!existing) {
      seen.set(r.repo, r);
    } else if (SEVERITY_RANK[r.severity] > SEVERITY_RANK[existing.severity]) {
      seen.set(r.repo, r);
      removed++;
    }
  }
  cell.reports = seen;
  return removed;
}

export function summary(cell: TriageCell): { critical: number; high: number; medium: number; low: number } {
  const out = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const r of cell.reports.values()) out[r.severity]++;
  return out;
}
