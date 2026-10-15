import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { renderSite, safeUrl } from '../skills/portfolio-builder/scripts/core.mjs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const checkOnly = process.argv.includes('--check');

function decodeText(value) {
  return value.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}

function normalizeUrl(value) {
  if (/^(https?:|mailto:)/i.test(value)) return value;
  return `https://${value.replace(/^\/+/, '')}`;
}

export function parseProjects(markdown) {
  const table = markdown.match(/<table>([\s\S]*?)<\/table>/i)?.[1];
  if (!table) throw new Error('README.md 中没有找到项目 <table>。');

  const cells = [...table.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)];
  const projects = cells.map((match, index) => {
    const cell = match[1];
    const href = cell.match(/<a\b[^>]*href="([^"]+)"/i)?.[1];
    const image = cell.match(/<img\b[^>]*src="([^"]+)"[^>]*alt="([^"]*)"/i);
    const paragraphs = [...cell.matchAll(/<p>([\s\S]*?)<\/p>/gi)].map((item) => item[1]);
    const headline = paragraphs[0]?.match(/<b>([\s\S]*?)<\/b>\s*·\s*([\s\S]*)/i);

    if (!href || !image || !headline || !paragraphs[1]) {
      throw new Error(`README.md 的第 ${index + 1} 张项目卡片结构不完整。`);
    }
    if (!image[1].startsWith('assets/')) {
      throw new Error(`项目图片必须位于根目录 assets/：${image[1]}`);
    }

    return {
      href: normalizeUrl(href),
      imagePath: image[1],
      imageName: basename(image[1]),
      alt: decodeText(image[2]),
      name: decodeText(headline[1]),
      description: decodeText(headline[2]),
      tech: decodeText(paragraphs[1]),
    };
  });

  if (projects.length === 0) throw new Error('README.md 中没有找到项目卡片。');
  return projects;
}

export function parseProfile(markdown) {
  const introduction = markdown.split(/^## 我的作品/m)[0];
  const name = introduction.match(/^#\s+(.+)$/m)?.[1]?.trim();
  const headline = introduction.match(/^\*\*(.+)\*\*$/m)?.[1]?.trim();
  const bio = introduction.split(/\n\s*\n/).map(p => p.trim()).find(p => p && !/^(?:#|\*\*|\[|<)/.test(p));
  const github = safeUrl(introduction.match(/\[GitHub\]\(([^)]+)\)/)?.[1]);
  if (!name || !headline || !bio || !github) throw new Error('README 需要姓名、加粗标题、个人介绍和 GitHub 链接。');
  return { name, headline, bio, github };
}

export function renderPortfolio(markdown) {
  const profile = parseProfile(markdown);
  const projects = parseProjects(markdown).map(p => ({
    name: p.name, description: p.description, platform: p.tech,
    url: p.href, image: p.imageName, imageSource: /AI/.test(p.alt) ? 'AI 概念配图' : undefined,
    private: true,
  }));
  return renderSite({ profile }, projects);
}

export async function sync({ workspace = repositoryRoot, check = checkOnly } = {}) {
  const markdown = await readFile(join(workspace, 'README.md'), 'utf8');
  const projects = parseProjects(markdown);
  const files = new Map([['index.html', Buffer.from(renderPortfolio(markdown))]]);
  for (const file of ['site.css', 'site.js']) files.set(file, await readFile(new URL(`../skills/portfolio-builder/assets/${file}`, import.meta.url)));
  for (const project of projects) {
    const target = `assets/${project.imageName}`, bytes = await readFile(join(workspace, project.imagePath));
    if (files.has(target) && !files.get(target).equals(bytes)) throw new Error(`存在不同内容的同名配图：${project.imageName}`);
    files.set(target, bytes);
  }
  const output = join(workspace, 'portfolio');
  for (const [file, bytes] of files) {
    const path = join(output, file);
    if (check) {
      const current = await readFile(path).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
      if (!current?.equals(bytes)) throw new Error(`Portfolio 与 README / 共享模板不一致：${file}，请运行 pnpm sync:portfolio。`);
    } else {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, bytes);
    }
  }
  console.log(`${check ? 'Portfolio 已同步' : '已从 README.md 同步到 Portfolio'}（${projects.length} 个项目）。`);
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  await sync();
}
