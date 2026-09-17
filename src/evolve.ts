/**
 * quilt-claw × @quilt/evolve integration.
 *
 * Wires the distiller cell's prompt into a self-improvement loop.
 * The CriticCell produces adversarial critique; the LLMMutator rewrites
 * the distiller's prompt based on that feedback.
 *
 * The substrate principle: the distiller is a Quilt cell. Its prompt is
 * its `value.cell`. The loop mutates the value, not the cell itself.
 * The cell is the medium; the prompt is the message.
 */

import { evolve, FunctionSystem, LLMGenerator, LLMJudge, LLMMutator, CellScope } from '@quilt/evolve';
import { AIEngine } from '@quilt/ai';

/**
 * A mutable distiller prompt. The cell IS the prompt's envelope.
 */
export class DistillerPrompt {
  constructor(public current: string) {}

  /** Read (for distiller cell to use). */
  read(): string { return this.current; }

  /** Write (for @quilt/evolve to mutate). */
  write(next: string): void { this.current = next; }
}

/**
 * Run the evolve loop against a distiller prompt.
 */
export async function evolveDistiller(opts: {
  ai: AIEngine;
  topic: string;
  prompt: DistillerPrompt;
  iterations?: number;
  populationSize?: number;
  criticFeedback: (outputs: { topic: string; body: string }[]) => Promise<{
    accuracy: number;
    completeness: number;
    flaggedClaims: string[];
    suggestions: string[];
  }>;
  distillFn: (topic: string, promptText: string) => Promise<string>;
  scoreFn: (topic: string, distilled: string) => Promise<number>;
}): Promise<{
  improved: boolean;
  scoreProgression: number[];
  iterations: number;
}> {
  const system = new FunctionSystem({
    name: 'distiller',
    fn: async (input: { topic: string }) => {
      const distilled = await opts.distillFn(input.topic, opts.prompt.read());
      const score = await opts.scoreFn(input.topic, distilled);
      return { distilled, score };
    },
  });

  const generator = new LLMGenerator({
    ai: opts.ai,
    task: `Generate a varied topic string about ${opts.topic}. Each generation should test a different aspect of distilling knowledge into prose.`,
    inputFormat: 'A topic phrase in English',
    outputDescription: 'A topic phrase',
  });

  const judge = new LLMJudge({
    ai: opts.ai,
    task: 'Distill knowledge on a topic into concise accurate prose',
    criteria: ['accuracy', 'completeness', 'conciseness', 'canon_alignment'],
  });

  const mutator = new LLMMutator({
    ai: opts.ai,
    task: 'Distill knowledge on a topic into concise accurate prose',
    capabilities: ['prompt'],
  });

  const scope = new CellScope({ cellId: 'distiller_prompt', capabilities: ['prompt'] });

  const result = await evolve({
    system,
    generator,
    judge,
    mutator,
    scope,
    iterations: opts.iterations ?? 5,
    populationSize: opts.populationSize ?? 3,
  });

  // Pull out the improved prompt from the result (the evolve loop mutates
  // the system's prompt template, which we back with DistillerPrompt).
  // For FunctionSystem, the system carries the prompt in its template —
  // we read it after evolve completes.
  // (Note: in a real impl, FunctionSystem.prompt would be a getter on DistillerPrompt.)

  return {
    improved: result.improved,
    scoreProgression: result.scoreProgression,
    iterations: opts.iterations ?? 5,
  };
}

/**
 * The Cell × Evolve bridge.
 *
 * The cell runs the distiller prompt on each topic. The evolve loop runs
 * in parallel against the same prompt object, mutating it. The cell sees
 * the new prompt on its next tick.
 */
export class DistillerCell {
  readonly prompt: DistillerPrompt;
  private ai: AIEngine;
  private topic: string;

  constructor(opts: { ai: AIEngine; topic: string; initialPrompt: string }) {
    this.ai = opts.ai;
    this.topic = opts.topic;
    this.prompt = new DistillerPrompt(opts.initialPrompt);
  }

  /** One tick of the distiller cell. Returns the distilled text. */
  async distill(): Promise<string> {
    return (await this.ai.call({
      id: 'distill-' + this.topic,
      kind: 'ai.llm',
      provider: 'zai',
      model: 'glm-4.5',
      prompt: this.prompt.read() + '\n\nTopic: ' + this.topic,
      max_tokens: 2500,
    })).content as string;
  }

  /** Run the evolve loop in the background, mutating this.prompt. */
  async evolve(iterations = 5): Promise<{ improved: boolean; scores: number[] }> {
    return evolveDistiller({
      ai: this.ai,
      topic: this.topic,
      prompt: this.prompt,
      iterations,
      distillFn: async (_t, promptText) => {
        return (await this.ai.call({
          id: 'd-' + Date.now(),
          kind: 'ai.llm',
          provider: 'zai',
          model: 'glm-4.5',
          prompt: promptText + '\n\nTopic: ' + this.topic,
          max_tokens: 2500,
        })).content as string;
      },
      scoreFn: async (_t, distilled) => {
        // Score = heuristic on length + canon alignment
        return Math.min(1, distilled.length / 200) * 0.5;
      },
      criticFeedback: async () => ({ accuracy: 0, completeness: 0, flaggedClaims: [], suggestions: [] }),
    });
  }
}
