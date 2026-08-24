import assert from 'node:assert/strict';
import test from 'node:test';
import { parseProjects, renderProjects } from './sync-portfolio.mjs';

const fixture = `<table><tr><td align="center"><a href="example.com"><img src="assets/demo.png" alt="演示项目"></a><p><b>🧪 Demo</b> · 一段描述</p><p>Web · Local</p></td></tr></table>`;

test('从 README 表格解析并规范化项目数据', () => {
  assert.deepEqual(parseProjects(fixture), [{
    href: 'https://example.com', imagePath: 'assets/demo.png', imageName: 'demo.png', alt: '演示项目',
    name: '🧪 Demo', description: '一段描述', tech: 'Web · Local',
  }]);
});

test('生成可访问的项目卡片 HTML', () => {
  const html = renderProjects(parseProjects(fixture));
  assert.match(html, /href="https:\/\/example\.com"/);
  assert.match(html, /alt="演示项目"/);
  assert.match(html, /<span class="project-number">01<\/span>/);
});
