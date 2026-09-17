/**
 * TeacherCell — the teacher is a cell.
 *
 * Subscribes to QA tasks (which arrive as ResearchOutput IDs).
 * Generates Q&A pairs from the research summary.
 *
 * The cell is a Quilt cell with:
 *   - id: cell.teacher
 *   - inbound: cell.researcher (or cell.researcher outputs)
 *   - outbound: cell.critic
 *   - witness: { research_id, pairs, quality_score }
 */

import type { AIEngine } from '@quilt/ai';
import { MessageBus } from '../bus.js';
import type { QAOutput, ResearchOutput } from '../types.js';

export interface TeacherConfig {
  ai: AIEngine;
  bus: MessageBus;
  researcher: { get(id: string): ResearchOutput | undefined };
  id?: string;
  numPairs?: number;
}

export class TeacherCell {
  readonly id: string;
  private ai: AIEngine;
  private bus: MessageBus;
  private researcher: { get(id: string): ResearchOutput | undefined };
  private numPairs: number;
  private outputs = new Map<string, QAOutput>();

  constructor(config: TeacherConfig) {
    this.id = config.id ?? 'cell.teacher';
    this.ai = config.ai;
    this.bus = config.bus;
    this.researcher = config.researcher;
    this.numPairs = config.numPairs ?? 5;

    this.bus.subscribe('teach', (task) => this.handleTask(task));
  }

  /**
   * Handle a teach task. Expects task.context.research_id pointing to the source.
   */
  async handleTask(task: { id: string; prompt: string; context?: Record<string, unknown> }): Promise<QAOutput> {
    if (!this.bus.claim(task.id)) {
      throw new Error(`task ${task.id} already claimed`);
    }

    const researchId = task.context?.research_id as string;
    if (!researchId) {
      throw new Error('teach task requires context.research_id');
    }

    const research = this.researcher.get(researchId);
    if (!research) {
      throw new Error(`research ${researchId} not found`);
    }

    const result = await this.ai.call({
      id: `teacher:${task.id}`,
      kind: 'ai.llm',
      provider: 'zai',
      model: 'glm-4.5',
      prompt: `You are a teacher. Generate ${this.numPairs} question/answer pairs that test understanding of the following summary.

Summary:
${research.summary}

Format each pair as:
Q: [question]
A: [answer]

Q/A pairs:`,
      max_tokens: 800,
    });

    const pairs = parseQAPairs(result as string);

    const output: QAOutput = {
      research_id: researchId,
      pairs,
      quality_score: Math.min(1.0, pairs.length / this.numPairs),
      witness_hash: hashWitness({ research_id: researchId, pair_count: pairs.length }),
      produced_at: new Date().toISOString(),
    };

    this.outputs.set(task.id, output);
    this.bus.complete(task.id);

    return output;
  }

  get(taskId: string): QAOutput | undefined {
    return this.outputs.get(taskId);
  }
}

function parseQAPairs(text: string): Array<{ question: string; answer: string }> {
  const pairs: Array<{ question: string; answer: string }> = [];
  const lines = text.split('\n');
  let current: { question?: string; answer?: string } = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('Q:') || trimmed.startsWith('Q ')) {
      if (current.question && current.answer) {
        pairs.push(current as { question: string; answer: string });
      }
      current = { question: trimmed.slice(2).trim() };
    } else if (trimmed.startsWith('A:') || trimmed.startsWith('A ')) {
      current.answer = trimmed.slice(2).trim();
    }
  }

  if (current.question && current.answer) {
    pairs.push(current as { question: string; answer: string });
  }

  return pairs;
}

function hashWitness(data: { research_id: string; pair_count: number }): string {
  const str = `${data.research_id}:${data.pair_count}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return `wit-${Math.abs(hash).toString(16)}`;
}
