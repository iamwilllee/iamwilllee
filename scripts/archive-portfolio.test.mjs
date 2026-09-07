import assert from 'node:assert/strict';
import test from 'node:test';

import { parseDateArgument, rewriteSnapshotHtml, upsertVersion } from './archive-portfolio.mjs';

test('parseDateArgument supports inline and separated values', () => {
  assert.equal(parseDateArgument(['--date=2026-09-07']), '2026-09-07');
  assert.equal(parseDateArgument(['--date', '2026-09-08']), '2026-09-08');
  assert.throws(() => parseDateArgument(['--date', 'tomorrow']), /Invalid archive date/);
});

test('rewriteSnapshotHtml makes archived dependencies self-contained', () => {
  const html = '<head></head><a class="history-link" href="history/">History</a><link href="css/style.css"><img src="assets/hero.png"><link href="favicon.svg"><script src="js/theme.js"></script>';
  const rewritten = rewriteSnapshotHtml(html, [
    { original: 'assets/hero.png', archived: 'aaa.png' },
    { original: 'favicon.svg', archived: 'bbb.svg' },
  ]);
  assert.match(rewritten, /noindex/);
  assert.match(rewritten, /href="style\.css"/);
  assert.match(rewritten, /href="\.\.\/"/);
  assert.match(rewritten, /src="\.\.\/assets\/aaa\.png"/);
  assert.match(rewritten, /href="\.\.\/assets\/bbb\.svg"/);
  assert.match(rewritten, /src="theme\.js"/);
});

test('upsertVersion is idempotent and newest-first', () => {
  const original = { versions: [{ date: '2026-09-06', title: 'Old' }] };
  const updated = upsertVersion(original, { date: '2026-09-07', title: 'New' });
  const replaced = upsertVersion(updated, { date: '2026-09-07', title: 'Updated' });
  assert.deepEqual(replaced.versions.map(({ date }) => date), ['2026-09-07', '2026-09-06']);
  assert.equal(replaced.versions[0].title, 'Updated');
  assert.equal(replaced.versions.length, 2);
});
