/**
 * QuiltClaw — the convenience wrapper.
 *
 * Wires the cells together into a working knowledge crew.
 *
 *   input.task → bus → researcher → teacher → critic → distiller → store
 *
 * Each transition is a Quilt LINK, not a network call.
 */

import type { AIEngine } from '@quilt/ai';
import { MessageBus } from './bus.js';
import { KnowledgeStore } from './store.js';
import { ResearcherCell } from './cells/researcher.js';
import { TeacherCell } from './cells/teacher.js';
import { CriticCell } from './cells/critic.js';
import { DistillerCell } from './cells/distiller.js';
import type {
  KnowledgeEntry,
  Task,
} from './types.js';

export interface QuiltClawConfig {
  ai: AIEngine;
  searchFn?: (query: string) => Promise<Array<{ url: string; title: string; snippet: string }>>;
  initialDistillerPrompt?: string;
}

export class QuiltClaw {
  readonly bus = new MessageBus();
  readonly store = new KnowledgeStore();
  readonly researcher: ResearcherCell;
  readonly teacher: TeacherCell;
  readonly critic: CriticCell;
  readonly distiller: DistillerCell;

  private pendingPipelines = new Map<string, Promise<KnowledgeEntry>>();

  constructor(config: QuiltClawConfig) {
    this.researcher = new ResearcherCell({
      ai: config.ai,
      bus: this.bus,
      searchFn: config.searchFn,
    });

    this.teacher = new TeacherCell({
      ai: config.ai,
      bus: this.bus,
      researcher: this.researcher,
    });

    this.critic = new CriticCell({
      ai: config.ai,
      bus: this.bus,
      teacher: this.teacher,
    });

    this.distiller = new DistillerCell({
      ai: config.ai,
      bus: this.bus,
      store: this.store,
      researcher: this.researcher,
      teacher: this.teacher,
      critic: this.critic,
      prompt: config.initialDistillerPrompt,
    });
  }

  /**
   * Submit a research query. The full pipeline runs:
   *   research → teach → critique → synthesize
   * Returns the resulting knowledge entry.
   */
  async research(prompt: string): Promise<KnowledgeEntry> {
    // Stage 1: research
    const researchTask: Task = {
      id: `t-${Date.now()}-r`,
      kind: 'research',
      prompt,
      created_at: new Date().toISOString(),
    };
    this.bus.submit(researchTask);
    const researchOutput = await this.researcher.handleTask(researchTask);

    // Stage 2: teach
    const teachTask: Task = {
      id: `t-${Date.now()}-q`,
      kind: 'teach',
      prompt,
      context: { research_id: researchTask.id },
      created_at: new Date().toISOString(),
    };
    this.bus.submit(teachTask);
    const qaOutput = await this.teacher.handleTask(teachTask);

    // Stage 3: critique
    const critiqueTask: Task = {
      id: `t-${Date.now()}-c`,
      kind: 'critique',
      prompt,
      context: { qa_id: teachTask.id },
      created_at: new Date().toISOString(),
    };
    this.bus.submit(critiqueTask);
    const critiqueOutput = await this.critic.handleTask(critiqueTask);

    // Stage 4: synthesize (distill)
    const synthTask: Task = {
      id: `t-${Date.now()}-s`,
      kind: 'synthesize',
      prompt,
      context: {
        research_id: researchTask.id,
        qa_id: teachTask.id,
        critique_id: critiqueTask.id,
      },
      created_at: new Date().toISOString(),
    };
    this.bus.submit(synthTask);
    const entry = await this.distiller.handleTask(synthTask);

    return entry;
  }

  /**
   * Submit a query and get back the best knowledge entry.
   */
  async query(topic: string): Promise<KnowledgeEntry[]> {
    return this.store.search(topic, 5);
  }

  /**
   * Dump the full crew state for debugging.
   */
  state(): {
    bus: ReturnType<MessageBus['dump']>;
    store: ReturnType<KnowledgeStore['dump']>;
    distillerPrompt: string;
  } {
    return {
      bus: this.bus.dump(),
      store: this.store.dump(),
      distillerPrompt: this.distiller.getPrompt(),
    };
  }
}
