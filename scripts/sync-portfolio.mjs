import { copyFile, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readmePath = join(repositoryRoot, 'README.md');
const portfolioPath = join(repositoryRoot, 'portfolio', 'index.html');
const checkOnly = process.argv.includes('--check');

function decodeText(value) {
  return value.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}

function escapeHtml(value) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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

export function renderProjects(projects) {
  const useWideEnding = projects.length === 5;
  return projects.map((project, index) => {
    const wideClass = useWideEnding && index >= projects.length - 2 ? ' project-card--wide' : '';
    const number = String(index + 1).padStart(2, '0');
    return `          <a class="project-card${wideClass}" href="${escapeHtml(project.href)}" target="_blank" rel="noopener">
            <figure class="project-media">
              <img src="assets/${escapeHtml(project.imageName)}" alt="${escapeHtml(project.alt)}" loading="lazy">
              <span class="project-number">${number}</span>
            </figure>
            <div class="project-copy">
              <h3>${escapeHtml(project.name)}</h3>
              <p>${escapeHtml(project.description)}</p>
              <span>${escapeHtml(project.tech)}</span>
            </div>
          </a>`;
  }).join('\n\n');
}

function replaceGeneratedProjects(portfolio, rendered) {
  const pattern = /(\s*<!-- projects:start -->)[\s\S]*?(<!-- projects:end -->)/;
  if (!pattern.test(portfolio)) throw new Error('portfolio/index.html 中没有找到项目生成标记。');
  return portfolio.replace(pattern, `\n          <!-- projects:start -->\n${rendered}\n          <!-- projects:end -->`);
}

export async function sync() {
  const [markdown, portfolio] = await Promise.all([readFile(readmePath, 'utf8'), readFile(portfolioPath, 'utf8')]);
  const projects = parseProjects(markdown);
  const nextPortfolio = replaceGeneratedProjects(portfolio, renderProjects(projects));
  const changed = nextPortfolio !== portfolio;

  if (checkOnly) {
    if (changed) throw new Error('Portfolio 与 README.md 不一致，请运行 corepack pnpm sync:portfolio。');
    console.log(`Portfolio 已与 README.md 同步（${projects.length} 个项目）。`);
    return;
  }

  if (changed) await writeFile(portfolioPath, nextPortfolio, 'utf8');
  await Promise.all(projects.map((project) => copyFile(
    join(repositoryRoot, project.imagePath),
    join(repositoryRoot, 'portfolio', 'assets', project.imageName),
  )));
  console.log(`已从 README.md 同步 ${projects.length} 个项目到 Portfolio。`);
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  await sync();
}
