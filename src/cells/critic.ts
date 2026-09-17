/**
 * CriticCell — the critic is a cell.
 *
 * Subscribes to critique tasks (QAOutput IDs). Evaluates the quality.
 *
 * The critic cell IS an `@quilt/evolve` loop when wired to the distiller.
 *   - Generator: adversarial inputs (tricky questions for the teacher)
 *   - Judge: heuristic score of QA quality
 *   - Mutator: rewrites the teacher's prompt
 *   - System: the teacher cell (or the distiller cell)
 *   - Loop: improves the distiller over time
 */

import type { AIEngine } from '@quilt/ai';
import { MessageBus } from '../bus.js';
import type { CritiqueOutput, QAOutput } from '../types.js';

export interface CriticConfig {
  ai: AIEngine;
  bus: MessageBus;
  teacher: { get(id: string): QAOutput | undefined };
  id?: string;
}

export class CriticCell {
  readonly id: string;
  private ai: AIEngine;
  private bus: MessageBus;
  private teacher: { get(id: string): QAOutput | undefined };
  private outputs = new Map<string, CritiqueOutput>();

  constructor(config: CriticConfig) {
    this.id = config.id ?? 'cell.critic';
    this.ai = config.ai;
    this.bus = config.bus;
    this.teacher = config.teacher;

    this.bus.subscribe('critique', (task) => this.handleTask(task));
  }

  /**
   * Handle a critique task.
   */
  async handleTask(task: { id: string; prompt: string; context?: Record<string, unknown> }): Promise<CritiqueOutput> {
    if (!this.bus.claim(task.id)) {
      throw new Error(`task ${task.id} already claimed`);
    }

    const qaId = task.context?.qa_id as string;
    if (!qaId) {
      throw new Error('critique task requires context.qa_id');
    }

    const qa = this.teacher.get(qaId);
    if (!qa) {
      throw new Error(`qa ${qaId} not found`);
    }

    const flagged: string[] = [];
    const suggestions: string[] = [];

    let totalScore = 0;
    for (const pair of qa.pairs) {
      // Heuristic: short questions/answers lose points
      const qScore = pair.question.length > 10 ? 1 : 0.3;
      const aScore = pair.answer.length > 20 ? 1 : 0.5;
      const pairScore = (qScore + aScore) / 2;
      totalScore += pairScore;

      if (pair.question.length < 10) {
        flagged.push(`Q too short: "${pair.question}"`);
        suggestions.push('Expand the question with more context');
      }
      if (pair.answer.length < 20) {
        flagged.push(`A too short for: "${pair.question}"`);
        suggestions.push('Provide a more complete answer');
      }
    }

    const accuracy = totalScore / qa.pairs.length;
    const completeness = qa.pairs.length >= 5 ? 1.0 : qa.pairs.length / 5;

    const output: CritiqueOutput = {
      qa_id: qaId,
      accuracy,
      completeness,
      flagged_claims: flagged,
      suggestions,
      witness_hash: hashWitness({ qa_id: qaId, accuracy, completeness }),
      produced_at: new Date().toISOString(),
    };

    this.outputs.set(task.id, output);
    this.bus.complete(task.id);

    return output;
  }

  get(taskId: string): CritiqueOutput | undefined {
    return this.outputs.get(taskId);
  }
}

function hashWitness(data: { qa_id: string; accuracy: number; completeness: number }): string {
  const str = `${data.qa_id}:${data.accuracy}:${data.completeness}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return `wit-${Math.abs(hash).toString(16)}`;
}
