/**
 * cell.chaos — stochastic exploration as canonical Quilt cell kind
 *
 * Promoted from sunset-ecosystem/swarm/chaos.py.
 * Decaying chaos probability prevents routes from settling into local optima.
 *
 * Reference: ChaosProbability dataclass, inject_chaos function
 */

export interface ChaosCell {
  initial: number;
  decay: number;
  minimum: number;
  current: number;
  stepCount: number;
  events: { t: number; routeSwapped: boolean }[];
}

export function createChaosCell(initial = 0.3, decay = 0.95, minimum = 0.05): ChaosCell {
  return { initial, decay, minimum, current: initial, stepCount: 0, events: [] };
}

/** Step: decay chaos probability based on adaptation score (0..1) */
export function stepChaos(cell: ChaosCell, adaptation: number = 0): void {
  cell.current = Math.max(cell.minimum, cell.current * cell.decay * (1 - adaptation * 0.5));
  cell.stepCount++;
}

/** Decide whether to inject chaos at current step */
export function injectChaos(cell: ChaosCell, rng: () => number = Math.random): boolean {
  if (rng() < cell.current) {
    cell.events.push({ t: cell.stepCount, routeSwapped: rng() < 0.5 });
    return true;
  }
  return false;
}

/** Reset to initial chaos (e.g., for new exploration phase) */
export function resetChaos(cell: ChaosCell): void {
  cell.current = cell.initial;
  cell.stepCount = 0;
  cell.events = [];
}
