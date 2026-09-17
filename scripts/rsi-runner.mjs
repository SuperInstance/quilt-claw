/**
 * Production RSI runner — saves runs to disk for audit.
 * 
 * Usage: ZAI_TOKEN=... node rsi-runner.mjs <topic> <iterations>
 * 
 * Writes:
 *   ./runs/<topic>-<timestamp>.json
 */

import { writeFileSync, mkdirSync } from 'fs';

const ZAI_API = process.env.ZAI_TOKEN;
if (!ZAI_API) { console.error('Set ZAI_TOKEN'); process.exit(1); }

const topic = process.argv[2] || 'Quilt Cell Model';
const iterations = parseInt(process.argv[3] || '5', 10);

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
  } catch {
    return 0.5;
  }
}

async function mutate(originalPrompt, scores) {
  const recent = scores.slice(-3).map((s, i) => `iter ${scores.length - 3 + i + 1}: ${s.toFixed(3)}`).join('\n');
  return await callAI(
    `Current distillation prompt: ${originalPrompt}\n\nRecent scores: ${recent}\n\nRewrite the prompt to be sharper. Output ONLY the new prompt.`,
    500
  );
}

async function main() {
  let currentPrompt = `${topic}\nThe substrate grows through the 5 laws. Write a 100-word distillation.`;
  
  const record = {
    topic,
    iterations,
    initial_prompt: currentPrompt,
    started_at: new Date().toISOString(),
    iterations_data: [],
  };
  
  const scores = [];
  
  for (let iter = 0; iter < iterations; iter++) {
    const distilled = await distill(topic, currentPrompt);
    const score = await judge(topic, distilled);
    scores.push(score);
    
    record.iterations_data.push({
      iter: iter + 1,
      prompt: currentPrompt,
      distilled: distilled.slice(0, 300),
      score,
      produced_at: new Date().toISOString(),
    });
    
    if (iter < iterations - 1) {
      currentPrompt = await mutate(currentPrompt, scores);
    }
  }
  
  record.ended_at = new Date().toISOString();
  record.scores = scores;
  record.initial_score = scores[0];
  record.final_score = scores[scores.length - 1];
  record.improvement_pct = ((record.final_score - record.initial_score) / Math.max(0.001, record.initial_score)) * 100;
  record.peak_score = Math.max(...scores);
  record.peak_iter = scores.indexOf(record.peak_score) + 1;
  
  mkdirSync('./runs', { recursive: true });
  const stamp = record.started_at.replace(/[:.]/g, '-');
  const filename = `./runs/rsi-${topic.toLowerCase().replace(/\s+/g, '-')}-${stamp}.json`;
  writeFileSync(filename, JSON.stringify(record, null, 2));
  
  console.log(`\nRSI run complete`);
  console.log(`Topic: ${topic}`);
  console.log(`Iterations: ${iterations}`);
  console.log(`Score progression: ${scores.map(s => s.toFixed(3)).join(' → ')}`);
  console.log(`Initial: ${record.initial_score.toFixed(3)} → Final: ${record.final_score.toFixed(3)}`);
  console.log(`Peak: ${record.peak_score.toFixed(3)} at iter ${record.peak_iter}`);
  console.log(`Improvement: ${record.improvement_pct.toFixed(1)}%`);
  console.log(`Saved to: ${filename}`);
}

main().catch(console.error);
