# witness/ — if it wasn't witnessed, it didn't happen

> **This ledger is ATTESTABLE, not tamper-evident.** It has one of the three
> legs an anchor needs. The chain re-derives; the head is not signed; no head is
> published out of band. See *What this ledger does not prove* below — and note
> that deleting the final `OUTCOME` row still makes `--verify` exit 0.

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

These are all **re-derivation** checks. That is a real property and it is
worth having — but it is not the same thing as tamper-evidence, because all
four assume the tamperer does *not* recompute the chain.

## What this ledger does not prove

A log earns the word **tamper-evident** only when all three legs hold:

| # | leg | here? |
|---|---|---|
| 1 | **chain re-derives** — replay reproduces every linkage | **yes** |
| 2 | **head signed** by a key we trust | no — nothing is signed |
| 3 | **head published out of band** — where the writer does not control it | no — no published head exists |

This ledger has **leg 1 only**. Two attacks are therefore invisible to it:

- **The re-chained rewrite.** Recompute the chain over your own edit and every
  id agrees, because you recomputed it. The four faults in the table above are
  all *naive* tampers.
- **The tail truncation.** *A truncated chain is a shorter valid chain.*
  Measured here: delete the final `OUTCOME` row — the aggregate verdict for the
  whole run — and `node witness/ledger.js --verify` still prints `CHAIN OK` and
  **exits 0**. Nothing in the file records that the `OUTCOME` ever existed.

So the verdict string says **`chain-intact`**, which means precisely *the chain
verified* — not *nothing was tampered with*. Closing this gap is one build:
sign the head (Ed25519, with a verifier that refuses rather than degrades when
the backend is absent) and commit that signed head somewhere this repo's own
workflow cannot push to.

Normative definitions: [`SuperInstance/witness-spec`](https://github.com/SuperInstance/witness-spec) `SPEC.md`.

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
