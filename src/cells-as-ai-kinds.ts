/**
 * quilt-claw cell kinds as @quilt/ai canonical cell kinds.
 *
 * Promotion: the 4 crew roles are promoted from "user-defined cell" to
 * "canonical ai.* cell kind". The AIEngine can now natively spawn them
 * and they share the same engine as ai.llm, ai.embed, ai.code, etc.
 *
 * The 4 new kinds:
 *   ai.researcher  — given a topic + sources, write a research summary
 *   ai.teacher     — given a summary, write QA pairs
 *   ai.critic      — given QA pairs, evaluate accuracy/completeness
 *   ai.distiller   — given (research, qa, critique), write a knowledge entry
 *
 * Each is a 3-component cell:
 *   1. Provider (which LLM)
 *   2. Prompt template (with {{topic}}, {{summary}}, etc. substitutions)
 *   3. Output schema (witness hash + confidence)
 */

import type { AIEngine } from '@quilt/ai';

/** ai.researcher config. */
export interface AIResearcherConfig {
  /** Cell id. */
  id: string;
  /** Cell kind discriminator. */
  kind: 'ai.researcher';
  /** Which provider. */
  provider: string;
  /** Which model. */
  model: string;
  /** The topic to research. */
  topic: string;
  /** Optional sources to draw from. */
  sources?: Array<{ url: string; title: string; snippet: string }>;
  /** Optional: max tokens. */
  max_tokens?: number;
}

/** ai.researcher output. */
export interface ResearchOutput {
  topic: string;
  summary: string;
  sources: Array<{ url: string; title: string; snippet: string }>;
  confidence: number;
  witness_hash: string;
  produced_at: string;
}

/** Call the ai.researcher cell. */
export async function callResearcher(engine: AIEngine, config: AIResearcherConfig): Promise<ResearchOutput> {
  const sourcesText = (config.sources ?? [])
    .map(s => `- ${s.title}: ${s.snippet} (${s.url})`)
    .join('\n');

  const prompt = `Research the topic: ${config.topic}

Sources:
${sourcesText}

Write a concise research summary (200-500 words) that:
1. Captures the key facts
2. Cites the sources inline
3. Notes any uncertainty

Summary:`;

  const result = await engine.call({
    id: config.id,
    kind: 'ai.llm',
    provider: config.provider,
    model: config.model,
    prompt,
    max_tokens: config.max_tokens ?? 1000,
    response_format: 'text',
  });

  const summary = (result as { content: string }).content;
  // Witness hash = sha256(topic + summary length + timestamp)
  const witness_hash = await sha256(`${config.topic}:${summary.length}:${Date.now()}`);

  return {
    topic: config.topic,
    summary,
    sources: config.sources ?? [],
    confidence: 0.7,  // heuristic; LLM-as-judge would give a real number
    witness_hash,
    produced_at: new Date().toISOString(),
  };
}

/** ai.teacher config. */
export interface AITeacherConfig {
  id: string;
  kind: 'ai.teacher';
  provider: string;
  model: string;
  /** The research output to teach from. */
  research: ResearchOutput;
  /** Optional: number of QA pairs to generate. */
  num_pairs?: number;
}

export interface QAOutput {
  research_id: string;
  pairs: Array<{ question: string; answer: string }>;
  quality_score: number;
  witness_hash: string;
  produced_at: string;
}

export async function callTeacher(engine: AIEngine, config: AITeacherConfig): Promise<QAOutput> {
  const num = config.num_pairs ?? 5;
  const prompt = `From this research summary, generate ${num} question-answer pairs that test understanding:

Summary:
${config.research.summary}

For each pair, ask a question that someone who only read the summary could answer, then give the answer.

Format:
Q1: ...
A1: ...
Q2: ...
A2: ...`;

  const result = await engine.call({
    id: config.id,
    kind: 'ai.llm',
    provider: config.provider,
    model: config.model,
    prompt,
    max_tokens: 1500,
  });

  const text = (result as { content: string }).content;
  const pairs = parseQAPairs(text);

  const quality_score = Math.min(1, pairs.length / num);
  const witness_hash = await sha256(`${config.research.witness_hash}:${pairs.length}`);

  return {
    research_id: config.research.witness_hash,
    pairs,
    quality_score,
    witness_hash,
    produced_at: new Date().toISOString(),
  };
}

function parseQAPairs(text: string): Array<{ question: string; answer: string }> {
  const pairs: Array<{ question: string; answer: string }> = [];
  const lines = text.split('\n');
  let i = 0;
  while (i < lines.length) {
    const qMatch = lines[i].match(/^Q\d+:\s*(.+)$/);
    if (qMatch && i + 1 < lines.length) {
      const aMatch = lines[i + 1].match(/^A\d+:\s*(.+)$/);
      if (aMatch) {
        pairs.push({ question: qMatch[1], answer: aMatch[1] });
        i += 2;
        continue;
      }
    }
    i++;
  }
  return pairs;
}

