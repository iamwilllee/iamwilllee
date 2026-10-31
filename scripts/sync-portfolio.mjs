import { mkdir, readFile, writeFile, realpath } from 'node:fs/promises';
import { renderSite, safeUrl } from '../skills/portfolio-builder/scripts/core.mjs';
import { basename, dirname, join, resolve, sep } from 'node:path';
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

    // Keep an explicitly selected website cover separate from the Profile image.
    const siteImagePath = cell.match(/<img\b[^>]*\bdata-site-cover="([^"]+)"/i)?.[1];
    if (siteImagePath && (!siteImagePath.startsWith('assets/') || siteImagePath.split('/').includes('..') || siteImagePath.includes('\\'))) {
      throw new Error(`站点配图必须位于根目录 assets/：${siteImagePath}`);
    }

    return {
      ...(siteImagePath ? { siteImagePath } : {}),
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
    url: p.href, image: basename(p.siteImagePath || p.imagePath), imageSource: /AI/.test(p.alt) ? 'AI 概念配图' : undefined,
    private: true,
  }));
  return renderSite({ profile }, projects);
}

export function publicationFromReadme(markdown) {
  return {schemaVersion:1,profile:parseProfile(markdown),projects:parseProjects(markdown).map(p=>({
    name:p.name,description:p.description,platform:p.tech,url:p.href,imagePath:p.siteImagePath||p.imagePath,
    ...(/AI/.test(p.alt)?{imageSource:'AI 概念配图'}:{}),
  }))};
}

export function validatePublication(data) {
  const fields=(obj,keys)=>{if(!obj||typeof obj!=='object'||Array.isArray(obj)||Object.keys(obj).some(k=>!keys.includes(k)))throw Error('公开站点清单包含未知字段。');};
  const text=(value,max)=>{if(typeof value!=='string'||!value.trim()||value.length>max)throw Error('公开站点清单文本不完整或过长。');return value;};
  fields(data,['schemaVersion','profile','projects']);
  if(data.schemaVersion!==1||!Array.isArray(data.projects)||!data.projects.length||data.projects.length>1000)throw Error('公开站点清单版本或项目数量不正确。');
  fields(data.profile,['name','headline','bio','github']);
  const profile={name:text(data.profile.name,80),headline:text(data.profile.headline,180),bio:text(data.profile.bio,600),github:safeUrl(data.profile.github)};
  if(!profile.github)throw Error('公开站点清单需要有效 GitHub 主页。');
  const projects=data.projects.map(p=>{
    fields(p,['name','description','platform','url','imagePath','imageSource']);
    const url=safeUrl(p.url);if(!url)throw Error('公开站点项目需要有效入口。');
    const project={name:text(p.name,100),description:text(p.description,600),platform:text(p.platform||'独立作品',100),url};
    if(p.imagePath!==undefined){
      if(typeof p.imagePath!=='string'||!/^assets\/[a-zA-Z0-9_./-]+\.(?:png|jpg|jpeg|webp|svg)$/.test(p.imagePath)||p.imagePath.split('/').some(part=>!part||part==='.'||part==='..'))throw Error('站点配图必须位于根目录 assets/。');
      project.imagePath=p.imagePath;
    }
    if(p.imageSource!==undefined)project.imageSource=text(p.imageSource,80);
    return project;
  });
  return {schemaVersion:1,profile,projects};
}

export function renderPublication(data) {
  return renderSite({profile:data.profile},data.projects.map(p=>({...p,image:p.imagePath?basename(p.imagePath):undefined,private:true})));
}

export async function sync({ workspace = repositoryRoot, check = checkOnly } = {}) {
  // The explicit public inventory is independent of the Profile's visual layout.
  // Only a missing inventory uses the legacy README migration path; invalid JSON fails.
  const raw=await readFile(join(workspace,'portfolio-data.json'),'utf8').catch(error=>{if(error.code==='ENOENT')return null;throw error;});
  const data=validatePublication(raw===null?publicationFromReadme(await readFile(join(workspace,'README.md'),'utf8')):JSON.parse(raw));
  const projects=data.projects;
  const files = new Map([['index.html', Buffer.from(renderPublication(data))]]);
  for (const file of ['site.css', 'site.js', 'favicon.svg']) files.set(file, await readFile(new URL(`../skills/portfolio-builder/assets/${file}`, import.meta.url)));
  for (const project of projects) {
    const imagePath=project.imagePath;if(!imagePath)continue;
    const source=await realpath(join(workspace,imagePath));
    if(!source.startsWith(await realpath(workspace)+sep))throw Error('站点配图链接超出项目目录。');
    const target = `assets/${basename(imagePath)}`, bytes = await readFile(source);
    if (files.has(target) && !files.get(target).equals(bytes)) throw new Error(`存在不同内容的同名配图：${project.imagePath}`);
    files.set(target, bytes);
  }
  const output = join(workspace, 'portfolio');
  for (const [file, bytes] of files) {
    const path = join(output, file);
    if (check) {
      const current = await readFile(path).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
      if (!current?.equals(bytes)) throw new Error(`Portfolio 与公开清单 / 共享模板不一致：${file}，请运行 pnpm sync:portfolio。`);
    } else {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, bytes);
    }
  }
  console.log(`${check ? 'Portfolio 已同步' : '已从公开项目资料同步到 Portfolio'}（${projects.length} 个项目）。`);
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  await sync();
}
