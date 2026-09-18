const test = require('node:test');
const assert = require('node:assert');
const { createRankingCell, submitRanking, extractTags, bestResponse, worstResponse, tagCounts, topPreference, rankingsByTag } = require('../dist/cells-ranking/ranking.js');

test('cell.ranking: extractTags finds concise/thorough', () => {
  assert.deepEqual(extractTags('too long and verbose').sort(), ['too_verbose', 'verbose'].sort().includes('verbose') ? ['too_verbose'] : ['too_verbose'].sort());
  assert.ok(extractTags('concise and helpful').includes('concise'));
  assert.ok(extractTags('concise and helpful').includes('helpful'));
});

test('cell.ranking: extractTags finds code_examples', () => {
  assert.ok(extractTags('show me code please').includes('code_examples'));
});

test('cell.ranking: create empty cell', () => {
  const c = createRankingCell();
  assert.equal(c.rankings.length, 0);
  assert.equal(c.responses.size, 0);
});

test('cell.ranking: submitRanking stores and extracts tags', () => {
  const c = createRankingCell();
  const r = submitRanking(c, 'test', [
    { id: 'a', text: 'A', rank: 1 },
    { id: 'b', text: 'B', rank: 2 }
  ], 'concise and helpful');
  assert.equal(r.tags.includes('concise'), true);
  assert.equal(r.tags.includes('helpful'), true);
});

test('cell.ranking: bestResponse returns rank=1', () => {
  const c = createRankingCell();
  const r = submitRanking(c, 'test', [
    { id: 'a', text: 'A', rank: 2 },
    { id: 'b', text: 'B', rank: 1 }
  ], 'good');
  assert.equal(bestResponse(r).id, 'b');
});

test('cell.ranking: worstResponse returns highest rank', () => {
  const c = createRankingCell();
  const r = submitRanking(c, 'test', [
    { id: 'a', text: 'A', rank: 1 },
    { id: 'b', text: 'B', rank: 2 }
  ], 'good');
  assert.equal(worstResponse(r).id, 'b');
});

test('cell.ranking: tagCounts counts per tag', () => {
  const c = createRankingCell();
  submitRanking(c, 't1', [{id:'a',text:'A',rank:1}], 'concise');
  submitRanking(c, 't2', [{id:'a',text:'A',rank:1}], 'concise and helpful');
  submitRanking(c, 't3', [{id:'a',text:'A',rank:1}], 'too verbose');
  const counts = tagCounts(c);
  assert.equal(counts.concise, 2);
  assert.equal(counts.helpful, 1);
  assert.equal(counts.too_verbose, 1);
});

test('cell.ranking: topPreference returns most common tag', () => {
  const c = createRankingCell();
  submitRanking(c, 't1', [{id:'a',text:'A',rank:1}], 'concise');
  submitRanking(c, 't2', [{id:'a',text:'A',rank:1}], 'concise');
  submitRanking(c, 't3', [{id:'a',text:'A',rank:1}], 'thorough');
  assert.equal(topPreference(c), 'concise');
});

test('cell.ranking: rankingsByTag filters', () => {
  const c = createRankingCell();
  submitRanking(c, 't1', [{id:'a',text:'A',rank:1}], 'concise');
  submitRanking(c, 't2', [{id:'a',text:'A',rank:1}], 'thorough');
  submitRanking(c, 't3', [{id:'a',text:'A',rank:1}], 'concise');
  const found = rankingsByTag(c, 'concise');
  assert.equal(found.length, 2);
});
