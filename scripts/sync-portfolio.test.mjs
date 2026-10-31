import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, writeFile, readFile, rm, cp } from 'node:fs/promises';
import { existingProjects } from '../skills/portfolio-builder/scripts/core.mjs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseProjects, parseProfile, renderPortfolio, sync, publicationFromReadme, validatePublication } from './sync-portfolio.mjs';

const table = `<table><tr><td align="center"><a href="example.com"><img src="assets/project-covers/demo.png" alt="演示项目 · AI 概念配图"></a><p><b>🧪 Demo</b> · 一段描述</p><p>Web · Local</p></td></tr></table>`;
const fixture = `# Maker\n\n**把想法做成产品。**\n\n从日常的问题出发。\n\n[个人站点](https://example.com) · [GitHub](https://github.com/owner)\n\n## 我的作品\n\n${table}`;

test('从 README 表格解析并规范化项目数据，保留嵌套配图路径', () => {
  assert.deepEqual(parseProjects(fixture), [{
    href: 'https://example.com', imagePath: 'assets/project-covers/demo.png', imageName: 'demo.png', alt: '演示项目 · AI 概念配图',
    name: '🧪 Demo', description: '一段描述', tech: 'Web · Local',
  }]);
});

test('正式站点复用作品集模板，并从 README 读取个人介绍和项目资料', () => {
  assert.deepEqual(parseProfile(fixture), {name:'Maker',headline:'把想法做成产品。',bio:'从日常的问题出发。',github:'https://github.com/owner'});
  const html = renderPortfolio(fixture);
  assert.match(html, /<title>Maker · 小产品集<\/title>/);
  assert.match(html, /href="https:\/\/example\.com\/"/);
  assert.match(html, /alt="🧪 Demo · AI 概念配图"/);
  assert.match(html, /width="1600" height="900"/);
  assert.match(html, /data-filter="web"/);
});

test('发布检查验证 HTML、共享样式与配图字节，阻止旧图或旧样式被发布', async () => {
  const root=await mkdtemp(join(tmpdir(),'portfolio-publication-'));
  try {
    await mkdir(join(root,'assets/project-covers'),{recursive:true});
    await writeFile(join(root,'README.md'),fixture);
    await writeFile(join(root,'assets/project-covers/demo.png'),'image-content');
    await sync({workspace:root});
    await sync({workspace:root,check:true});
    assert.match(await readFile(join(root,'portfolio/index.html'),'utf8'), /<link rel="icon"[^>]+href="favicon\.svg"/);
    assert.deepEqual(await readFile(join(root,'portfolio/favicon.svg')),await readFile(new URL('../skills/portfolio-builder/assets/favicon.svg',import.meta.url)));
    await rm(join(root,'portfolio/favicon.svg'));
    await assert.rejects(sync({workspace:root,check:true}),/favicon.svg/);
    await sync({workspace:root});
    await writeFile(join(root,'portfolio/favicon.svg'),'outdated-icon');
    await assert.rejects(sync({workspace:root,check:true}),/favicon.svg/);
    await sync({workspace:root});
    await writeFile(join(root,'portfolio/assets/demo.png'),'old-image');
    await assert.rejects(sync({workspace:root,check:true}),/demo.png/);
    await sync({workspace:root});
    await writeFile(join(root,'portfolio/site.css'),'old-css');
    await assert.rejects(sync({workspace:root,check:true}),/site.css/);
    await sync({workspace:root});
    await writeFile(join(root,'README.md'),fixture.replace('一段描述','更新后的描述'));
    await assert.rejects(sync({workspace:root,check:true}),/index.html/);
    await sync({workspace:root});
    assert.match(await readFile(join(root,'portfolio/index.html'),'utf8'),/更新后的描述/);
  } finally {await rm(root,{recursive:true,force:true});}
});


test('显式站点封面独立发布，Profile 原图不被替换，缺图或旧图阻止发布', async () => {
  const root=await mkdtemp(join(tmpdir(),'portfolio-cover-selection-'));
  try {
    const markdown=fixture.replace('<img src=', '<img data-site-cover="assets/project-covers/site.png" src=');
    assert.equal(parseProjects(markdown)[0].imagePath,'assets/project-covers/demo.png');
    assert.equal(parseProjects(markdown)[0].siteImagePath,'assets/project-covers/site.png');
    assert.match(renderPortfolio(markdown),/src="assets\/site\.png"/);
    assert.throws(()=>parseProjects(markdown.replace('assets/project-covers/site.png','assets/../private.png')),/站点配图/);
    await mkdir(join(root,'assets/project-covers'),{recursive:true});
    await writeFile(join(root,'README.md'),markdown);
    await writeFile(join(root,'assets/project-covers/demo.png'),'profile-image');
    await assert.rejects(sync({workspace:root}),/site.png/);
    await writeFile(join(root,'assets/project-covers/site.png'),'site-image');
    await sync({workspace:root});
    assert.equal(await readFile(join(root,'portfolio/assets/site.png'),'utf8'),'site-image');
    assert.equal(await readFile(join(root,'assets/project-covers/demo.png'),'utf8'),'profile-image');
    await writeFile(join(root,'portfolio/assets/site.png'),'profile-image');
    await assert.rejects(sync({workspace:root,check:true}),/site.png/);
  } finally {await rm(root,{recursive:true,force:true});}
});


test('public inventory keeps the complete website independent of compact Profile layout and rejects invalid inventories', async()=>{
 const root=await mkdtemp(join(tmpdir(),'portfolio-inventory-'));
 try{
  const data=publicationFromReadme(fixture);
  data.projects=Array.from({length:12},(_,i)=>({...data.projects[0],name:`Project ${i}`,url:`https://example.com/${i}`}));
  await mkdir(join(root,'assets/project-covers'),{recursive:true});
  await writeFile(join(root,'assets/project-covers/demo.png'),'image-content');
  await writeFile(join(root,'portfolio-data.json'),JSON.stringify(data));
  await mkdir(join(root,'scripts'),{recursive:true});
  await mkdir(join(root,'skills/portfolio-builder/scripts'),{recursive:true});
  await cp(new URL('./sync-portfolio.mjs',import.meta.url),join(root,'scripts/sync-portfolio.mjs'));
  await cp(new URL('../skills/portfolio-builder/scripts/core.mjs',import.meta.url),join(root,'skills/portfolio-builder/scripts/core.mjs'));
  await writeFile(join(root,'README.md'),'# Compact Profile\n\nOnly four featured projects. No legacy table.');
  await sync({workspace:root});await sync({workspace:root,check:true});
  assert.equal((await existingProjects(root)).demo.description,'一段描述');
  const html=await readFile(join(root,'portfolio/index.html'),'utf8');
  assert.equal((html.match(/<article class="project /g)||[]).length,12);
  await writeFile(join(root,'README.md'),'# A completely different Profile');
  await sync({workspace:root,check:true});
  assert.equal(await readFile(join(root,'portfolio/index.html'),'utf8'),html);
  assert.throws(()=>validatePublication({...data,requests:[]}),/未知字段/);
  assert.throws(()=>validatePublication({...data,projects:[{...data.projects[0],imagePath:'assets/../secret.png'}]}),/配图/);
  await writeFile(join(root,'portfolio-data.json'),'{broken');
  await assert.rejects(sync({workspace:root}),SyntaxError);
  assert.equal(await readFile(join(root,'portfolio/index.html'),'utf8'),html);
 }finally{await rm(root,{recursive:true,force:true});}
});
