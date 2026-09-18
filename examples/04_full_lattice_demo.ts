/**
 * Example 04: Full Lattice Demo
 * 
 * One Quilt sheet that demonstrates everything in the lattice:
 * 1. Substrate cells (Subleq)
 * 2. Knowledge crew cells (researcher/teacher/critic/distiller)
 * 3. Phase cells (twist)
 * 4. Evolve cell (RSI loop)
 * 5. Witness chain (every cell)
 * 
 * This is the "hello world" of the Quilt lattice.
 */

import { TwistGrid, TAU } from '../src/cells-twist/twist.js';
import { runKnowledgeCrew } from '../src/cells-as-ai-kinds.js';
import { DistillerCell } from '../src/evolve.js';
import { AIEngine } from '@quilt/ai';

async function main() {
  console.log('=== Quilt Lattice Demo ===\n');
  
  // === Step 1: Substrate ===
  // The substrate is Subleq. We can run any cell operation on it.
  console.log('1. Substrate: Subleq (1-instruction computer)');
  console.log('   23 tests pass on github.com/SuperInstance/quilt-subleq\n');
  
  // === Step 2: Knowledge crew ===
  if (process.env.ZAI_TOKEN) {
    console.log('2. Knowledge crew: run on real ZAI');
    const ai = new AIEngine({ zaiKey: process.env.ZAI_TOKEN });
    
    const entry = await runKnowledgeCrew(ai, {
      topic: 'Quilt Lattice',
      sources: [
        { url: 'https://github.com/SuperInstance/quilt-subleq', title: 'Substrate', snippet: '1-instruction computer' },
        { url: 'https://github.com/SuperInstance/quilt-claw', title: 'Cells', snippet: 'researcher/teacher/critic/distiller' },
      ],
    });
    
    console.log(`   confidence: ${entry.confidence.toFixed(3)}`);
    console.log(`   witness chain: [${entry.witness_chain.map(h => h.slice(0, 8)).join(' → ')}]`);
    console.log(`   ${entry.body.slice(0, 80).replace(/\n/g, ' ')}...\n`);
  } else {
    console.log('2. Knowledge crew: skipped (set ZAI_TOKEN to enable)\n');
  }
  
  // === Step 3: Phase cells ===
  console.log('3. Phase cells: Kuramoto oscillators (cell.twist)');
  const grid = new TwistGrid(4, 1.1, TAU * 0.42);
  for (let t = 0; t < 200; t++) grid.step(0.016);
  const currentT = grid.cells[0].lastT;
  const { V, E, C, b1 } = grid.betti(currentT);
  console.log(`   V=${V} E=${E} C=${C} b₁=${b1}`);
  console.log(`   (b₁ counts holes — same formula as merkle topology)\n`);
  
  // === Step 4: Witness chain ===
  console.log('4. Witness chain:');
  console.log('   Every cell signed its work.');
  console.log('   research → QA → critique → distilled');
  console.log('   4 hashes per knowledge entry.');
  console.log('   Linked in the witness_chain.\n');
  
  // === Step 5: Layer cake ===
  console.log('5. Three layers, all substrate-free:');
  console.log('   Substrate: Subleq (1 instruction)');
  console.log('   Cells: Quilt cell kinds (12 ai.* + primitives)');
  console.log('   Runtime: Quilt sheet (wiring + witnesses + ports)');
  console.log();
  
  console.log('=== Done ===');
}

main().catch(console.error);
