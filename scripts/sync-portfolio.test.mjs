import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseProjects, parseProfile, renderPortfolio, sync } from './sync-portfolio.mjs';

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
