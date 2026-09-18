const test = require('node:test');
const assert = require('node:assert');
const { createPerceptionCell, captureFrame, encodeFrame, linkFrames, framesBySource, recentFrames, totalFrames, averageFrameSize, sourceCounts } = require('../dist/cells-perception/perception.js');

test('cell.perception: create empty cell', () => {
  const c = createPerceptionCell('test');
  assert.equal(c.frames.length, 0);
  assert.equal(c.totalBytes, 0);
});

test('cell.perception: captureFrame creates BIND+CAPTURE witnesses', () => {
  const c = createPerceptionCell();
  const f = captureFrame(c, 'camera', 'rgba', 'rawdata', { width: 1920, height: 1080 });
  assert.equal(f.witnessLog.length, 2);
  assert.equal(f.witnessLog[0].type, 'BIND');
  assert.equal(f.witnessLog[1].type, 'CAPTURE');
  assert.equal(f.width, 1920);
  assert.equal(f.height, 1080);
});

test('cell.perception: captureFrame tracks total bytes', () => {
  const c = createPerceptionCell();
  captureFrame(c, 'microphone', 'pcm', 'a'.repeat(1000), { sampleRate: 44100, channels: 2 });
  captureFrame(c, 'microphone', 'pcm', 'b'.repeat(2000), { sampleRate: 44100, channels: 2 });
  assert.equal(c.totalBytes, 3000);
});

test('cell.perception: encodeFrame changes format', () => {
  const c = createPerceptionCell();
  const f = captureFrame(c, 'camera', 'rgba', 'x'.repeat(100));
  const encoded = encodeFrame(c, f.id, { format: 'jpeg', quality: 80 });
  assert.equal(encoded.format, 'jpeg');
  assert.equal(encoded.witnessLog[encoded.witnessLog.length - 1].type, 'ENCODE');
});

test('cell.perception: linkFrames creates LINK witnesses', () => {
  const c = createPerceptionCell();
  const a = captureFrame(c, 'camera', 'rgba', 'x');
  const b = captureFrame(c, 'microphone', 'pcm', 'y');
  assert.equal(linkFrames(c, a.id, b.id, 'audiovisual'), true);
  assert.ok(a.witnessLog.some(w => w.type === 'LINK'));
  assert.ok(b.witnessLog.some(w => w.type === 'LINK'));
});

test('cell.perception: framesBySource filters', () => {
  const c = createPerceptionCell();
  captureFrame(c, 'camera', 'rgba', 'a');
  captureFrame(c, 'camera', 'rgba', 'b');
  captureFrame(c, 'microphone', 'pcm', 'c');
  const cameras = framesBySource(c, 'camera');
  assert.equal(cameras.length, 2);
});

test('cell.perception: recentFrames returns last N', () => {
  const c = createPerceptionCell();
  for (let i = 0; i < 10; i++) captureFrame(c, 'camera', 'rgba', `f${i}`);
  const recent = recentFrames(c, 3);
  assert.equal(recent.length, 3);
});

test('cell.perception: averageFrameSize', () => {
  const c = createPerceptionCell();
  captureFrame(c, 'camera', 'rgba', 'a'.repeat(100));
  captureFrame(c, 'camera', 'rgba', 'b'.repeat(200));
  assert.equal(averageFrameSize(c), 150);
});

test('cell.perception: sourceCounts', () => {
  const c = createPerceptionCell();
  captureFrame(c, 'camera', 'rgba', 'a');
  captureFrame(c, 'microphone', 'pcm', 'b');
  captureFrame(c, 'microphone', 'pcm', 'c');
  const counts = sourceCounts(c);
  assert.equal(counts.camera, 1);
  assert.equal(counts.microphone, 2);
});
