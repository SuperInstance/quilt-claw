// cell.flock scale experiment — real numbers
const { createFlockCell, stepFlock, flockMeanR } = require('../dist/cells-flock/flock.js');

function run(N, fiction, ticks) {
  const cell = createFlockCell(fiction, N);
  const start = Date.now();
  let final;
  for (let i = 0; i < ticks; i++) final = stepFlock(cell, 1/60);
  const elapsed = Date.now() - start;
  const meanR = flockMeanR(cell);
  return { N, fiction, pol: final.pol, meanSpd: final.meanSpd, meanR, elapsed_ms: elapsed };
}

console.log('cell.flock scale experiment:');
console.log('N\tfiction\tpol\tmeanR\tmeanSpd\telapsed_ms');
for (const N of [100, 500, 1000, 2000]) {
  for (const f of ['murmuration', 'pack', 'kennel', 'parliament']) {
    const r = run(N, f, 60);
    console.log(`${r.N}\t${r.fiction}\t${r.pol.toFixed(3)}\t${r.meanR.toFixed(1)}\t${r.meanSpd.toFixed(2)}\t${r.elapsed_ms}`);
  }
}
