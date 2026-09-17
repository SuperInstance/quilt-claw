/**
 * @quilt/claw — Quilt-native knowledge crew.
 *
 * Replaces autoclaw's Python CLI with a sheet of cells.
 *
 * The cells are:
 *   - input.task      — a task arrives from outside
 *   - value.bus       — pending task queue
 *   - cell.researcher — web search + LLM synthesis
 *   - cell.teacher   — Q&A pair generation
 *   - cell.critic    — adversarial evaluation
 *   - cell.distiller — knowledge consolidation
 *   - value.store    — vector store (in-memory)
 *   - cell.evolve    — @quilt/evolve loop on the distiller
 *
 * Each cell is a Quilt cell with a 14-tuple id and a witness log.
 * Cell-to-cell communication is via LINK, not HTTP.
 */

export { QuiltClaw, type QuiltClawConfig } from './quilt-claw.js';
export { ResearcherCell } from './cells/researcher.js';
export { TeacherCell } from './cells/teacher.js';
export { CriticCell } from './cells/critic.js';
export { DistillerCell } from './cells/distiller.js';
export { KnowledgeStore } from './store.js';
export { MessageBus } from './bus.js';
export type { Task, ResearchOutput, QAOutput, CritiqueOutput, KnowledgeEntry } from './types.js';
