/**
 * cell.lore — Codebase state snapshot
 *
 * Extracted from sunset-ecosystem/logos/codebase_state.py.
 *
 * Snapshots a directory tree, computes file sizes/languages/patterns,
 * detects technical debt (TODO/FIXME/HACK/XXX markers).
 *
 * Each snapshot is a witness. The witness log = codebase history.
 */

export interface FileEntry {
  path: string;
  size: number;
  language: string | null;
  lines: number;
  debtMarkers: DebtMarker[];
}

export interface DebtMarker {
  type: 'TODO' | 'FIXME' | 'HACK' | 'XXX' | 'NOTE';
  line: number;
  text: string;
}

export interface CodebaseSnapshot {
  timestamp: number;
  rootPath: string;
  totalFiles: number;
  totalLines: number;
  totalSize: number;
  languages: Map<string, number>;
  debtMarkers: Map<string, number>;
  files: FileEntry[];
}

const LANGUAGE_MAP: Record<string, string> = {
  '.py': 'Python', '.js': 'JavaScript', '.ts': 'TypeScript', '.tsx': 'TypeScript',
  '.jsx': 'JavaScript', '.rs': 'Rust', '.go': 'Go', '.rb': 'Ruby',
  '.java': 'Java', '.kt': 'Kotlin', '.c': 'C', '.cpp': 'C++',
  '.h': 'C/C++ Header', '.hpp': 'C++ Header', '.md': 'Markdown',
  '.json': 'JSON', '.yaml': 'YAML', '.yml': 'YAML', '.toml': 'TOML',
  '.html': 'HTML', '.css': 'CSS', '.sh': 'Shell', '.sql': 'SQL',
};

const DEBT_PATTERNS: Array<{ type: DebtMarker['type']; re: RegExp }> = [
  { type: 'TODO', re: /\b(TODO|to-do|to do)\b/i },
  { type: 'FIXME', re: /\bFIXME\b/ },
  { type: 'HACK', re: /\bHACK\b/ },
  { type: 'XXX', re: /\bXXX\b/ },
  { type: 'NOTE', re: /\bNOTE\b/i }
];

export interface LoreCell {
  id: string;
  snapshots: CodebaseSnapshot[];
  tickCount: number;
}

export function createLoreCell(id: string = 'lore'): LoreCell {
  return {
    id,
    snapshots: [],
    tickCount: 0
  };
}

export function scanFiles(files: Array<{ path: string; content: string; size: number }>, rootPath: string): CodebaseSnapshot {
  const entries: FileEntry[] = [];
  const languages = new Map<string, number>();
  const debtMap = new Map<string, number>();
  let totalLines = 0;
  let totalSize = 0;

  for (const f of files) {
    const ext = f.path.substring(f.path.lastIndexOf('.'));
    const lang = LANGUAGE_MAP[ext] ?? null;
    if (lang) {
      languages.set(lang, (languages.get(lang) ?? 0) + 1);
    }
    const lines = f.content.split('\n').length;
    totalLines += lines;
    totalSize += f.size;

    const debt = scanDebtMarkers(f.content);
    for (const d of debt) {
      debtMap.set(d.type, (debtMap.get(d.type) ?? 0) + 1);
    }
    entries.push({
      path: f.path,
      size: f.size,
      language: lang,
      lines,
      debtMarkers: debt
    });
  }

  const snap: CodebaseSnapshot = {
    timestamp: Date.now(),
    rootPath,
    totalFiles: files.length,
    totalLines,
    totalSize,
    languages,
    debtMarkers: debtMap,
    files: entries
  };
  return snap;
}

export function recordSnapshot(cell: LoreCell, snapshot: CodebaseSnapshot): void {
  cell.snapshots.push(snapshot);
  cell.tickCount++;
}

export function scanDebtMarkers(content: string): DebtMarker[] {
  const found: DebtMarker[] = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const p of DEBT_PATTERNS) {
      const m = p.re.exec(line);
      if (m) {
        found.push({
          type: p.type,
          line: i + 1,
          text: line.trim()
        });
      }
    }
  }
  return found;
}

export function latestSnapshot(cell: LoreCell): CodebaseSnapshot | null {
  return cell.snapshots.length === 0 ? null : cell.snapshots[cell.snapshots.length - 1];
}

export function debtByType(cell: LoreCell, type: DebtMarker['type']): number {
  const latest = latestSnapshot(cell);
  if (!latest) return 0;
  return latest.debtMarkers.get(type) ?? 0;
}

export function totalDebt(cell: LoreCell): number {
  const latest = latestSnapshot(cell);
  if (!latest) return 0;
  let total = 0;
  for (const v of latest.debtMarkers.values()) total += v;
  return total;
}

export function topLanguages(cell: LoreCell, n: number = 3): Array<[string, number]> {
  const latest = latestSnapshot(cell);
  if (!latest) return [];
  return [...latest.languages.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}

export function biggestFiles(cell: LoreCell, n: number = 5): FileEntry[] {
  const latest = latestSnapshot(cell);
  if (!latest) return [];
  return [...latest.files].sort((a, b) => b.size - a.size).slice(0, n);
}

export function debtHotspots(cell: LoreCell, n: number = 5): FileEntry[] {
  const latest = latestSnapshot(cell);
  if (!latest) return [];
  return [...latest.files].sort((a, b) => b.debtMarkers.length - a.debtMarkers.length).slice(0, n);
}

export function growthRate(cell: LoreCell): number {
  if (cell.snapshots.length < 2) return 0;
  const first = cell.snapshots[0];
  const last = cell.snapshots[cell.snapshots.length - 1];
  const linesDelta = last.totalLines - first.totalLines;
  const timeDelta = last.timestamp - first.timestamp;
  if (timeDelta === 0) return 0;
  return (linesDelta / timeDelta) * 1000 * 60 * 60 * 24;  // lines/day
}

export function summary(cell: LoreCell): string {
  const s = latestSnapshot(cell);
  if (!s) return 'no snapshot';
  return `${s.totalFiles} files, ${s.totalLines} lines, ${totalDebt(cell)} debt markers`;
}
