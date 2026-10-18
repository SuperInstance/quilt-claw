#!/usr/bin/env node
/**
 * typecheck-report.mjs — classify `tsc` diagnostics instead of pretending.
 *
 * `tsc` is RED in this repo and cannot be made green here:
 *
 *   - 8x TS2307  Cannot find module '@quilt/ai' / '@quilt/evolve'
 *     These are declared `workspace:*`. quilt-claw is standalone; there is no
 *     workspace root to resolve them against and `@quilt/core` is published by
 *     NO repository (404 on npm). Whether the scope goes private, or moves into a
 *     monorepo, is the HOUSE's decision. We do not stub them and we do not
 *     pretend they resolve.
 *
 *   - 1x TS2741  src/evolve.ts(136,5): Property 'scores' is missing
 *     A REAL type defect in this repo's own code, unrelated to the missing deps.
 *     Recorded as debt, not hidden.
 *
 * Critically: tsc still EMITS despite these errors (noEmitOnError is false), so the
 * suite builds and runs. We verified the emitted tree is what the tests load.
 *
 * So a bare `tsc` exit code is useless here — it is red for a reason nobody has
 * fixed yet. What we DO care about is that no NEW class of error sneaks in. This
 * script prints the full classification, fails on anything outside the declared
 * known-debt set, and prints the debt out loud every run so it can never be
 * forgotten.
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');

/** Unresolvable workspace:* deps. Not fixable here; see header. */
const KNOWN_UNRESOLVABLE = new Set(['@quilt/core', '@quilt/ai', '@quilt/evolve']);

/** Known real type debt in this repo. Remove an entry only when the defect is fixed. */
const KNOWN_DEBT = [
  { file: 'src/evolve.ts', pos: '136,5', code: 'TS2741' },
];

const tsc = path.join(repoRoot, 'node_modules', '.bin', 'tsc');
const res = spawnSync(tsc, ['--noEmit'], { cwd: repoRoot, encoding: 'utf8' });

// tsc writes diagnostics to stdout, not stderr. Read both.
const out = `${res.stdout || ''}${res.stderr || ''}`;
const lines = out
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => /^[\w./-]+\.tsx?\(\d+,\d+\):\s+(error|warning)\s+TS\d+:/.test(l));

const DIAG = /^(.+?)\((\d+,\d+)\):\s+(error|warning)\s+(TS\d+):\s*(.*)$/;

const unresolved = [];
const debt = [];
const novel = [];

for (const line of lines) {
  const m = DIAG.exec(line);
  if (!m) { novel.push({ line, why: 'unparseable diagnostic' }); continue; }
  const [, file, pos, , code, msg] = m;

  const mod = /Cannot find module '([^']+)'/.exec(msg);
  if (code === 'TS2307' && mod && KNOWN_UNRESOLVABLE.has(mod[1])) {
    unresolved.push({ file, pos, code, mod: mod[1] });
    continue;
  }
  const d = KNOWN_DEBT.find((k) => k.file === file && k.pos === pos && k.code === code);
  if (d) { debt.push({ file, pos, code, msg }); continue; }
  novel.push({ line, file, pos, code, msg });
}

console.log('typecheck classification');
console.log('─────────────────────────');
console.log(`  total diagnostics     ${lines.length}`);
console.log(`  unresolved workspace:*  ${unresolved.length}  (TS2307, @quilt/* — not fixable in this repo)`);
console.log(`  known real debt         ${debt.length}  (TS2741, src/evolve.ts)`);
console.log(`  NEW / unclassified      ${novel.length}`);
console.log('');
console.log('  NOTE: tsc emits despite these errors (noEmitOnError=false). The suite');
console.log('        builds and runs. This repo is NOT typecheck-green and does not');
console.log('        claim to be. See scripts/typecheck-report.mjs for why.');

if (debt.length) {
  console.log('');
  console.log('  KNOWN DEBT (tracked, must be driven to zero):');
  for (const d of debt) console.log(`    ${d.file}(${d.pos}) ${d.code}: ${d.msg}`);
}

if (unresolved.length) {
  const mods = [...new Set(unresolved.map((u) => u.mod))].sort();
  console.log('');
  console.log(`  UNRESOLVABLE (declared workspace:*, no workspace root, not published): ${mods.join(', ')}`);
}

if (novel.length) {
  console.error('');
  console.error('  NEW DIAGNOSTICS — these are not in the known-debt set:');
  for (const n of novel) console.error(`    ${n.line}`);
  console.error('');
  console.error('  Either fix them or, if they are new accepted debt, add them to');
  console.error('  KNOWN_DEBT in scripts/typecheck-report.mjs with a reason.');
  process.exit(1);
}

console.log('');
console.log('  ✓ no new typecheck debt introduced');
process.exit(0);
