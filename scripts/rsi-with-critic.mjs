/**
 * Production RSI runner with canon-aware critic.
 * 
 * Wires the ai.critic cell from cells-as-ai-kinds.ts into the judge slot.
 * The judge now evaluates accuracy against the source, not prose quality.
 * 
 * Usage: ZAI_TOKEN=... node scripts/rsi-with-critic.mjs [topic] [iterations=5]
 */

import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';

const ZAI_API = process.env.ZAI_TOKEN;
if (!ZAI_API) { console.error('Set ZAI_TOKEN'); process.exit(1); }

const topic = process.argv[2] || 'Quilt Cell Model';
const ITER = parseInt(process.argv[3] || '5', 10);

// Canon — what the AI must not contradict
const canon = `
The Quilt Cell Model
- The cell is the irreducible unit of intelligence
- 5 laws: BIND/LINK/EFFECT/VIEW/TICK (+6 adopted: FORGET/PROOF/ROUTE/CRDT/WORLD/TIME)
- Substrate: Subleq (1-instruction computer)
- Witness chain: every cell logs its work
`;

async function callAI(prompt, max_tokens = 500, jsonMode = false) {
  const body = {
    model: 'glm-4.5',
    messages: [{ role: 'user', content: prompt }],
    max_tokens,
    thinking: { type: 'disabled' },
  };
  if (jsonMode) body.response_format = { type: 'json_object' };
  const r = await fetch('https://api.z.ai/api/coding/paas/v4/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + ZAI_API, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  return data.choices?.[0]?.message?.content ?? '';
}

/** Distill with current prompt. */
async function distill(topic, promptTpl) {
  return await callAI(promptTpl + '\n\nTopic: ' + topic + '\n\nCanon:\n' + canon, 500);
}

/** Canon-aware judge. Scores accuracy against canon + completeness + conciseness. */
async function judge(topic, distilled) {
  const j = await callAI(
    `You are the canon-aware critic. Score this distillation against the canon below.

Canon:
${canon}

Respond ONLY with JSON: {"accuracy": 0.X, "completeness": 0.Y, "conciseness": 0.Z}

The accuracy score should penalize contradictions with the canon heavily.

Text to evaluate:
${distilled.slice(0, 300)}`,
    200, true
  );
  try {
    const parsed = JSON.parse(j);
    return (parsed.accuracy + parsed.completeness + parsed.conciseness) / 3;
  } catch { return 0.5; }
}

async function mutate(originalPrompt, scores) {
  const recent = scores.slice(-3).map((s, i) => `iter ${scores.length - 3 + i + 1}: ${s.toFixed(3)}`).join('\n');
  return await callAI(
    `Current distillation prompt: ${originalPrompt}\n\nCanon the distillation must respect:\n${canon}\n\nRecent scores: ${recent}\n\nRewrite the prompt to produce more canon-accurate distillations. Output ONLY the new prompt.`,
    500
  );
}

async function main() {
  let currentPrompt = `${topic}\nThe cell is the irreducible unit of intelligence. Write a 100-word distillation. (Canon source: ${canon.slice(0, 100)}...)`;
  
  const record = {
    topic, iterations: ITER, mode: 'canon-aware-critic',
    started_at: new Date().toISOString(),
    iterations_data: [],
    canon: canon,
  };

  const scores = [];
  
  for (let iter = 0; iter < ITER; iter++) {
    const distilled = await distill(topic, currentPrompt);
    const score = await judge(topic, distilled);
    scores.push(score);
    
    record.iterations_data.push({
      iter: iter + 1,
      prompt: currentPrompt.slice(0, 200),
      distilled: distilled.slice(0, 200),
      score,
    });
    console.log(`Iter ${iter + 1}: score=${score.toFixed(3)}`);
    console.log(`  ${distilled.slice(0, 100).replace(/\n/g, ' ')}...`);
    
    if (iter < ITER - 1) {
      currentPrompt = await mutate(currentPrompt, scores);
    }
  }
  
  record.ended_at = new Date().toISOString();
  record.scores = scores;
  record.initial = scores[0];
  record.final = scores[scores.length - 1];
  record.peak = Math.max(...scores);
  record.peak_iter = scores.indexOf(record.peak) + 1;
  record.improvement_pct = ((record.final - record.initial) / Math.max(0.001, record.initial) * 100).toFixed(1);
  
  mkdirSync(path.join(process.cwd(), 'runs'), { recursive: true });
  const stamp = record.started_at.replace(/[:.]/g, '-');
  const filename = path.join(process.cwd(), 'runs', `rsi-critic-${stamp}.json`);
  writeFileSync(filename, JSON.stringify(record, null, 2));
  console.log(`\nFinal: ${record.final.toFixed(3)} (improvement: ${record.improvement_pct}%)`);
  console.log(`Peak: ${record.peak.toFixed(3)} at iter ${record.peak_iter}`);
  console.log(`Saved to: ${filename}`);
}

main().catch(console.error);
