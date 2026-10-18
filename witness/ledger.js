#!/usr/bin/env node
/**
 * ledger.js — the house witness idiom, ported to quilt-claw.
 *
 * This is a direct port of SuperInstance/AI-Writings `labs/situation-recorder/recorder.py`.
 * The hash algebra is BYTE-COMPATIBLE with it on purpose: fnv1a-64 over the same
 * canonical JSON encoding, same GENESIS, same chain rule, same replay verifier.
 * One idiom to invent fewer of. (It is also the idiom MicroMoth-quilt's
 * tools/collapse_ledger.py uses. The fleet WAL convention.)
 *
 *     hash = "0x%016x" % fnv1a64( canon({ prev, ...envelope_without_hash }) )
 *
 * WHAT IS WITNESSED HERE: the full test suite of @quilt/claw. One record per test
 * file — its path, its source sha256, and the number of tests it actually ran —
 * chained, then one OUTCOME recording the aggregate.
 *
 * The point of the house rule "if it wasn't witnessed, it didn't happen": a repo
 * whose CI badge says green over 4 of 182 tests LOOKS healthy and IS NOT. This
 * ledger makes the count itself an ATTESTABLE receipt. Edit a test file, add or
 * delete a test, or quietly shrink the glob, and `witness/ledger.js --verify`
 * breaks the chain. A green badge over a truncated suite is the disease this exists
 * to make impossible to ship silently.
 *
 * WHAT THAT IS AND IS NOT -- read before claiming this log is tamper-evident.
 *
 *   linkage class ............ chain (v0: dense seq, order-implied linkage)
 *   leg 1  chain re-derives . YES. Replay reproduces every linkage, so an edit is
 *                               expensive and a naive edit is named.
 *   leg 2  head signed ....... NO. Nothing here is signed.
 *   leg 3  head published
 *          out of band ....... NO. No published head exists.
 *
 * So: ATTESTABLE, not tamper-evident. A writer who re-chains their edit
 * produces a ledger that verifies perfectly, and a TAIL-TRUNCATED ledger is
 * a SHORTER VALID CHAIN -- delete the OUTCOME row and everything that
 * remains still replays clean. Neither is visible to --verify. The word
 * "tamper-evident" requires all three legs; this ledger has one.
 *
 * See SuperInstance/witness-spec SPEC.md for the normative definitions.
 *
 * ZERO dependencies — node stdlib only, like the house's.
 *
 *   node witness/ledger.js            # rebuild from live test runs, verify, tamper self-test
 *   node witness/ledger.js --verify   # re-derive the chain + re-run every file; fail on any break
 *   node witness/ledger.js --chain-only # verify the chain without re-running tests (fast)
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const LEDGER_PATH = path.join(__dirname, 'ledger.jsonl');
const TEST_DIR = path.join(ROOT, 'test');

const GENESIS = '0x0000000000000000';

// The house relation vocabulary. Unchanged from recorder.py; we only choose which
// verbs this repo needs (a witness is mostly MARKs and an OUTCOME).
const REL_TYPES = new Set([
  'TASK', 'ROUTE', 'DRAFT', 'DRAW', 'FOLD', 'KEEP', 'DROP', 'MARK', 'OUTCOME',
]);

const SID = 'witness-quilt-claw-tests';
const BASE_TS = '2026-09-29T00:00:00Z';
const SESSION = 'local';

// --- the fleet hash algebra --------------------------------------------------

/** fnv1a-64 over utf-8 bytes. Same constants as recorder.py / collapse_ledger.py. */
function fnv1a64(s) {
  const MASK = 0xFFFFFFFFFFFFFFFFn;
  const PRIME = 0x100000001B3n;
  let h = 0xCBF29CE484222325n;
  const bytes = Buffer.from(s, 'utf8');
  for (const b of bytes) {
    h ^= BigInt(b);
    h = (h * PRIME) & MASK;
  }
  return h;
}

/**
 * Python's json.dumps(obj, sort_keys=True, separators=(",", ":")) with the default
 * ensure_ascii=True. JSON.stringify differs (it leaves non-ascii unescaped), so we
 * do it by hand — the chain is only worth anything if the encoding is pinned.
 */
