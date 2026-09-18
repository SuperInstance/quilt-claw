/**
 * cell.feedback — user preference signals as canonical Quilt cell kind
 *
 * Promoted from sunset-ecosystem/ranking/user_ranking.py.
 * Detects preference tags from user notes via lexical patterns.
 *
 * Reference: _PREFERENCE_PATTERNS in user_ranking.py
 */

export type PreferenceTag =
  | 'concise' | 'thorough' | 'code_examples' | 'too_verbose'
  | 'correct' | 'incorrect' | 'helpful' | 'too_abstract'
  | 'fast' | 'slow';

const PATTERNS: Record<PreferenceTag, RegExp[]> = {
  concise: [/\bconcise\b/i, /\bbrief\b/i, /\bshort\b/i, /\bterr?se\b/i, /to the point/i],
  thorough: [/\bthorough\b/i, /\bdetailed\b/i, /\bcomprehensive\b/i, /\bcomplete\b/i, /\bexhaustive\b/i],
  code_examples: [/code example/i, /show me code/i, /code snippet/i, /implementation/i],
  too_verbose: [/too long/i, /\bverbose\b/i, /\bwordy\b/i, /\brambling\b/i, /too much/i],
  correct: [/\bcorrect\b/i, /\baccurate\b/i, /\bright\b/i, /spot on/i, /\bexactly\b/i],
  incorrect: [/\bwrong\b/i, /\bincorrect\b/i, /\bmistake\b/i, /\berror\b/i, /\bbad\b/i],
  helpful: [/\bhelpful\b/i, /\buseful\b/i, /\bpractical\b/i, /\bactionable\b/i],
  too_abstract: [/\babstract\b/i, /\btheoretical\b/i, /\bvague\b/i, /\bunclear\b/i],
  fast: [/\bfast\b/i, /\bquick\b/i, /\bresponsive\b/i, /\bimmediate\b/i],
  slow: [/\bslow\b/i, /took too long/i, /\blaggy\b/i],
};

export interface FeedbackCell {
  notes: string;
  detectedTags: Map<PreferenceTag, number>;
  history: { t: number; tags: PreferenceTag[]; score: number }[];
}

export function createFeedbackCell(notes = ''): FeedbackCell {
  const cell: FeedbackCell = {
    notes,
    detectedTags: new Map(),
    history: [],
  };
  analyze(cell);
  return cell;
}

export function setNotes(cell: FeedbackCell, notes: string): void {
  cell.notes = notes;
  cell.detectedTags.clear();
  analyze(cell);
}

export function analyze(cell: FeedbackCell): void {
  for (const [tag, patterns] of Object.entries(PATTERNS)) {
    let count = 0;
    for (const re of patterns) {
      const m = cell.notes.match(new RegExp(re.source, re.flags + 'g'));
      if (m) count += m.length;
    }
    if (count > 0) cell.detectedTags.set(tag as PreferenceTag, count);
  }
}

/** A simple "preference profile" — positive vs negative counts */
export function score(cell: FeedbackCell): number {
  const positive = ['correct', 'helpful', 'fast'];
  const negative = ['incorrect', 'too_verbose', 'slow', 'too_abstract'];
  let s = 0;
  for (const tag of positive) s += cell.detectedTags.get(tag as PreferenceTag) ?? 0;
  for (const tag of negative) s -= cell.detectedTags.get(tag as PreferenceTag) ?? 0;
  return s;
}

export function topTags(cell: FeedbackCell, n = 3): PreferenceTag[] {
  return Array.from(cell.detectedTags.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([t]) => t);
}
