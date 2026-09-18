/**
 * cell.ranking — Collect rankings and preference signals
 *
 * Extracted from sunset-ecosystem/ranking/user_ranking.py.
 *
 * A user ranks 2-4 responses; the "why" is the distillation signal.
 * 10 preference tags extracted from user notes via regex patterns:
 *   concise | thorough | code_examples | too_verbose | correct |
 *   incorrect | helpful | too_abstract | fast | slow
 *
 * Substrate-free: composes via BIND/LINK/EFFECT.
 */

export interface RankedResponse {
  id: string;
  text: string;
  rank: number; // 1 = best
}

export interface UserRanking {
  prompt: string;
  responses: RankedResponse[];
  userNotes: string;
  tags: string[];
  timestamp: number;
}

export interface RankingCell {
  rankings: UserRanking[];
  responses: Map<string, RankedResponse>; // id → response, for cross-referencing
  tickCount: number;
}

const PREFERENCE_PATTERNS: Record<string, RegExp[]> = {
  concise: [/\bconcise\b/i, /\bbrief\b/i, /\bshort\b/i, /\bterse\b/i, /to the point/i],
  thorough: [/\bthorough\b/i, /\bdetailed\b/i, /\bcomprehensive\b/i, /\bcomplete\b/i, /\bexhaustive\b/i],
  code_examples: [/code example/i, /show me code/i, /code snippet/i, /\bimplementation\b/i],
  too_verbose: [/too long/i, /\bverbose\b/i, /\bwordy\b/i, /\brambling\b/i, /too much/i],
  correct: [/\bcorrect\b/i, /\baccurate\b/i, /\bright\b/i, /spot on/i, /\bexactly\b/i],
  incorrect: [/\bwrong\b/i, /\bincorrect\b/i, /\bmistake\b/i, /\berror\b/i, /\bbad\b/i],
  helpful: [/\bhelpful\b/i, /\buseful\b/i, /\bpractical\b/i, /\bactionable\b/i],
  too_abstract: [/\babstract\b/i, /\btheoretical\b/i, /\bvague\b/i, /\bunclear\b/i],
  fast: [/\bfast\b/i, /\bquick\b/i, /\bresponsive\b/i, /\bimmediate\b/i],
  slow: [/\bslow\b/i, /took too long/i, /\blaggy\b/i]
};

export function extractTags(notes: string): string[] {
  const found: string[] = [];
  for (const [tag, patterns] of Object.entries(PREFERENCE_PATTERNS)) {
    for (const re of patterns) {
      if (re.test(notes)) {
        found.push(tag);
        break;
      }
    }
  }
  return found;
}

export function createRankingCell(): RankingCell {
  return { rankings: [], responses: new Map(), tickCount: 0 };
}

export function submitRanking(
  cell: RankingCell,
  prompt: string,
  responses: RankedResponse[],
  userNotes: string = ''
): UserRanking {
  // Cross-reference responses
  for (const r of responses) {
    cell.responses.set(r.id, r);
  }
  const r: UserRanking = {
    prompt,
    responses,
    userNotes,
    tags: extractTags(userNotes),
    timestamp: Date.now()
  };
  cell.rankings.push(r);
  cell.tickCount++;
  return r;
}

export function bestResponse(ranking: UserRanking): RankedResponse | null {
  const ranked = ranking.responses.filter(r => r.rank > 0);
  if (ranked.length === 0) return null;
  return ranked.reduce((a, b) => a.rank < b.rank ? a : b);
}

export function worstResponse(ranking: UserRanking): RankedResponse | null {
  const ranked = ranking.responses.filter(r => r.rank > 0);
  if (ranked.length === 0) return null;
  return ranked.reduce((a, b) => a.rank > b.rank ? a : b);
}

export function tagCounts(cell: RankingCell): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const r of cell.rankings) {
    for (const tag of r.tags) {
      counts[tag] = (counts[tag] || 0) + 1;
    }
  }
  return counts;
}

export function topPreference(cell: RankingCell): string | null {
  const counts = tagCounts(cell);
  let best: string | null = null;
  let max = 0;
  for (const [tag, n] of Object.entries(counts)) {
    if (n > max) { max = n; best = tag; }
  }
  return best;
}

export function rankingsByTag(cell: RankingCell, tag: string): UserRanking[] {
  return cell.rankings.filter(r => r.tags.includes(tag));
}
