import assert from 'node:assert/strict';
import test from 'node:test';

import { chooseDraw } from './pick-inspiration.mjs';

test('chooseDraw avoids recently used sources and stays within ranges', () => {
  const sources = [
    { id: 'used', label: 'Used', pageMin: 1, pageMax: 1, positionMin: 1, positionMax: 1, url: () => 'used' },
    { id: 'fresh', label: 'Fresh', pageMin: 4, pageMax: 8, positionMin: 3, positionMax: 9, url: (page) => `fresh/${page}` },
  ];
  const values = [0, 6, 5];
  const draw = chooseDraw({ sources, recentSources: ['used'], randomIntFn: (...args) => values.shift() ?? args[0], seed: 'fixed' });
  assert.equal(draw.source, 'fresh');
  assert.equal(draw.seed, 'fixed');
  assert.ok(draw.page >= 4 && draw.page <= 8);
  assert.ok(draw.position >= 3 && draw.position <= 9);
  assert.equal(draw.listingUrl, `fresh/${draw.page}`);
});