/** ai.critic config. */
export interface AICriticConfig {
  id: string;
  kind: 'ai.critic';
  provider: string;
  model: string;
  qa: QAOutput;
  research: ResearchOutput;
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

export async function callCritic(engine: AIEngine, config: AICriticConfig): Promise<CritiqueOutput> {
  const prompt = `Evaluate the quality of these QA pairs against the source research:

Research:
${config.research.summary}

QA pairs:
${config.qa.pairs.map((p, i) => `Q${i+1}: ${p.question}\nA${i+1}: ${p.answer}`).join('\n')}

Evaluate:
- Accuracy (0-1): are the answers faithful to the source?
- Completeness (0-1): do the questions cover the key points?
- Flag any incorrect or unsupported claims.

Format:
Accuracy: 0.85
Completeness: 0.80
Flagged: [list any flagged claims]
Suggestions: [list 1-3 improvement suggestions]`;

  const result = await engine.call({
    id: config.id,
    kind: 'ai.llm',
    provider: config.provider,
    model: config.model,
    prompt,
    max_tokens: 800,
  });

  const text = (result as { content: string }).content;
  const { accuracy, completeness, flagged, suggestions } = parseCritique(text);

  const witness_hash = await sha256(`${config.qa.witness_hash}:${accuracy}:${completeness}`);

  return {
    qa_id: config.qa.witness_hash,
    accuracy,
    completeness,
    flagged_claims: flagged,
    suggestions,
    witness_hash,
    produced_at: new Date().toISOString(),
  };
}

function parseCritique(text: string): {
  accuracy: number;
  completeness: number;
  flagged: string[];
  suggestions: string[];
} {
  const accuracyMatch = text.match(/Accuracy:\s*([\d.]+)/);
  const completenessMatch = text.match(/Completeness:\s*([\d.]+)/);
  const flaggedMatch = text.match(/Flagged:\s*\[(.*?)\]/s);
  const suggestionsMatch = text.match(/Suggestions:\s*\[(.*?)\]/s);

  return {
    accuracy: accuracyMatch ? parseFloat(accuracyMatch[1]) : 0.5,
    completeness: completenessMatch ? parseFloat(completenessMatch[1]) : 0.5,
    flagged: flaggedMatch ? flaggedMatch[1].split(',').map(s => s.trim()) : [],
    suggestions: suggestionsMatch ? suggestionsMatch[1].split(',').map(s => s.trim()) : [],
  };
}

/** ai.distiller config. */
export interface AIDistillerConfig {
  id: string;
  kind: 'ai.distiller';
  provider: string;
  model: string;
  research: ResearchOutput;
  qa: QAOutput;
  critique: CritiqueOutput;
  /** Optional: prompt template (overridable by @quilt/evolve). */
  promptTemplate?: string;
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

export async function callDistiller(engine: AIEngine, config: AIDistillerConfig): Promise<KnowledgeEntry> {
  const template = config.promptTemplate ??
    `You are the distiller. Consolidate the research, QA pairs, and critique into a final knowledge entry. The entry should:
- Be a single coherent piece of writing (300-800 words)
- Cite the sources inline
- Reflect the critique (fix flagged claims, apply suggestions)
- Maintain the QA pairs as a reference appendix

Write the entry now:`;

  const prompt = `${template}

Topic: ${config.research.topic}

Research:
${config.research.summary}

QA pairs:
${config.qa.pairs.map((p, i) => `Q${i+1}: ${p.question}\nA${i+1}: ${p.answer}`).join('\n')}

Critique:
${JSON.stringify(config.critique, null, 2)}`;

  const result = await engine.call({
    id: config.id,
    kind: 'ai.llm',
    provider: config.provider,
    model: config.model,
    prompt,
    max_tokens: 2000,
  });

  const body = (result as { content: string }).content;
  const distilled_hash = await sha256(`distill:${body.length}:${Date.now()}`);

  const confidence = (config.research.confidence + config.critique.accuracy + config.critique.completeness) / 3;

  return {
    id: `entry-${distilled_hash.slice(0, 12)}`,
    topic: config.research.topic,
    body,
    sources: config.research.sources.map(s => s.url),
    qa_pairs: config.qa.pairs,
    confidence,
    provenance: {
      research: config.research.witness_hash,
      qa: config.qa.witness_hash,
      critique: config.critique.witness_hash,
      distilled: distilled_hash,
    },
    produced_at: new Date().toISOString(),
    witness_chain: [
      config.research.witness_hash,
      config.qa.witness_hash,
      config.critique.witness_hash,
      distilled_hash,
    ],
  };
}

/** SHA-256 (browser-safe via WebCrypto or Node crypto). */
async function sha256(text: string): Promise<string> {
  if (typeof globalThis.crypto?.subtle !== 'undefined') {
    const buf = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback: Node crypto
  const { createHash } = await import('crypto');
  return createHash('sha256').update(text).digest('hex');
}

/** Run the full pipeline. */
export async function runKnowledgeCrew(engine: AIEngine, opts: {
  topic: string;
  sources?: Array<{ url: string; title: string; snippet: string }>;
  provider?: string;
  model?: string;
}): Promise<KnowledgeEntry> {
  const provider = opts.provider ?? 'zai';
  const model = opts.model ?? 'glm-4.5';

  const research = await callResearcher(engine, {
    id: `r-${opts.topic}`,
    kind: 'ai.researcher',
    provider,
    model,
    topic: opts.topic,
    sources: opts.sources,
  });

  const qa = await callTeacher(engine, {
    id: `t-${opts.topic}`,
    kind: 'ai.teacher',
    provider,
    model,
    research,
  });

  const critique = await callCritic(engine, {
    id: `c-${opts.topic}`,
    kind: 'ai.critic',
    provider,
    model,
    qa,
    research,
  });

  return await callDistiller(engine, {
    id: `d-${opts.topic}`,
    kind: 'ai.distiller',
    provider,
    model,
    research,
    qa,
    critique,
  });
}