function pyEscape(str) {
  let out = '';
  for (const ch of str) {
    const code = ch.codePointAt(0);
    if (ch === '"') out += '\\"';
    else if (ch === '\\') out += '\\\\';
    else if (ch === '\n') out += '\\n';
    else if (ch === '\r') out += '\\r';
    else if (ch === '\t') out += '\\t';
    else if (ch === '\b') out += '\\b';
    else if (ch === '\f') out += '\\f';
    else if (code < 0x20 || code > 0x7e) {
      if (code > 0xffff) { // astral -> surrogate pair, like Python's ensure_ascii
        const v = code - 0x10000;
        out += '\\u' + (0xd800 + (v >> 10)).toString(16).padStart(4, '0');
        out += '\\u' + (0xdc00 + (v & 0x3ff)).toString(16).padStart(4, '0');
      } else {
        out += '\\u' + code.toString(16).padStart(4, '0');
      }
    } else out += ch;
  }
  return '"' + out + '"';
}

function canon(v) {
  if (v === null) return 'null';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') {
    // The ledger's value domain is integers. Python's json.dumps emits bare
    // NaN/Infinity, which is not JSON and would silently break any reader; reject
    // them so the encoding stays total and JSON-shaped.
    if (!Number.isFinite(v)) throw new Error('canon: non-finite number ' + v);
    return String(v);
  }
  if (typeof v === 'string') return pyEscape(v);
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
  const keys = Object.keys(v).sort(); // sort_keys=True
  return '{' + keys.map((k) => pyEscape(k) + ':' + canon(v[k])).join(',') + '}';
}

const hex = (s) => '0x' + fnv1a64(s).toString(16).padStart(16, '0');

// --- the ledger ---------------------------------------------------------------

/** The record without its own hash — what the chain commits to. */
function envelope(rec) {
  const { hash, ...rest } = rec;
  return rest;
}

function chainHash(prev, rec) {
  return hex(canon({ prev, ...envelope(rec) }));
}

/** Deterministic clock, exactly like recorder.py's demo: replayable, no wall time. */
function makeClock(startIso = BASE_TS, stepSec = 3) {
  let t = Date.parse(startIso);
  return () => {
    const s = new Date(t).toISOString().replace(/\.\d{3}Z$/, 'Z');
    t += stepSec * 1000;
    return s;
  };
}

class Ledger {
  constructor(sid, ts) {
    this.sid = sid;
    this.records = [];
    this.clock = ts || makeClock();
  }

  emit(rel, actor, body, refs) {
    if (!REL_TYPES.has(rel)) throw new Error(`unknown rel ${rel} (allowed: ${[...REL_TYPES]})`);
    if (!actor || typeof actor !== 'object' || !('tier' in actor)) {
      throw new Error("actor must be an object with at least a 'tier' key");
    }
    const prev = this.records.length ? this.records[this.records.length - 1].hash : GENESIS;
    const rec = {
      sid: this.sid,
      seq: this.records.length,
      ts: this.clock(),
      actor,
      rel,
      refs: refs ? [...refs] : [],
      body,
    };
    rec.hash = chainHash(prev, rec);
    this.records.push(rec);
    return rec;
  }

  /** MARK — a durable artifact written (here: a test file, hashed and counted). */
  mark(actor, ref, body, refs) {
    return this.emit('MARK', actor, { kind: 'test-file', ref, ...body }, refs);
  }

  /** OUTCOME — the delayed label (here: the aggregate the suite actually produced). */
  outcome(actor, ofRef, result, detail, refs) {
    const r = refs ? [...refs] : [];
    if (ofRef && !r.includes(ofRef)) r.push(ofRef);
    return this.emit('OUTCOME', actor, { of: ofRef, result, detail }, r);
  }

  task(actor, brief, refs) {
    return this.emit('TASK', actor, { brief }, refs);
  }

  toJsonl() {
    return this.records.map((r) => canon(r)).join('\n') + '\n';
  }

  write(p) {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, this.toJsonl(), 'utf8');
    return p;
  }
}

function load(p) {
  return fs
    .readFileSync(p, 'utf8')
    .split('\n')
    .filter((l) => l.trim() !== '')
    .map((l) => JSON.parse(l));
}

/**
 * Replay the chain. Catches reorder, edit, and mid-chain drop — the same
 * RE-DERIVATION recorder.py gives a transcript. Ported rule-for-rule.
 *
 * It does NOT catch a re-chained rewrite, and it does NOT catch a
 * tail-truncation (a shorter chain is still a valid chain). Those need an
 * external anchor: a head signed by a key this writer does not hold and
 * published where this repo's workflow cannot push. There is none yet, so
 * this is a re-derivation check, not a tamper check.
 */
