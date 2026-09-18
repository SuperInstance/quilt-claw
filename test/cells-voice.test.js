const test = require('node:test');
const assert = require('node:assert');
const { createVoiceCell, transcribe, synthesize, speakerTranscript, transcriptsBySpeaker, lowConfidenceTranscripts, totalSpeakers, averageConfidence } = require('../dist/cells-voice/voice.js');

test('cell.voice: create empty cell', () => {
  const c = createVoiceCell('test');
  assert.equal(c.tiles.length, 0);
  assert.equal(c.speakers.size, 0);
});

test('cell.voice: transcribe creates tile with BIND+VAD+ASR witnesses', () => {
  const c = createVoiceCell();
  const t = transcribe(c, { speaker: 'alice', audioBuffer: 'test', durationMs: 1000, confidence: 0.95 }, 'hello world');
  assert.equal(t.witnessLog.length, 3);
  assert.equal(t.witnessLog[0].type, 'BIND');
  assert.equal(t.witnessLog[1].type, 'VAD');
  assert.equal(t.witnessLog[2].type, 'ASR');
  assert.equal(c.tiles.length, 1);
});

test('cell.voice: speakers are tracked', () => {
  const c = createVoiceCell();
  transcribe(c, { speaker: 'alice', audioBuffer: 'a', durationMs: 500, confidence: 0.9 });
  transcribe(c, { speaker: 'bob', audioBuffer: 'b', durationMs: 700, confidence: 0.85 });
  assert.equal(totalSpeakers(c), 2);
});

test('cell.voice: synthesize adds TTS witness to last tile', () => {
  const c = createVoiceCell();
  transcribe(c, { speaker: 'alice', audioBuffer: 'a', durationMs: 500, confidence: 0.9 });
  const r = synthesize(c, { text: 'hello back', voice: 'en-US' });
  assert.ok(r.durationMs > 0);
  assert.equal(r.voice, 'en-US');
  assert.equal(c.tiles[0].witnessLog.length, 4);  // BIND + VAD + ASR + TTS
});

test('cell.voice: speakerTranscript filters by speaker', () => {
  const c = createVoiceCell();
  transcribe(c, { speaker: 'alice', audioBuffer: 'a', durationMs: 500, confidence: 0.9 });
  transcribe(c, { speaker: 'bob', audioBuffer: 'b', durationMs: 500, confidence: 0.9 });
  const alice = speakerTranscript(c, 'alice');
  assert.equal(alice.length, 1);
  assert.equal(alice[0].speaker, 'alice');
});

test('cell.voice: lowConfidenceTranscripts filters', () => {
  const c = createVoiceCell();
  transcribe(c, { speaker: 'a', audioBuffer: 'x', durationMs: 500, confidence: 0.5 });
  transcribe(c, { speaker: 'a', audioBuffer: 'x', durationMs: 500, confidence: 0.9 });
  const low = lowConfidenceTranscripts(c, 0.7);
  assert.equal(low.length, 1);
});

test('cell.voice: averageConfidence is mean', () => {
  const c = createVoiceCell();
  transcribe(c, { speaker: 'a', audioBuffer: 'x', durationMs: 500, confidence: 0.8 });
  transcribe(c, { speaker: 'b', audioBuffer: 'x', durationMs: 500, confidence: 0.6 });
  assert.ok(Math.abs(averageConfidence(c) - 0.7) < 0.01);
});

test('cell.voice: transcriptsBySpeaker groups', () => {
  const c = createVoiceCell();
  transcribe(c, { speaker: 'alice', audioBuffer: 'a', durationMs: 500, confidence: 0.9 });
  transcribe(c, { speaker: 'alice', audioBuffer: 'b', durationMs: 500, confidence: 0.85 });
  transcribe(c, { speaker: 'bob', audioBuffer: 'c', durationMs: 500, confidence: 0.95 });
  const grouped = transcriptsBySpeaker(c);
  assert.equal(grouped.alice.length, 2);
  assert.equal(grouped.bob.length, 1);
});
