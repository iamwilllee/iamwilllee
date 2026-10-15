import { readFile, access } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
const file = resolve(process.argv[2] || 'README.md');
const text = await readFile(file, 'utf8');
const markup = text.replace(/```[\s\S]*?```/g, '').replace(/<!--[\s\S]*?-->/g, '');
const errors = [];
const tags = [...markup.matchAll(/<[^>]+>/g)].map(m => m[0]);
if (tags.some(tag => /<\/?(?:script|style|iframe)\b|\b(?:style|class|on\w+)\s*=/i.test(tag))) errors.push('README 使用了 GitHub 不支持的样式或脚本。');
const images = [...markup.matchAll(/<img\b([^>]*?)>/gi)].map(m => ({ src: m[1].match(/\bsrc=["']([^"']+)["']/i)?.[1], alt: m[1].match(/\balt=["']([^"']*)["']/i)?.[1] }));
images.push(...[...markup.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)].map(m => ({ alt: m[1], src: m[2] })));
for (const image of images) {
  if (!image.src || !image.alt?.trim()) errors.push('图片缺少 src 或有效 alt。');
  if (image.src && !/^https?:\/\//.test(image.src)) {
    try { await access(resolve(dirname(file), image.src)); } catch { errors.push(`图片不存在：${image.src}`); }
  }
}
if (!/^#\s+\S/m.test(markup)) errors.push('缺少原生 Markdown 一级标题。');
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log(`README 校验通过：${images.length} 张图片，原生标题，未使用自定义样式或脚本。`);
