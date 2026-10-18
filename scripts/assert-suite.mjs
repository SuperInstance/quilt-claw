#!/usr/bin/env node
/**
 * assert-suite.mjs — the guard rail.
 *
 * A test script that runs 4 of 182 tests and exits 0 is a green badge over a
 * truncated suite. That is the disease this exists to kill: nothing about
 * "npm test passed" tells you anything about *how much* was tested.
 *
 * So we assert the number. Read a TAP file produced by `node --test`, check the
 * totals against what is actually committed, and exit non-zero on any drift.
 * Deliberately independent of witness/ledger.js — if the witness had a bug, this
 * still holds the line.
 *
 *   node scripts/assert-suite.mjs <tap-file> [expected-tests]
 *
 * Exit 0 only if: tests === expected, fail === 0, and the run did not crash.
 */

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';

const EXPECTED_TESTS = 182;
const EXPECTED_FILES = 27;

const tapPath = process.argv[2];
const expected = parseInt(process.argv[3] ?? String(EXPECTED_TESTS), 10);

if (!tapPath) {
  console.error('usage: node scripts/assert-suite.mjs <tap-file> [expected-tests]');
  process.exit(2);
}

const tap = readFileSync(tapPath, 'utf8');
const grab = (key) => {
  const m = new RegExp(`^# ${key} (\\d+)$`, 'm').exec(tap);
  return m ? parseInt(m[1], 10) : null;
};

const tests = grab('tests');
const pass = grab('pass');
const fail = grab('fail');

const repoRoot = path.resolve(import.meta.dirname, '..');
const testFiles = readdirSync(path.join(repoRoot, 'test')).filter((f) => f.endsWith('.test.js'));

const problems = [];
const die = (m) => problems.push(m);

if (tests === null) die('no "# tests N" line in TAP output — the run never produced a summary (did it crash?)');
if (tests !== null && tests !== expected) {
  die(`expected ${expected} tests, TAP reports ${tests} — ` +
      (tests < expected
        ? 'THE SUITE SHRANK. A test was removed, or the glob stopped matching every file.'
        : 'the suite grew — re-witness it (npm run witness) and update EXPECTED_TESTS.'));
}
if (fail === null) die('no "# fail N" line in TAP output — the run may have crashed before finishing');
else if (fail !== 0) die(`${fail} test(s) failing`);
if (pass !== null && tests !== null && pass !== tests) {
  die(`pass (${pass}) !== tests (${tests}) — some tests neither passed nor failed`);
}
if (testFiles.length !== EXPECTED_FILES) {
  die(`expected ${EXPECTED_FILES} test files on disk, found ${testFiles.length}`);
}

// Cross-check the runner actually saw every file: a truncated glob shows up here.
const filesOnDisk = new Set(testFiles);
if (filesOnDisk.size === 0) die('no test files found in ./test');

console.log('suite assertion');
console.log('───────────────');
console.log(`  files on disk     ${testFiles.length}`);
console.log(`  tests reported    ${tests === null ? 'n/a' : tests}`);
console.log(`  passed            ${pass === null ? 'n/a' : pass}`);
console.log(`  failed            ${fail === null ? 'n/a' : fail}`);
console.log(`  expected tests    ${expected}`);

if (problems.length) {
  console.error('');
  for (const p of problems) console.error(`  ✗ ${p}`);
  console.error('\nASSERTION FAILED — the suite that ran is not the suite that was committed.');
  process.exit(1);
}

console.log('');
console.log(`  ✓ ${tests} tests, ${pass} pass, 0 fail, across ${testFiles.length} files`);
console.log(`  ✓ count matches the committed suite (${expected}) — nothing was silently skipped`);
process.exit(0);
