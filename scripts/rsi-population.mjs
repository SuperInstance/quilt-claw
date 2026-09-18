/**
 * Population-N RSI runner.
 *
 * Runs N prompts in parallel; mutates the best each iteration.
 * Adds selection pressure — the loop is more stable than population=1.
 *
 * Usage: ZAI_TOKEN=... node scripts/rsi-population.mjs [topic] [POP=3] [iterations=5]
 */

import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';

const ZAI_API = process.env.ZAI_TOKEN;
if (!ZAI_API) { console.error('Set ZAI_TOKEN'); process.exit(1); }

const topic = process.argv[2] || 'Quilt Subleq';
const POP = parseInt(process.argv[3] || '3', 10);
const iterations = parseInt(process.argv[4] || '5', 10);

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

async function distill(topic, promptTpl) {
  return await callAI(promptTpl + '\n\nTopic: ' + topic, 500);
}

async function judge(topic, distilled) {
  const j = await callAI(
    `Score this distillation. Respond ONLY with JSON: {"accuracy": 0.X, "completeness": 0.Y, "conciseness": 0.Z}\n\nText:\n${distilled.slice(0, 200)}`,
    100, true
  );
  try {
    const parsed = JSON.parse(j);
    return (parsed.accuracy + parsed.completeness + parsed.conciseness) / 3;
  } catch { return 0.5; }
}

async function mutate(originalPrompt, scores) {
  const recent = scores.slice(-3).map((s, i) => `iter ${scores.length - 3 + i + 1}: ${s.toFixed(3)}`).join('\n');
  return await callAI(
    `Current distillation prompt: ${originalPrompt}\n\nRecent scores: ${recent}\n\nRewrite the prompt to be sharper. Output ONLY the new prompt.`,
    500
  );
}

async function main() {
  const prompts = Array.from({ length: POP }, (_, i) =>
    `${topic}\nThe substrate grows through the 5 laws. Write a ${100 + i*20}-word distillation. (Variant ${i+1})`
  );
  let scores = prompts.map(() => 0);
  let bestPrompt = prompts[0];
  let bestScore = 0;

  const record = {
    topic, population: POP, iterations,
    started_at: new Date().toISOString(),
    iterations_data: [],
  };

  // Initial distillation
  for (let i = 0; i < POP; i++) {
    const d = await distill(topic, prompts[i]);
    const s = await judge(topic, d);
    scores[i] = s;
    if (s > bestScore) { bestScore = s; bestPrompt = prompts[i]; }
  }
  record.iterations_data.push({ iter: 0, population: prompts.slice(), scores: scores.slice() });
  console.log(`Initial: best=${bestScore.toFixed(3)} [${scores.map(s => s.toFixed(2)).join(', ')}]`);

  for (let iter = 1; iter <= iterations; iter++) {
    const newPrompts = [...prompts];
    newPrompts[0] = await mutate(bestPrompt, scores);
    for (let i = 1; i < POP; i++) {
      newPrompts[i] = prompts[i] + `\nKeep it under ${150 + i*50} words.`;
    }

    const newScores = [];
    for (let i = 0; i < POP; i++) {
      const d = await distill(topic, newPrompts[i]);
      const s = await judge(topic, d);
      newScores.push(s);
      if (s > bestScore) { bestScore = s; bestPrompt = newPrompts[i]; }
    }

    prompts.splice(0, prompts.length, ...newPrompts);
    scores = newScores;

    record.iterations_data.push({
      iter, population: prompts.slice(), scores: scores.slice(),
      best_score: bestScore,
    });
    console.log(`Iter ${iter}: best=${bestScore.toFixed(3)} [${scores.map(s => s.toFixed(2)).join(', ')}]`);
  }

  record.ended_at = new Date().toISOString();
  record.best_score = bestScore;
  record.best_prompt = bestPrompt;

  mkdirSync(path.join(process.cwd(), 'runs'), { recursive: true });
  const stamp = record.started_at.replace(/[:.]/g, '-');
  const filename = path.join(process.cwd(), 'runs', `rsi-pop-${POP}-${stamp}.json`);
  writeFileSync(filename, JSON.stringify(record, null, 2));
  console.log(`\nFinal best: ${bestScore.toFixed(3)}`);
  console.log(`Saved to: ${filename}`);
}

main().catch(console.error);
