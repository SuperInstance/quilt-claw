/**
 * Example 03: Full quilt-claw crew + evolve loop on a real topic.
 * 
 * Pipeline: research → teach → critique → distill → evolve(distiller.prompt)
 * 
 * Output: a knowledge entry that gets sharper over 5 evolve iterations.
 */

import { QuiltClaw } from '../src/index.js';
import { DistillerCell } from '../src/evolve.js';
import { AIEngine } from '@quilt/ai';

async function main() {
  // 1. Set up the runtime
  const ai = new AIEngine({ 
    zaiKey: process.env.ZAI_TOKEN,
    kimiKey: process.env.KIMI_TOKEN,
    deepseekKey: process.env.DEEPSEEK_TOKEN,
  });
  
  // 2. Run the full knowledge crew
  const claw = new QuiltClaw({ ai });
  
  const task = {
    id: 'task-001',
    topic: 'Quilt Cell Model',
    prompt: 'The Quilt Cell Model is the irreducible unit of intelligence.',
    sources: [
      { url: 'https://github.com/SuperInstance/quilt', title: 'Quilt canon', snippet: 'cells + ops + witnesses' },
      { url: 'https://superinstance.ai', title: 'SuperInstance', snippet: 'live-canon + ship tradition' },
    ],
    kind: 'knowledge-entry' as const,
    created_at: new Date().toISOString(),
  };
  
  const entry = await claw.research(task);
  console.log('Research entry:', entry.id);
  console.log('  confidence:', entry.confidence);
  console.log('  witness chain:', entry.witness_chain);
  
  // 3. Run the evolve loop on the distiller prompt
  const distiller = new DistillerCell({
    ai,
    topic: 'Quilt Cell Model',
    initialPrompt: 'The Quilt Cell Model\nThe cell is the irreducible unit of intelligence.',
  });
  
  const { improved, scores } = await distiller.evolve(5);
  console.log('\nEvolve result:');
  console.log('  improved:', improved);
  console.log('  score progression:', scores);
  
  // 4. Re-distill with the improved prompt
  const improvedDistillation = await distiller.distill();
  console.log('\nImproved distillation:');
  console.log('  ', improvedDistillation.slice(0, 200), '...');
}

main().catch(console.error);
