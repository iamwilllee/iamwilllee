import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateConfig, renderSite, generate, readJson, saveJson, safeUrl } from './core.mjs';

const repo = { full_name: 'owner/demo', name: 'demo', private: true, html_url: 'https://github.com/owner/demo', homepage: '', pushed_at: '2026-10-14T00:00:00Z', language: 'TypeScript' };
const config = { profile: { name: 'Will', headline: 'Hello', bio: '', github: 'https://github.com/owner' }, projects: [{ repo: repo.full_name, name: '', description: '', url: '', platform: '' }] };

test('only known distinct repositories and safe visitor URLs can be saved', () => {
  assert.throws(() => validateConfig({ ...config, projects: [{ ...config.projects[0], repo: 'other/private' }] }, [repo]));
  assert.throws(() => validateConfig({ ...config, projects: [...config.projects, ...config.projects] }, [repo]));
  assert.throws(() => validateConfig({ ...config, projects: [{ ...config.projects[0], url: 'javascript:alert(1)' }] }, [repo]));
  assert.equal(safeUrl('https://user:password@example.com'), '');
  assert.equal(validateConfig(config, [repo]).projects.length, 1);
});

test('visitor HTML escapes repository content and omits private source links', () => {
  const html = renderSite(config, [{ ...repo, name: '<script>alert(1)</script>', description: '<img src=x onerror=alert(1)>', platform: '', url: '' }]);
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes(repo.html_url));
  const publicHtml = renderSite(config, [{ ...repo, private: false, name: 'Public', description: '', platform: '', url: '' }]);
  assert.ok(publicHtml.includes(repo.html_url));
});

test('generation reuses unchanged README, persists edits, and preserves last site on a provider failure', async () => {
  const root = await mkdtemp(join(tmpdir(), 'portfolio-builder-test-'));
  try {
    const file = join(root, 'config.json'); const edit = { ...config, projects: [{ ...config.projects[0], name: 'My name' }] };
    await saveJson(file, edit); assert.deepEqual(await readJson(file), edit);
    let calls = 0;
    const fetcher = async () => { calls++; return { content: Buffer.from('# Demo\n\nA useful product.').toString('base64'), sha: 'readme-sha' }; };
    const first = await generate(config, [repo], {}, root, root, () => {}, fetcher);
    assert.equal(first.projects[0].sha, 'readme-sha');
    await generate(edit, [repo], {}, root, root, () => {}, fetcher);
    assert.equal(calls, 1);
    const oldHtml = await readFile(join(root, 'site/index.html'), 'utf8'); assert.ok(oldHtml.includes('My name'));
    await assert.rejects(generate(config, [{ ...repo, pushed_at: 'new-time' }], {}, root, root, () => {}, async () => { throw new Error('network unavailable'); }));
    assert.equal(await readFile(join(root, 'site/index.html'), 'utf8'), oldHtml);
  } finally { await rm(root, { recursive: true, force: true }); }
});
