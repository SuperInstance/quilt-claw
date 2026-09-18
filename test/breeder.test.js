const test = require('node:test');
const assert = require('node:assert');
const { createBreederCell, stepBreeder, computePareto, tournament, diversity, crossover, mutate } = require('../dist/cells-breeder/breeder.js');

test('cell.breeder: population improves over generations', () => {
  const initial = Array.from({ length: 20 }, (_, i) => ({
    id: `g0-${i}`,
    fitness: 0,
    traits: { x: Math.random(), y: Math.random() },
  }));
  const cell = createBreederCell(initial, 3, 0.2);
  const evaluator = (t) => t.x + t.y;
  for (const g of initial) g.fitness = evaluator(g.traits);
  
  const before = Math.max(...cell.population.map(g => g.fitness));
  for (let i = 0; i < 30; i++) stepBreeder(cell, evaluator);
  const after = Math.max(...cell.population.map(g => g.fitness));
  assert.ok(after >= before, `before=${before} after=${after}`);
});

test('cell.breeder: Pareto frontier contains non-dominated individuals', () => {
  const initial = [
    { id: 'a', fitness: 0, traits: { x: 1.0, y: 0.0 } },
    { id: 'b', fitness: 0, traits: { x: 0.0, y: 1.0 } },
    { id: 'c', fitness: 0, traits: { x: 0.5, y: 0.5 } },
    { id: 'd', fitness: 0, traits: { x: 0.3, y: 0.3 } },
  ];
  const cell = createBreederCell(initial);
  const pareto = computePareto(cell);
  const ids = pareto.map(g => g.id).sort();
  assert.deepEqual(ids, ['a', 'b', 'c']);
});

test('cell.breeder: diversity stays bounded (no collapse)', () => {
  const initial = Array.from({ length: 20 }, (_, i) => ({
    id: `g0-${i}`, fitness: 0,
    traits: { x: Math.random(), y: Math.random() },
  }));
  const cell = createBreederCell(initial, 3, 0.1);
  for (let i = 0; i < 20; i++) stepBreeder(cell, t => t.x + t.y);
  const d = diversity(cell);
  assert.ok(d > 0 && d < 1, `d=${d}`);
});

test('cell.breeder: tournament selection returns best from sample', () => {
  const cell = createBreederCell([
    { id: 'a', fitness: 0.1, traits: {} },
    { id: 'b', fitness: 0.9, traits: {} },
    { id: 'c', fitness: 0.5, traits: {} },
  ], 3);
  const rng = () => 0.5;
  const winner = tournament(cell, rng);
  assert.equal(winner.id, 'b');
});
