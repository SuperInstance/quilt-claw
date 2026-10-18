# witness/ — if it wasn't witnessed, it didn't happen

`ledger.jsonl` is an append-only, hash-chained receipt ledger of this repo's test
suite: one record per test file (path, source sha256, tests run), chained, plus one
`OUTCOME` recording the aggregate.

The idiom is ported from `SuperInstance/AI-Writings` → `labs/situation-recorder/recorder.py`.
The hash algebra is **byte-compatible** with it on purpose — same `fnv1a-64`, same
canonical JSON (`sort_keys=True`, compact separators), same
`GENESIS = 0x0000000000000000`, same chain rule:

```
hash = "0x%016x" % fnv1a64( canon({ prev, ...envelope_without_hash }) )
```

It was verified against the Python implementation: 9 canonical-encoding vectors
(key ordering, floats, unicode, astral-plane, control characters) and the chain rule
itself all produce identical bytes. One idiom to invent fewer of.

## Re-derive it

```bash
npm run witness            # rebuild the ledger from live test runs, verify, tamper self-test
npm run witness:verify     # re-derive the chain AND re-run every witnessed file
```

or directly:

```bash
node witness/ledger.js --verify             # full: chain + sha256 + live test counts
node witness/ledger.js --verify --chain-only # fast: chain + sha256 only, no test run
node witness/ledger.js                      # rewrite ledger.jsonl from scratch
```

## What breaks it

All four of these were fault-injected and confirmed to fail:

| tamper | detected by | exit |
|---|---|---|
| edit a test file (append a line) | sha256 drift | 1 |
| delete a test file | missing witness record | 1 |
| add an unwitnessed test file | file count mismatch | 1 |
| hand-edit `ledger.jsonl` | hash mismatch at `seq` | 1 |

## Why this exists

`npm test` used to be `node test/*.test.js`. Node resolves that to the **first**
path and treats the other 26 as `argv` — so it ran `ack.test.js` (4 tests) and
exited 0. A green badge over 4 of 182 tests. Nothing about "tests passed" tells you
how much was tested, which is why the count itself has to be a receipt.

`.github/workflows/test.yml` runs this on every push and PR, and additionally asserts
the count independently via `scripts/assert-suite.mjs` — deliberately a separate
implementation, so a bug in the witness can't quietly pass everything.

Note: the ledger records `tests` counts and `sha256`s, not wall-clock time or the
suite's result, so it stays byte-reproducible. Re-running the builder overwrites it
deterministically.
