/**
 * Test the bus + store + cells using stub AI.
 *
 * Uses Node's built-in test runner (node:test) — no test framework needed.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');

// We need to compile TS first. For now, mock the modules.

// Stub AI engine
function makeStubAI() {
  return {
    async call({ id }) {
      if (id.startsWith('researcher:')) return 'The Quilt cell model is the irreducible unit of intelligence. The substrate grows.';
      if (id.startsWith('teacher:')) return 'Q: What is the cell model?\nA: The cell is the irreducible unit of intelligence.';
      if (id.startsWith('distiller:')) return 'The Quilt Cell Model\nThe cell is the irreducible unit of intelligence.';
      return 'stub';
    }
  };
}

// Inline the bus logic for testing without TS compilation
class MessageBus {
  constructor() {
    this.tasks = new Map();
    this.claimed = new Set();
    this.completed = new Set();
    this.subscribers = new Map();
  }
  submit(task) {
    this.tasks.set(task.id, task);
    this.notifySubscribers(task);
    return task.id;
  }
  subscribe(kind, callback) {
    if (!this.subscribers.has(kind)) this.subscribers.set(kind, new Set());
    this.subscribers.get(kind).add(callback);
    return () => this.subscribers.get(kind).delete(callback);
  }
  claim(taskId) {
    if (this.claimed.has(taskId) || this.completed.has(taskId)) return false;
    this.claimed.add(taskId);
    return true;
  }
  complete(taskId) {
    this.claimed.delete(taskId);
    this.completed.add(taskId);
  }
  notifySubscribers(task) {
    const subs = this.subscribers.get(task.kind);
    if (!subs) return;
    for (const cb of subs) {
      try { cb(task); } catch (e) { console.error(e); }
    }
  }
  dump() {
    const subs = {};
    for (const [k, v] of this.subscribers) subs[k] = v.size;
    return {
      pending: this.tasks.size - this.claimed.size - this.completed.size,
      claimed: this.claimed.size,
      completed: this.completed.size,
      subscribers: subs,
    };
  }
}

class KnowledgeStore {
  constructor() {
    this.entries = new Map();
    this.topicIndex = new Map();
  }
  add(entry) {
    this.entries.set(entry.id, entry);
    for (const word of entry.topic.toLowerCase().split(/\s+/)) {
      if (!this.topicIndex.has(word)) this.topicIndex.set(word, new Set());
      this.topicIndex.get(word).add(entry.id);
    }
    return entry.id;
  }
  get(id) { return this.entries.get(id); }
  search(query, limit = 10) {
    const queryWords = query.toLowerCase().split(/\s+/).filter((w) => w.length > 0);
    const scores = new Map();
    for (const word of queryWords) {
      const matching = this.topicIndex.get(word);
      if (!matching) continue;
      for (const entryId of matching) {
        scores.set(entryId, (scores.get(entryId) ?? 0) + 1);
      }
    }
    return Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id]) => this.entries.get(id));
  }
  verify(id) {
    const entry = this.entries.get(id);
    if (!entry) return { valid: false, missing: ['entry not found'] };
    const missing = [];
    if (!entry.provenance.research) missing.push('research');
    if (!entry.provenance.qa) missing.push('qa');
    if (!entry.provenance.critique) missing.push('critique');
    if (!entry.provenance.distilled) missing.push('distilled');
    return { valid: missing.length === 0, missing };
  }
  dump() {
    return {
      entries: this.entries.size,
      topics: this.topicIndex.size,
    };
  }
}

test('bus: submit + subscribe + claim + complete', () => {
  const bus = new MessageBus();
  const received = [];
  bus.subscribe('research', (t) => received.push(t));

  const task = { id: 't1', kind: 'research', prompt: 'hello', created_at: 'now' };
  bus.submit(task);

  assert.equal(received.length, 1);
  assert.equal(received[0].id, 't1');

  assert.equal(bus.claim('t1'), true);
  assert.equal(bus.claim('t1'), false);  // already claimed

  bus.complete('t1');
  assert.equal(bus.dump().completed, 1);
});

test('store: add + get + search', () => {
  const store = new KnowledgeStore();
  const entry = {
    id: 'e1',
    topic: 'Quilt Cell Model',
    body: 'The cell is the irreducible unit.',
    sources: [],
    qa_pairs: [],
    confidence: 0.8,
    provenance: { research: 'w1', qa: 'w2', critique: 'w3', distilled: 'w4' },
    produced_at: 'now',
    witness_chain: ['w1', 'w2', 'w3', 'w4'],
  };
  store.add(entry);
  assert.equal(store.get('e1').id, 'e1');
  const results = store.search('quilt');
  assert.equal(results.length, 1);
  assert.equal(results[0].id, 'e1');
});

test('store: verify witness chain', () => {
  const store = new KnowledgeStore();
  const validEntry = {
    id: 'e1',
    topic: 'Quilt',
    body: 'cells',
    sources: [],
    qa_pairs: [],
    confidence: 0.5,
    provenance: { research: 'w1', qa: 'w2', critique: 'w3', distilled: 'w4' },
    produced_at: 'now',
    witness_chain: ['w1', 'w2', 'w3', 'w4'],
  };
  const incompleteEntry = {
    id: 'e2',
    topic: 'Subleq',
    body: 'one instruction',
    sources: [],
    qa_pairs: [],
    confidence: 0.5,
    provenance: { research: '', qa: '', critique: '', distilled: '' },
    produced_at: 'now',
    witness_chain: [],
  };
  store.add(validEntry);
  store.add(incompleteEntry);

  assert.equal(store.verify('e1').valid, true);
  assert.equal(store.verify('e2').valid, false);
  assert.deepEqual(store.verify('e2').missing.sort(), ['critique', 'distilled', 'qa', 'research']);
});

test('full pipeline: research → teach → critique → distill', async () => {
  const bus = new MessageBus();
  const store = new KnowledgeStore();
  const ai = makeStubAI();

  // Wire cells
  const researchOutputs = new Map();
  const qaOutputs = new Map();
  const critiqueOutputs = new Map();

  bus.subscribe('research', async (task) => {
    bus.claim(task.id);
    const output = {
      task_id: task.id,
      summary: await ai.call({ id: `researcher:${task.id}`, prompt: task.prompt }),
      sources: [{ url: 'local', title: 'stub', snippet: '' }],
      confidence: 0.7,
      witness_hash: 'w-r-' + task.id,
      produced_at: new Date().toISOString(),
    };
    researchOutputs.set(task.id, output);
    bus.complete(task.id);
  });

  bus.subscribe('teach', async (task) => {
    bus.claim(task.id);
    const researchId = task.context.research_id;
    const research = researchOutputs.get(researchId);
    const output = {
      research_id: researchId,
      pairs: [
        { question: 'What?', answer: research.summary.slice(0, 40) },
      ],
      quality_score: 0.8,
      witness_hash: 'w-q-' + task.id,
      produced_at: new Date().toISOString(),
    };
    qaOutputs.set(task.id, output);
    bus.complete(task.id);
  });

  bus.subscribe('critique', async (task) => {
    bus.claim(task.id);
    const output = {
      qa_id: task.context.qa_id,
      accuracy: 0.8,
      completeness: 1.0,
      flagged_claims: [],
      suggestions: [],
      witness_hash: 'w-c-' + task.id,
      produced_at: new Date().toISOString(),
    };
    critiqueOutputs.set(task.id, output);
    bus.complete(task.id);
  });

  bus.subscribe('synthesize', async (task) => {
    bus.claim(task.id);
    const research = researchOutputs.get(task.context.research_id);
    const qa = qaOutputs.get(task.context.qa_id);
    const critique = critiqueOutputs.get(task.context.critique_id);
    const entry = {
      id: 'entry-' + task.id,
      topic: 'Quilt Cell Model',
      body: await ai.call({ id: `distiller:${task.id}`, prompt: 'go' }),
      sources: research.sources.map((s) => s.url),
      qa_pairs: qa.pairs,
      confidence: (research.confidence + critique.accuracy + critique.completeness) / 3,
      provenance: {
        research: research.witness_hash,
        qa: qa.witness_hash,
        critique: critique.witness_hash,
        distilled: 'w-d-' + task.id,
      },
      produced_at: new Date().toISOString(),
      witness_chain: [research.witness_hash, qa.witness_hash, critique.witness_hash, 'w-d-' + task.id],
    };
    store.add(entry);
    bus.complete(task.id);
  });

  // Run pipeline
  const r1 = { id: 'r1', kind: 'research', prompt: 'q', created_at: 'now' };
  bus.submit(r1);
  await new Promise((r) => setTimeout(r, 10));

  const q1 = { id: 'q1', kind: 'teach', prompt: 'q', context: { research_id: 'r1' }, created_at: 'now' };
  bus.submit(q1);
  await new Promise((r) => setTimeout(r, 10));

  const c1 = { id: 'c1', kind: 'critique', prompt: 'q', context: { qa_id: 'q1' }, created_at: 'now' };
  bus.submit(c1);
  await new Promise((r) => setTimeout(r, 10));

  const s1 = { id: 's1', kind: 'synthesize', prompt: 'q', context: { research_id: 'r1', qa_id: 'q1', critique_id: 'c1' }, created_at: 'now' };
  bus.submit(s1);
  await new Promise((r) => setTimeout(r, 10));

  assert.equal(store.dump().entries, 1);
  const entries = store.search('quilt');
  assert.equal(entries.length, 1);
  assert.equal(entries[0].confidence > 0, true);
  assert.equal(entries[0].witness_chain.length, 4);
});
