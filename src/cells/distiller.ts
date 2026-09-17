/**
 * DistillerCell — the distiller is a cell.
 *
 * Subscribes to synthesize tasks. Consolidates research + QA + critique into
 * a knowledge entry. Writes the entry to the knowledge store.
 *
 * The distiller is the canonical target of @quilt/evolve. The critic cell
 * generates adversarial critiques; the distiller's prompt mutates based
 * on the feedback.
 */

import type { AIEngine } from '@quilt/ai';
import { MessageBus } from '../bus.js';
import { KnowledgeStore } from '../store.js';
import type { CritiqueOutput, KnowledgeEntry, QAOutput, ResearchOutput } from '../types.js';

export interface DistillerConfig {
  ai: AIEngine;
  bus: MessageBus;
  store: KnowledgeStore;
  researcher: { get(id: string): ResearchOutput | undefined };
  teacher: { get(id: string): QAOutput | undefined };
  critic: { get(id: string): CritiqueOutput | undefined };
  id?: string;
  /** Current prompt — mutated by @quilt/evolve loop. */
  prompt?: string;
}

export class DistillerCell {
  readonly id: string;
  private ai: AIEngine;
  private bus: MessageBus;
  private store: KnowledgeStore;
  private researcher: { get(id: string): ResearchOutput | undefined };
  private teacher: { get(id: string): QAOutput | undefined };
  private critic: { get(id: string): CritiqueOutput | undefined };
  private currentPrompt: string;
  private outputs = new Map<string, KnowledgeEntry>();

  constructor(config: DistillerConfig) {
    this.id = config.id ?? 'cell.distiller';
    this.ai = config.ai;
    this.bus = config.bus;
    this.store = config.store;
    this.researcher = config.researcher;
    this.teacher = config.teacher;
    this.critic = config.critic;
    this.currentPrompt =
      config.prompt ??
      `You are a knowledge distiller. Combine research, Q&A pairs, and critique into a single coherent knowledge entry.

Research:
{research}

Q&A:
{qa}

Critique:
{critique}

Produce a topic phrase and a body paragraph (~150 words).`;

    this.bus.subscribe('synthesize', (task) => this.handleTask(task));
  }

  /**
   * Handle a synthesize task.
   */
  async handleTask(task: { id: string; prompt: string; context?: Record<string, unknown> }): Promise<KnowledgeEntry> {
    if (!this.bus.claim(task.id)) {
      throw new Error(`task ${task.id} already claimed`);
    }

    const researchId = task.context?.research_id as string;
    const qaId = task.context?.qa_id as string;
    const critiqueId = task.context?.critique_id as string;

    const research = researchId ? this.researcher.get(researchId) : undefined;
    const qa = qaId ? this.teacher.get(qaId) : undefined;
    const critique = critiqueId ? this.critic.get(critiqueId) : undefined;

    if (!research || !qa || !critique) {
      throw new Error(`synthesize task requires research_id, qa_id, and critique_id`);
    }

    const filledPrompt = this.currentPrompt
      .replace('{research}', research.summary)
      .replace('{qa}', qa.pairs.map((p) => `Q: ${p.question}\nA: ${p.answer}`).join('\n'))
      .replace('{critique}', `Accuracy: ${critique.accuracy}\nSuggestions: ${critique.suggestions.join(', ')}`);

    const result = await this.ai.call({
      id: `distiller:${task.id}`,
      kind: 'ai.llm',
      provider: 'zai',
      model: 'glm-4.5',
      prompt: filledPrompt,
      max_tokens: 400,
    });

    const text = (result as string).trim();
    const lines = text.split('\n');
    const topic = lines[0].replace(/^(topic|Topic):\s*/i, '').trim() || research.summary.slice(0, 60);
    const body = lines.slice(1).join('\n').trim() || text;

    const entry: KnowledgeEntry = {
      id: `entry-${task.id}`,
      topic,
      body,
      sources: research.sources.map((s) => s.url),
      qa_pairs: qa.pairs,
      confidence: (research.confidence + critique.accuracy + critique.completeness) / 3,
      provenance: {
        research: research.witness_hash,
        qa: qa.witness_hash,
        critique: critique.witness_hash,
        distilled: hashWitness({ topic, body: body.slice(0, 100) }),
      },
      produced_at: new Date().toISOString(),
      witness_chain: [research.witness_hash, qa.witness_hash, critique.witness_hash],
    };

    this.outputs.set(task.id, entry);
    this.store.add(entry);
    this.bus.complete(task.id);

    return entry;
  }

  /**
   * Get the current prompt. Used by the @quilt/evolve loop.
   */
  getPrompt(): string {
    return this.currentPrompt;
  }

  /**
   * Set a new prompt. Used by the @quilt/evolve loop to mutate.
   */
  setPrompt(prompt: string): void {
    this.currentPrompt = prompt;
  }

  get(taskId: string): KnowledgeEntry | undefined {
    return this.outputs.get(taskId);
  }
}

function hashWitness(data: { topic: string; body: string }): string {
  const str = `${data.topic}:${data.body}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return `wit-${Math.abs(hash).toString(16)}`;
}