function verifyChain(records) {
  let prev = GENESIS;
  const seen = new Set();
  for (let i = 0; i < records.length; i++) {
    const rec = records[i];
    if (rec.seq !== i) return { ok: false, msg: `seq gap at index ${i} (got ${rec.seq})` };
    const want = chainHash(prev, rec);
    if (rec.hash !== want) {
      return { ok: false, msg: `hash mismatch at seq ${i}: stored ${rec.hash} want ${want}` };
    }
    for (const ref of rec.refs || []) {
      if (typeof ref === 'string' && ref.startsWith('0x') && !seen.has(ref)) {
        return { ok: false, msg: `seq ${i} refs unknown/forward hash ${ref}` };
      }
    }
    seen.add(rec.hash);
    prev = rec.hash;
  }
  // "chain-intact" is precise: THE CHAIN VERIFIED. It is not a claim about
  // tampering — this same function returns ok for a tail-truncated chain,
  // because a prefix of a valid chain is a valid chain. See the module
  // docstring for which of the three anchor legs actually hold.
  return { ok: true, msg: `ok: ${records.length} records, chain-intact (leg 1 only: re-derived, not anchored)` };
}

// --- witness the suite --------------------------------------------------------

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

/** Run one test file under node's own runner and read the TAP totals. */
function runFile(file) {
  let out = '';
  let failed = false;
  try {
    out = execFileSync(process.execPath, ['--test', file], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (e) {
    out = `${e.stdout || ''}${e.stderr || ''}`;
    failed = true;
  }
  const grab = (key) => {
    const m = new RegExp(`^# ${key} (\\d+)$`, 'm').exec(out);
    return m ? parseInt(m[1], 10) : 0;
  };
  return {
    tests: grab('tests'),
    pass: grab('pass'),
    fail: grab('fail'),
    crashed: failed,
  };
}

function testFiles() {
  return fs
    .readdirSync(TEST_DIR)
    .filter((f) => f.endsWith('.test.js'))
    .sort()
    .map((f) => path.join('test', f));
}

function headSha() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return 'unknown';
  }
}

function build() {
  const ledger = new Ledger(SID, makeClock());
  const actor = { tier: 'mechanic', id: 'wesley', session: SESSION };
  const head = headSha();

  ledger.task(actor, `witness the full @quilt/claw test suite at ${head.slice(0, 12)}`);

  const files = testFiles();
  let total = 0;
  let passed = 0;
  let failed = 0;
  const broken = [];
  let prevMark = null;

  for (const rel of files) {
    const abs = path.join(ROOT, rel);
    const digest = sha256(abs);
    const r = runFile(abs);
    total += r.tests;
    passed += r.pass;
    failed += r.fail;
    if (r.fail > 0 || r.crashed) broken.push(rel);
    const mark = ledger.mark(
      actor,
      rel,
      { sha256: digest, tests: r.tests, pass: r.pass, fail: r.fail },
      prevMark ? [prevMark.hash] : [],
    );
    prevMark = mark;
  }

  const out = ledger.outcome(
    actor,
    prevMark ? prevMark.hash : GENESIS,
    failed === 0 && !broken.length ? 'pass' : 'fail',
    `${total} tests / ${passed} pass / ${failed} fail across ${files.length} files`,
    [head],
  );

  return { ledger, total, passed, failed, files, broken, out };
}

