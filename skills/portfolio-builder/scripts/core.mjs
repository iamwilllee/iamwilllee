import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, mkdir, rename, copyFile } from 'node:fs/promises';
import { join, basename, extname } from 'node:path';

const exec = promisify(execFile);
export const escapeHtml = (s = '') => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function safeUrl(value) {
  if (!value) return '';
  try { const u = new URL(value); return ['http:', 'https:'].includes(u.protocol) && !u.username && !u.password ? u.href : ''; } catch { return ''; }
}
export async function readJson(file, fallback) {
  try { return JSON.parse(await readFile(file, 'utf8')); } catch (e) { if (e.code === 'ENOENT') return fallback; throw e; }
}
export async function saveJson(file, value) {
  await mkdir(join(file, '..'), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(value, null, 2) + '\n'); await rename(tmp, file);
}
export async function github(endpoint, paginate = false) {
  try {
    const { stdout } = await exec('gh', ['api', ...(paginate ? ['--paginate', '--slurp'] : []), endpoint], { timeout: 60000, maxBuffer: 8 * 1024 * 1024 });
    const data = JSON.parse(stdout); return paginate ? data.flat() : data;
  } catch (e) {
    if (e.stderr?.includes('HTTP 404')) { const error = new Error('GitHub 未找到仓库或 README（404）。'); error.status = 404; throw error; }
    throw new Error('GitHub 读取失败。请检查网络及 gh 登录状态后重试；已保存的配置和预览会保留。');
  }
}
export async function fetchRepositories() {
  const rows = await github('user/repos?affiliation=owner&sort=pushed&per_page=100', true);
  return rows.map(r => ({ id: r.id, name: r.name, full_name: r.full_name, description: r.description || '', private: r.private, archived: r.archived, html_url: r.html_url, homepage: safeUrl(r.homepage), language: r.language || '', pushed_at: r.pushed_at, default_branch: r.default_branch }));
}
export async function existingProjects(workspace) {
  try {
    const { parseProjects, validatePublication } = await import(new URL(`file://${join(workspace, 'scripts/sync-portfolio.mjs')}`));
    const inventory=await readJson(join(workspace,'portfolio-data.json'),null);
    const rows=inventory?validatePublication(inventory).projects.map(p=>({name:p.name,description:p.description,href:p.url,imagePath:p.imagePath||'',tech:p.platform})):parseProjects(await readFile(join(workspace, 'README.md'), 'utf8'));
    const aliases = ['xiaohuayu', 'inspire', 'sticker-web', 'tale-loop', 'xiaoshiye'];
    // Match by destination, never by the position of a README table cell.
    const domains = ['xiaohuayu.', 'inspire.', 'sticker.', 'taleloop.', 'xiaoshiye.'];
    return Object.fromEntries(rows.flatMap(r => {
      const index = domains.findIndex(domain => new URL(r.href).hostname.startsWith(domain));
      const alias=index<0&&inventory&&r.imagePath?basename(r.imagePath,extname(r.imagePath)):aliases[index];
      return !alias ? [] : [[alias, { name: r.name.replace(/^[\p{Extended_Pictographic}\uFE0F]+\s+/u, ''), description: r.description, url: r.href, image: r.imagePath.slice('assets/'.length), platform: r.tech }]];
    }));
  } catch { return {}; }
}
export function defaultConfig(repos, existing) {
  return { version: 1, profile: { name: 'Will Lee', headline: '把想法，做成小产品。', bio: '从一个具体的问题开始，做成可以使用的东西。', github: `https://github.com/${repos[0]?.full_name.split('/')[0] || ''}` }, projects: repos.filter(r => existing[r.name]).map(r => ({ repo: r.full_name, ...existing[r.name] })) };
}
export function validateConfig(input, repos) {
  if (!input || !input.profile || !Array.isArray(input.projects)) throw new Error('配置格式不正确。');
  const text = (value, max) => typeof value === 'string' && value.length <= max ? value.trim() : (() => { throw new Error('配置文本过长或格式不正确。'); })();
  const profile = { name: text(input.profile.name, 80), headline: text(input.profile.headline, 180), bio: text(input.profile.bio, 600), github: safeUrl(input.profile.github) };
  if (!profile.name) throw new Error('请填写展示名称。');
  if (input.projects.length > repos.length) throw new Error('项目数量不正确。');
  const seen = new Set();
  const projects = input.projects.map(p => {
    if (!repos.some(r => r.full_name === p.repo) || seen.has(p.repo)) throw new Error('项目不存在或重复。'); seen.add(p.repo);
    if (p.url && !safeUrl(p.url)) throw new Error('项目入口需要使用 http 或 https 地址。');
    return { repo: p.repo, name: text(p.name || '', 100), description: text(p.description || '', 600), url: safeUrl(p.url), platform: text(p.platform || '', 100) };
  });
  return { version: 1, profile, projects };
}
export function summarizeReadme(markdown, repo) {
  const clean = s => s.replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/<[^>]*>/g, '').replace(/[*_`]/g, '').trim();
  const title = markdown.match(/^#\s+(.+)$/m)?.[1];
  const introduction = markdown.split(/^##\s/m)[0].split(/\n\s*\n/).map(clean).find(s => s && !/^(#|>|\[|https?:|当前|版本|安装|使用|仓库)/.test(s));
  return { name: clean(title || repo.name).slice(0, 100), description: (repo.description || introduction || '项目介绍待补充，可在配置页编辑。').replace(/\s+/g, ' ').slice(0, 280) };
}
export function renderSite(config, projects) {
  const e = escapeHtml; const p = config.profile;
  const categoryNames = { web: 'Web', wechat: '微信小程序', desktop: 'macOS', other: '其他作品' };
  const categorize = r => {
    const label = `${r.platform || ''} ${r.description || ''}`;
    const types = [];
    if (/\bweb\b/i.test(r.platform || '')) types.push('web');
    if (/微信|小程序/.test(r.platform || '')) types.push('wechat');
    if (/macOS|mac OS/i.test(label)) types.push('desktop');
    return types.length ? types : ['other'];
  };
  const image = (r, i) => r.image
    ? `<img src="assets/${e(r.image)}" alt="${e(r.name)}${r.imageSource?' · '+e(r.imageSource):''}" width="1600" height="900" ${i === 0 ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`
    : `<div class="type-cover"><span class="cover-overline">${e(r.platform || (/macOS/i.test(r.description) ? 'macOS' : r.language) || 'INDEPENDENT PRODUCT')}</span><strong>${e(r.name)}</strong><span class="cover-line"></span><span class="cover-caption">${e(r.description)}</span></div>`;
  const cards = projects.map((r, i) => {
    const url = safeUrl(r.url); const categories = categorize(r);
    const media = `<div class="visual tone-${i % 5}">${image(r, i)}</div>`;
    const link = url ? `<a class="project-image-link" href="${e(url)}" target="_blank" rel="noopener" aria-label="打开 ${e(r.name)}">${media}</a>` : media;
    return `<article class="project ${i === 0 ? 'project-featured' : ''}" id="project-${i}" data-categories="${categories.join(' ')}" data-search="${e(`${r.name} ${r.description} ${r.platform || ''}`.toLowerCase())}">${link}<div class="project-body">${i === 0 ? '<span class="featured-label">从这个作品开始</span>' : ''}<div class="project-top"><span class="platform">${e(r.platform || (categories.includes('desktop') ? 'macOS' : r.language) || '独立产品')}</span></div><h${i === 0 ? '2' : '3'}>${url ? `<a href="${e(url)}" target="_blank" rel="noopener">${e(r.name)}</a>` : e(r.name)}</h${i === 0 ? '2' : '3'}><p>${e(r.description)}</p><div class="card-foot">${url ? (i === 0 ? `<a class="pill-link" href="${e(url)}" target="_blank" rel="noopener">探索这个项目 <span>↗</span></a>` : `<a class="arrow-link" href="${e(url)}" target="_blank" rel="noopener" aria-label="打开 ${e(r.name)}">↗</a>`) : '<span class="no-link">项目介绍</span>'}${!r.private && safeUrl(r.html_url) ? `<a class="source" href="${e(safeUrl(r.html_url))}" target="_blank" rel="noopener">查看源码 ↗</a>` : ''}</div></div></article>`;
  });
  const filters = Object.entries(categoryNames).filter(([key]) => projects.some(r => categorize(r).includes(key))).map(([key, label]) => `<button class="filter" type="button" data-filter="${key}" aria-pressed="false">${label}</button>`).join('');
  const initials = p.name.trim().split(/\s+/).map(s => s[0]).slice(0, 2).join('');
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="${e(p.bio)}"><title>${e(p.name)} · 小产品集</title><link rel="icon" type="image/svg+xml" sizes="any" href="favicon.svg"><link rel="stylesheet" href="site.css"><script src="site.js" defer></script></head><body><div class="site"><header class="site-header"><a class="brand" href="#" aria-label="${e(p.name)} 首页"><span class="brand-mark">${e(initials)}</span><span class="brand-name">${e(p.name)}<small>独立创造者的小产品集</small></span></a><nav aria-label="站点导航"><a href="#projects">探索作品</a><a href="#about">关于我</a>${safeUrl(p.github) ? `<a class="github-link" href="${e(safeUrl(p.github))}" target="_blank" rel="noopener">GitHub <span>↗</span></a>` : ''}</nav></header><main><section class="intro"><h1>${e(p.headline)}</h1><p>${e(p.bio)}</p></section><section id="projects" aria-label="项目画廊"><div class="gallery-tools"><div class="filters" role="group" aria-label="按平台筛选作品"><button class="filter active" type="button" data-filter="all" aria-pressed="true">全部作品 <span>${projects.length}</span></button>${filters}</div><label class="project-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg><input id="project-search" type="search" placeholder="找一个项目" aria-label="搜索作品"></label></div><div class="gallery">${cards[0] || ''}<div class="collection-heading"><h2>更多小产品，更多可能</h2><span id="visible-count" aria-live="polite">${projects.length} 个作品</span></div><div class="projects">${cards.slice(1).join('')}</div><p id="empty-state" hidden>没有找到符合条件的作品，试试其他关键词或平台。</p></div></section><section class="about" id="about"><div><span class="about-label">关于 ${e(p.name)}</span><h2>做有趣的小产品，<br>让想法走进日常。</h2><p>${e(p.bio)}</p>${safeUrl(p.github) ? `<a class="pill-link dark" href="${e(safeUrl(p.github))}" target="_blank" rel="noopener">在 GitHub 找到我 <span>↗</span></a>` : ''}</div><div class="about-note"><span class="note-mark">✳</span><strong>保持好奇。<br>持续创造。</strong><small>${e(p.name)} / SMALL PRODUCTS</small></div></section></main><footer><span>© ${new Date().getFullYear()} ${e(p.name)}${projects.some(r=>r.imageSource)?' · 项目封面为 AI 主题配图':''}</span><a href="#">回到顶部 ↑</a></footer></div></body></html>`;
}
export async function generate(config, repos, existing, workspace, stateDir, onProgress = () => {}, fetcher = github) {
  if (!config.projects.length) throw new Error('请先勾选至少一个项目。');
  const cache = await readJson(join(stateDir, 'content.json'), {}); const nextCache = { ...cache }; const projects = [];
  for (const [i, selected] of config.projects.entries()) {
    const repo = repos.find(r => r.full_name === selected.repo); if (!repo) throw new Error('仓库列表已变化，请重新保存配置。');
    onProgress(`正在读取 ${repo.name} · ${i + 1}/${config.projects.length}`);
    let content = cache[repo.full_name];
    if (!content || content.pushed_at !== repo.pushed_at) {
      try {
        const readme = await fetcher(`repos/${repo.full_name}/readme`);
        content = { ...summarizeReadme(Buffer.from(readme.content, 'base64').toString('utf8'), repo), sha: readme.sha, pushed_at: repo.pushed_at, method: 'README' };
      } catch (err) {
        if (err.status !== 404) throw err;
        content = { ...summarizeReadme('', repo), pushed_at: repo.pushed_at, method: '仓库资料（README 不可用）' };
      }
      nextCache[repo.full_name] = content;
    }
    const privateRepoLink = repo.private && safeUrl(selected.url).startsWith(repo.html_url);
    projects.push({ ...repo, ...content, ...selected, name: selected.name || content.name, description: selected.description || content.description, url: privateRepoLink ? '' : selected.url || repo.homepage || '', image: existing[repo.name]?.image || '' });
  }
  const siteDir = join(stateDir, 'site'); await mkdir(join(siteDir, 'assets'), { recursive: true });
  for (const project of projects) if (project.image) { await mkdir(join(siteDir, 'assets', project.image, '..'), { recursive: true }); await copyFile(join(workspace, 'assets', project.image), join(siteDir, 'assets', project.image)); }
  await Promise.all(['site.css', 'site.js', 'favicon.svg'].map(file => copyFile(new URL(`../assets/${file}`, import.meta.url), join(siteDir, file))));
  await saveJson(join(stateDir, 'content.json'), nextCache);
  const tmp = join(siteDir, 'index.tmp'); await writeFile(tmp, renderSite(config, projects)); await rename(tmp, join(siteDir, 'index.html'));
  return { generatedAt: new Date().toISOString(), count: projects.length, projects: projects.map(r => ({ repo: r.full_name, name: r.name, sha: r.sha || null, pushed_at: r.pushed_at, method: r.method })), previewUrl: '/preview/' };
}
