/**
 * Shared types for quilt-claw.
 *
 * Each type mirrors a cell kind. Tasks flow from input → bus → cells → store.
 */

export interface Task {
  id: string;
  kind: 'research' | 'teach' | 'critique' | 'synthesize' | 'evolve';
  prompt: string;
  context?: Record<string, unknown>;
  created_at: string;
  source?: string;
}

export interface ResearchOutput {
  task_id: string;
  summary: string;
  sources: Array<{ url: string; title: string; snippet: string }>;
  confidence: number;
  witness_hash: string;
  produced_at: string;
}

export interface QAOutput {
  research_id: string;
  pairs: Array<{ question: string; answer: string }>;
  quality_score: number;
  witness_hash: string;
  produced_at: string;
}

export interface CritiqueOutput {
  qa_id: string;
  accuracy: number;
  completeness: number;
  flagged_claims: string[];
  suggestions: string[];
  witness_hash: string;
  produced_at: string;
}

export interface KnowledgeEntry {
  id: string;
  topic: string;
  body: string;
  sources: string[];
  qa_pairs: Array<{ question: string; answer: string }>;
  confidence: number;
  provenance: {
    research: string;
    qa: string;
    critique: string;
    distilled: string;
  };
  produced_at: string;
  witness_chain: string[];
}