function cmdBuild() {
  const { ledger, total, passed, failed, files, broken, out } = build();

  // The suite is supposed to be 182. If it isn't, say so loudly — a shrunken suite
  // is the exact defect this witness exists to catch.
  const EXPECTED = 182;
  const countOk = total === EXPECTED;

  ledger.write(LEDGER_PATH);
  console.log(`wrote ${path.relative(ROOT, LEDGER_PATH)} (${ledger.records.length} records)`);

  const v = verifyChain(load(LEDGER_PATH));
  console.log(v.ok ? `VERIFY OK   — ${v.msg}` : `VERIFY FAIL — ${v.msg}`);
  if (!v.ok) return 1;

  // re-derivation: editing one field must break the chain. Note this is a
  // NAIVE edit. An attacker who recomputes the chain over their own edit
  // passes this check — which is the limit, demonstrated not asserted.
  const bad = load(LEDGER_PATH);
  const victim = bad.find((r) => r.rel === 'MARK');
  if (victim) victim.body.tests = victim.body.tests + 1;
  const tampered = verifyChain(bad);
  if (tampered.ok) {
    console.error('tamper went undetected — the chain is not doing its job');
    return 1;
  }
  console.log('re-derivation: editing one record breaks verification ✓');
  console.log('  (a re-chained rewrite would NOT -- no anchor yet, so this log');
  console.log('   is ATTESTABLE, not tamper-evident. See the module docstring.)');

  console.log('');
  console.log(`files      ${files.length}`);
  console.log(`tests      ${total}${countOk ? '' : `   <-- EXPECTED ${EXPECTED}, MISMATCH`}`);
  console.log(`pass       ${passed}`);
  console.log(`fail       ${failed}`);
  console.log(`outcome    ${out.body.result} — ${out.body.detail}`);

  if (broken.length) {
    console.error(`\nFAILING FILES: ${broken.join(', ')}`);
    return 1;
  }
  if (!countOk) {
    console.error(`\nSUITE COUNT DRIFT: expected ${EXPECTED} tests, saw ${total}.`);
    console.error('Either a test was removed, or the glob is no longer matching every file.');
    return 1;
  }
  console.log('\nall cells accounted for ✓');
  return 0;
}

function cmdVerify(chainOnly) {
  if (!fs.existsSync(LEDGER_PATH)) {
    console.error(`no ledger at ${path.relative(ROOT, LEDGER_PATH)} — run: npm run witness`);
    return 1;
  }
  const records = load(LEDGER_PATH);

  const v = verifyChain(records);
  console.log(v.ok ? `CHAIN OK    — ${v.msg}` : `CHAIN FAIL  — ${v.msg}`);
  if (!v.ok) return 1;

  const marks = records.filter((r) => r.rel === 'MARK');
  const filesOnDisk = testFiles();
  const problems = [];

  if (marks.length !== filesOnDisk.length) {
    problems.push(
      `ledger witnesses ${marks.length} files, disk has ${filesOnDisk.length} — ` +
        `unwitnessed: ${filesOnDisk.filter((f) => !marks.some((m) => m.body.ref === f)).join(', ') || 'none'}`
    );
  }

  let total = 0;
  for (const m of marks) {
    const abs = path.join(ROOT, m.body.ref);
    if (!fs.existsSync(abs)) {
      problems.push(`witnessed file is GONE: ${m.body.ref}`);
      continue;
    }
    const digest = sha256(abs);
    if (digest !== m.body.sha256) {
      problems.push(`${m.body.ref}: sha256 changed (witnessed ${m.body.sha256.slice(0, 12)}, now ${digest.slice(0, 12)})`);
    }
    total += m.body.tests;

    if (!chainOnly) {
      const live = runFile(abs);
      if (live.tests !== m.body.tests) {
        problems.push(`${m.body.ref}: witnessed ${m.body.tests} tests, now runs ${live.tests}`);
      }
      if (live.fail > 0 || live.crashed) {
        problems.push(`${m.body.ref}: ${live.crashed ? 'crashed' : live.fail + ' failing'}`);
      }
    }
  }

  const outcome = records.find((r) => r.rel === 'OUTCOME');
  console.log('');
  console.log(`witnessed files  ${marks.length}`);
  console.log(`witnessed tests  ${total}`);
  if (outcome) console.log(`recorded outcome ${outcome.body.result} — ${outcome.body.detail}`);
  if (!chainOnly) console.log('re-ran every witnessed file against its recorded count');

  if (problems.length) {
    console.error('');
    for (const p of problems) console.error(`  ✗ ${p}`);
    console.error(`\nWITNESS BROKEN — ${problems.length} problem(s). The tree is not what was witnessed.`);
    return 1;
  }
  if (total !== 182) {
    console.error(`\nWITNESS BROKEN — expected 182 tests, ledger records ${total}.`);
    return 1;
  }
  console.log('\nchain re-derived, every count reproduced ✓');
  return 0;
}

function main(argv) {
  if (argv.includes('--verify')) return cmdVerify(argv.includes('--chain-only'));
  return cmdBuild();
}

if (require.main === module) {
  let code = 1;
  try {
    code = main(process.argv.slice(2));
  } catch (e) {
    console.error(`witness error: ${e && e.message ? e.message : e}`);
    code = 1;
  }
  process.exit(code);
}

module.exports = { fnv1a64, canon, Ledger, verifyChain, load, chainHash, GENESIS };
