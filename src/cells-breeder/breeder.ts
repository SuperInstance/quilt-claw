/**
 * cell.breeder — evolutionary selection as canonical Quilt cell kind
 */

export interface Genome {
  id: string;
  fitness: number;
  traits: Record<string, number>;
}

export interface BreedingCell {
  population: Genome[];
  generation: number;
  pareto: Genome[];
  tournamentSize: number;
  mutationRate: number;
  history: { gen: number; bestFitness: number; meanFitness: number; diversity: number }[];
  uid: number;
}

export function createBreederCell(initialPopulation: Genome[], tournamentSize = 3, mutationRate = 0.1): BreedingCell {
  return {
    population: initialPopulation,
    generation: 0,
    pareto: [],
    tournamentSize,
    mutationRate,
    history: [],
    uid: 0,
  };
}

function nextId(cell: BreedingCell, prefix: string): string {
  cell.uid++;
  return `${prefix}-${cell.generation}-${cell.uid}`;
}

export function computePareto(cell: BreedingCell): Genome[] {
  const out: Genome[] = [];
  for (const a of cell.population) {
    let dominated = false;
    for (const b of cell.population) {
      if (a === b) continue;
      if (dominates(b.traits, a.traits)) { dominated = true; break; }
    }
    if (!dominated) out.push(a);
  }
  cell.pareto = out;
  return out;
}

function dominates(a: Record<string, number>, b: Record<string, number>): boolean {
  let atLeastOneBetter = false;
  for (const k of Object.keys(a)) {
    if (a[k] < b[k]) return false;
    if (a[k] > b[k]) atLeastOneBetter = true;
  }
  return atLeastOneBetter;
}

export function tournament(cell: BreedingCell, rng: () => number = Math.random): Genome {
  const candidates: Genome[] = [];
  for (let i = 0; i < cell.tournamentSize; i++) {
    const idx = Math.floor(rng() * cell.population.length);
    candidates.push(cell.population[idx]);
  }
  return candidates.reduce((best, c) => c.fitness > best.fitness ? c : best);
}

export function crossover(cell: BreedingCell, a: Genome, b: Genome, rng: () => number = Math.random): Genome {
  const traits: Record<string, number> = {};
  for (const k of Object.keys(a.traits)) {
    const t = rng();
    traits[k] = a.traits[k] * t + b.traits[k] * (1 - t);
  }
  return { id: nextId(cell, 'c'), fitness: 0, traits };
}

export function mutate(cell: BreedingCell, g: Genome, rate: number, rng: () => number = Math.random): Genome {
  const traits = { ...g.traits };
  for (const k of Object.keys(traits)) {
    if (rng() < rate) {
      const u1 = Math.max(1e-6, rng()), u2 = rng();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      traits[k] = traits[k] + z * 0.1;
    }
  }
  return { id: nextId(cell, 'm'), fitness: 0, traits };
}

export function diversity(cell: BreedingCell): number {
  if (cell.population.length === 0) return 0;
  const keys = Object.keys(cell.population[0].traits);
  let totalVar = 0;
  for (const k of keys) {
    const mean = cell.population.reduce((s, g) => s + g.traits[k], 0) / cell.population.length;
    const variance = cell.population.reduce((s, g) => s + (g.traits[k] - mean) ** 2, 0) / cell.population.length;
    totalVar += variance;
  }
  return totalVar / keys.length;
}

export function stepBreeder(
  cell: BreedingCell,
  evaluator: (traits: Record<string, number>) => number,
  rng: () => number = Math.random,
): { bestFitness: number; meanFitness: number; diversity: number } {
  const next: Genome[] = [];
  for (let i = 0; i < cell.population.length; i++) {
    const p1 = tournament(cell, rng);
    const p2 = tournament(cell, rng);
    let child = crossover(cell, p1, p2, rng);
    child = mutate(cell, child, cell.mutationRate, rng);
    child.fitness = evaluator(child.traits);
    next.push(child);
  }
  cell.population = next;
  cell.generation++;
  computePareto(cell);
  
  const fitnesses = cell.population.map(g => g.fitness);
  const bestFitness = Math.max(...fitnesses);
  const meanFitness = fitnesses.reduce((a, b) => a + b, 0) / fitnesses.length;
  const div = diversity(cell);
  
  cell.history.push({ gen: cell.generation, bestFitness, meanFitness, diversity: div });
  return { bestFitness, meanFitness, diversity: div };
}
