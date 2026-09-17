/**
 * ResearcherCell — the researcher is a cell.
 *
 * Subscribes to research tasks on the bus. For each task:
 *   1. Searches the web (or local corpus) for sources
 *   2. Asks the LLM to synthesize a summary
 *   3. Computes a confidence score
 *   4. Emits a ResearchOutput with a witness hash
 *
 * The cell is a Quilt cell with:
 *   - id: cell.researcher
 *   - inbound: bus.research
 *   - outbound: cell.teacher
 *   - witness: { task_id, sources, confidence, produced_at }
 */

import type { AIEngine } from '@quilt/ai';
import { MessageBus } from '../bus.js';
import type { ResearchOutput, Task } from '../types.js';

export interface ResearcherConfig {
  ai: AIEngine;
  bus: MessageBus;
  id?: string;
  searchFn?: (query: string) => Promise<Array<{ url: string; title: string; snippet: string }>>;
}

export class ResearcherCell {
  readonly id: string;
  private ai: AIEngine;
  private bus: MessageBus;
  private searchFn: (query: string) => Promise<Array<{ url: string; title: string; snippet: string }>>;
  private outputs = new Map<string, ResearchOutput>();

  constructor(config: ResearcherConfig) {
    this.id = config.id ?? 'cell.researcher';
    this.ai = config.ai;
    this.bus = config.bus;
    this.searchFn =
      config.searchFn ??
      (async () => {
        // Default: return a stub source. Real impl would use a search API.
        return [
          {
            url: 'local://corpus',
            title: 'Quilt canon',
            snippet: 'Cells are the irreducible unit of intelligence. The substrate grows.',
          },
        ];
      });

    this.bus.subscribe('research', (task) => this.handleTask(task));
  }

  /**
   * Handle a research task. Returns the ResearchOutput.
   */
  async handleTask(task: Task): Promise<ResearchOutput> {
    if (!this.bus.claim(task.id)) {
      throw new Error(`task ${task.id} already claimed`);
    }

    const sources = await this.searchFn(task.prompt);

    const result = await this.ai.call({
      id: `researcher:${task.id}`,
      kind: 'ai.llm',
      provider: 'zai',
      model: 'glm-4.5',
      prompt: `You are a research synthesizer. Given the user's question and a list of sources, produce a concise summary (200 words max).

Question: ${task.prompt}

Sources:
${sources.map((s, i) => `[${i + 1}] ${s.title} (${s.url})\n${s.snippet}`).join('\n\n')}

Summary:`,
      max_tokens: 400,
    });

    const output: ResearchOutput = {
      task_id: task.id,
      summary: (result as string).trim(),
      sources,
      confidence: sources.length > 0 ? Math.min(0.9, 0.5 + sources.length * 0.1) : 0.3,
      witness_hash: hashWitness({ task_id: task.id, sources, summary: result }),
      produced_at: new Date().toISOString(),
    };

    this.outputs.set(task.id, output);
    this.bus.complete(task.id);

    return output;
  }

  /**
   * Get the output for a task.
   */
  get(taskId: string): ResearchOutput | undefined {
    return this.outputs.get(taskId);
  }
}

/**
 * Compute a simple witness hash for the output.
 * (Real impl would use sha256 — kept simple for the demo.)
 */
function hashWitness(data: { task_id: string; sources: unknown[]; summary: unknown }): string {
  const str = `${data.task_id}:${data.sources.length}:${String(data.summary).length}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return `wit-${Math.abs(hash).toString(16)}`;
}
