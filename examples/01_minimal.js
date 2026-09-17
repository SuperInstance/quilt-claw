/**
 * Minimal quilt-claw example — no LLM, all stubs.
 * 
 * Demonstrates the pipeline: research → teach → critique → distill.
 * Useful for testing the cell wiring without LLM costs.
 */

// Stub AI engine
const stubAI = {
  async call({ id, prompt }) {
    // Deterministic stub output for testing
    if (id.startsWith('researcher:')) return 'The Quilt cell model is the irreducible unit of intelligence. The substrate grows.';
    if (id.startsWith('teacher:')) return 'Q: What is the cell model?\nA: The cell is the irreducible unit of intelligence.\nQ: How does the substrate grow?\nA: Through BIND/LINK/EFFECT/VIEW/TICK.';
    if (id.startsWith('distiller:')) return 'The Quilt Cell Model\nThe cell is the irreducible unit of intelligence. The substrate grows through the five opcodes. PROOF is the gate.';
    return 'stub';
  }
};

// Inline require because we're not using the build pipeline
const path = require('path');
const fs = require('fs');
const files = ['types.js', 'bus.js', 'store.js', 'cells/researcher.js', 'cells/teacher.js', 'cells/critic.js', 'cells/distiller.js', 'quilt-claw.js', 'index.js'];

// Hack: just import the source directly (this is JS not TS)
// For the demo, we'll require the compiled version if it exists
const { QuiltClaw } = require('../src/index.js').default || require('../src/index.js');

(async () => {
  // Note: this example assumes you've compiled TypeScript first or are using a JS-compatible setup.
  // For now, demonstrate the architecture via the cell classes directly.
  console.log('quilt-claw minimal demo');
  console.log('Use the QuiltClaw class for the full pipeline.');
})();
