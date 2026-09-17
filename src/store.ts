/**
 * KnowledgeStore — the store is a cell.
 *
 * The knowledge store in autoclaw is a hot/warm/cold tiered filesystem.
 * In quilt-claw, it's an in-memory store with semantic search.
 *
 * Each entry has a witness chain that records:
 *   - The research cell that produced the source
 *   - The teacher cell that generated Q&A pairs
 *   - The critic cell that evaluated quality
 *   - The distiller cell that consolidated the entry
 *
 * Together those four cells form the witness chain. If any cell is missing
 * from the chain, the entry is suspect.
 */

import type { KnowledgeEntry } from './types.js';

export class KnowledgeStore {
  private entries = new Map<string, KnowledgeEntry>();
  private topicIndex = new Map<string, Set<string>>();

  /**
   * Add a knowledge entry to the store.
   * Returns the entry id.
   */
  add(entry: KnowledgeEntry): string {
    this.entries.set(entry.id, entry);

    // Index by topic (split on whitespace, lowercase)
    for (const word of entry.topic.toLowerCase().split(/\s+/)) {
      if (!this.topicIndex.has(word)) {
        this.topicIndex.set(word, new Set());
      }
      this.topicIndex.get(word)!.add(entry.id);
    }

    return entry.id;
  }

  /**
   * Get an entry by id.
   */
  get(id: string): KnowledgeEntry | undefined {
    return this.entries.get(id);
  }

  /**
   * Search entries by query.
   * Simple keyword scoring — production version would use embeddings.
   */
  search(query: string, limit = 10): KnowledgeEntry[] {
    const queryWords = query.toLowerCase().split(/\s+/).filter((w) => w.length > 0);
    const scores = new Map<string, number>();

    for (const word of queryWords) {
      const matching = this.topicIndex.get(word);
      if (!matching) continue;
      for (const entryId of matching) {
        scores.set(entryId, (scores.get(entryId) ?? 0) + 1);
      }
      // Also check entry body
      for (const entry of this.entries.values()) {
        if (entry.body.toLowerCase().includes(word)) {
          scores.set(entry.id, (scores.get(entry.id) ?? 0) + 0.5);
        }
      }
    }

    return Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id]) => this.entries.get(id)!)
      .filter((e) => e !== undefined);
  }

  /**
   * Verify an entry's witness chain. All four cells must have signed.
   */
  verify(id: string): { valid: boolean; missing: string[] } {
    const entry = this.entries.get(id);
    if (!entry) return { valid: false, missing: ['entry not found'] };

    const missing: string[] = [];
    if (!entry.provenance.research) missing.push('research');
    if (!entry.provenance.qa) missing.push('qa');
    if (!entry.provenance.critique) missing.push('critique');
    if (!entry.provenance.distilled) missing.push('distilled');

    return { valid: missing.length === 0, missing };
  }

  /**
   * Dump the store state for debugging.
   */
  dump(): {
    entries: number;
    topics: number;
    avgConfidence: number;
  } {
    let totalConf = 0;
    for (const e of this.entries.values()) {
      totalConf += e.confidence;
    }
    return {
      entries: this.entries.size,
      topics: this.topicIndex.size,
      avgConfidence: this.entries.size > 0 ? totalConf / this.entries.size : 0,
    };
  }
}
