# quilt-claw

> **Quilt-native knowledge crew. The agents are cells. The bus is a cell. The store is a cell.**

A Quilt rewrite of `autoclaw`. Same 4 roles — researcher, teacher, critic, distiller — but instead of a Python CLI with a SQLite message bus, the whole thing is a sheet of cells. The substrate does the rest.

## Why rewrite?

autoclaw is a knowledge crew with 4 agents (researcher / teacher / critic / distiller) wired through a SQLite pub/sub bus. It works. But it's a CLI tool, not a substrate.

Quilt-native means:

- **Cells, not agents.** Each role is a cell kind. A `researcher` cell subscribes to incoming task cells. A `critic` cell watches output cells and emits critique cells. The roles are cell kinds, not separate processes.
- **Bus, not broker.** The message bus is a `value` cell. Tasks arrive as `input.task` cells. The bus cell holds pending task IDs; cells BIND/LINK to claim them.
- **Vector store, not external service.** The vector store is a `cell.value` holding the embedding index. Looking up "what does X mean" is a `cell.read` operation, not a network call.
- **Quilt-evolve for the critic.** The critic cell is a `@quilt/evolve` loop. The generator creates adversarial inputs. The judge scores outputs. The mutator rewrites the distiller's prompt. The loop runs forever, getting sharper.
- **Subleq substrate.** Every cell is a Subleq program. The scaling function resolves task IDs, embeddings, and remote API endpoints uniformly.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  quilt-claw                                             │
│                                                         │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐            │
│  │researcher│   │ teacher  │   │  critic  │   ┌──────┐ │
│  │  (cell)  │   │  (cell)  │   │  (cell)  │   │store │ │
│  └────┬─────┘   └────┬─────┘   └────┬─────┘   │(cell)│ │
│       │              │              │          └──┬───┘ │
│       │              │              │             │     │
│       └──────────────┴──────────────┘             │     │
│                      │                          │     │
│                      ▼                          │     │
│              ┌──────────────┐                   │     │
│              │  message bus │ ◄─────────────────┘     │
│              │   (value)    │                         │
│              └──────┬───────┘                         │
│                     │                                 │
│                     ▼                                 │
│              ┌──────────────┐                         │
│              │ distiller    │                         │
│              │  (cell +     │                         │
│              │   evolve)    │                         │
│              └──────────────┘                         │
└─────────────────────────────────────────────────────────┘
```

## Quick start

```bash
cd /workspace/repos/quilt-claw
npm install
node examples/01_researcher_only.js
node examples/02_full_crew.js
node examples/03_quilt_evolve_critic.js
```

## The cells

| Cell kind | Role | Input cells | Output cells |
|-----------|------|-------------|--------------|
| `input.task` | A task arrives from outside | (none) | (none) |
| `value.bus` | Pending task queue | `input.task` | `bus.claimed` |
| `cell.researcher` | Web search + LLM synthesis | `bus.claimed` | `output.research` |
| `cell.teacher` | Q&A pair generation | `output.research` | `output.qa` |
| `cell.critic` | Adversarial evaluation | `output.qa` | `output.critique` |
| `cell.distiller` | Knowledge consolidation | `output.critique` | `output.entry` |
| `value.store` | Vector store (in-memory) | `output.entry` | `store.read` |
| `cell.evolve` | @quilt/evolve loop | `cell.critic` | `cell.distiller` (mutated) |

Each cell subscribes via LINK. Each subscription is a Quilt LINK, not an HTTP call.

## What it gets from Quilt

- **Substrate is uniform.** Memory, cells, and remote API endpoints are all blocks. The scaling function resolves them.
- **Merkle chain audit.** Every witness cell records the agent, input, output, and timestamp. The chain is auditable.
- **Recursive self-improvement.** The critic cell IS an `@quilt/evolve` loop. It improves the distiller over time.
- **Distribution of reality.** A quilt-claw instance can call across the network to another quilt-claw instance via the port cell.
- **Witness cells.** Every knowledge entry has a witness. If the distiller produces nonsense, the witness catches it.

## What it inherits from autoclaw

- The 4 roles and their responsibilities
- The knowledge store with hot/warm/cold tiers
- The LLM provider interface (we use `@quilt/ai`)
- The pub/sub subscription model (we use Quilt LINK)

## What changes

- No Python CLI. No SQLite. No external message broker.
- No separate processes. All in one sheet.
- No network calls for cell-to-cell communication.
- No central scheduler. Quilt's runtime advances the cells.
- The bus is a value cell, not a SQLite table.

## License

MIT
