const test = require('node:test');
const assert = require('node:assert');
const { createFeedbackCell, setNotes, score, topTags } = require('../dist/cells-feedback/feedback.js');

test('cell.feedback: detects concise preference', () => {
  const cell = createFeedbackCell('please be concise and brief in your answer');
  const tags = topTags(cell);
  assert.ok(tags.includes('concise'));
});

test('cell.feedback: detects thorough preference', () => {
  const cell = createFeedbackCell('I want a thorough and comprehensive explanation');
  const tags = topTags(cell);
  assert.ok(tags.includes('thorough'));
});

test('cell.feedback: positive score for helpful/correct notes', () => {
  const cell = createFeedbackCell('correct and helpful, exactly what I needed');
  const s = score(cell);
  assert.ok(s > 0, `s=${s}`);
});

test('cell.feedback: negative score for incorrect/verbose notes', () => {
  const cell = createFeedbackCell('wrong, too long and verbose, rambling');
  const s = score(cell);
  assert.ok(s < 0, `s=${s}`);
});

test('cell.feedback: setNotes updates detection', () => {
  const cell = createFeedbackCell('hello world');
  setNotes(cell, 'please be concise');
  assert.ok(topTags(cell).includes('concise'));
});
