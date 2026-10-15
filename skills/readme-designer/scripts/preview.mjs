import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname, join, extname, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const exec = promisify(execFile);
const option = name => { const i = process.argv.indexOf(name); return i < 0 ? undefined : process.argv[i + 1]; };
if (!option('--readme')) throw new Error('请用 --readme 指定 README 的绝对路径。');
const readme = resolve(option('--readme')); const root = dirname(readme);
const port = Number(option('--port') || 4319);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('端口不正确。');
const cacheDir = join(root, '.preview'); await mkdir(cacheDir, { recursive: true });
const markdown = await readFile(readme, 'utf8');
let rendered;
if (process.argv.includes('--offline')) rendered = await readFile(join(cacheDir, 'body.html'), 'utf8');
else if (process.argv.includes('--github-render')) {
  const requestFile = join(cacheDir, 'request.json');
  await writeFile(requestFile, JSON.stringify({ text: markdown, mode: 'gfm' }));
  try { rendered = (await exec('gh', ['api', 'markdown', '--method', 'POST', '-H', 'Accept: text/html', '--input', requestFile], { timeout: 60000, maxBuffer: 4 * 1024 * 1024 })).stdout; }
  catch { throw new Error('GitHub Markdown 渲染失败，请检查网络和 gh 登录；已有预览保留。'); }
  await writeFile(join(cacheDir, 'body.html'), rendered);
} else {
  const modulePath = option('--marked-module');
  let marked;
  try { ({ marked } = await import(modulePath ? pathToFileURL(resolve(modulePath)).href : 'marked')); }
  catch { throw new Error('本地渲染需要 marked。优先使用宿主提供的包，传入 --marked-module <模块文件>；不要为预览上传私有内容。'); }
  const headings = new Map();
  marked.use({ renderer: { heading({ tokens, text, depth }) {
    const base = text.replace(/<[^>]*>/g, '').toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').trim().replace(/\s/g, '-');
    const count = headings.get(base) || 0; headings.set(base, count + 1);
    const slug = count ? `${base}-${count}` : base;
    return `<h${depth} id="${slug}">${this.parser.parseInline(tokens)}</h${depth}>\n`;
  } } });
  rendered = marked.parse(markdown, { gfm: true });
  await writeFile(join(cacheDir, 'body.html'), rendered);
}
const e = value => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const name = markdown.match(/^#\s+(.+)$/m)?.[1] || 'README';
const renderLabel = process.argv.includes('--github-render') ? 'GitHub Markdown API' : '本地 GFM 渲染';
const html = `<!doctype html><html lang="zh-CN" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(name)} · 图文 README 实验</title><link rel="stylesheet" href="/_preview.css"><script src="/_preview.js" defer></script></head><body><header class="toolbar"><div><strong>${e(name)} / README</strong><span>${renderLabel} · 本地实验预览</span></div><nav><a href="/${e(readme.split(sep).at(-1))}" download>下载 Markdown ↓</a><button id="theme" type="button" aria-pressed="false">切换深色</button></nav></header><div class="document"><div class="file-header"><span>README.md</span><span>Preview</span></div><article class="markdown-body">${rendered}</article></div><footer>正文使用 GFM 排版；本地页面模拟 GitHub 阅读环境，最终仓库页面仍需单独验收。</footer></body></html>`;
await writeFile(join(cacheDir, 'index.html'), html);
const resources = resolve(dirname(fileURLToPath(import.meta.url)), '../references');
const server = createServer(async (req, res) => {
  if (![`127.0.0.1:${port}`, `localhost:${port}`].includes(req.headers.host)) { res.writeHead(403); res.end(); return; }
  if (req.method !== 'GET') { res.writeHead(405); res.end(); return; }
  try {
    const path = decodeURIComponent(new URL(req.url, `http://127.0.0.1:${port}`).pathname);
    let target;
    if (path === '/') target = join(cacheDir, 'index.html');
    else if (path === '/_preview.css') target = join(resources, 'preview.css');
    else if (path === '/_preview.js') target = join(resources, 'preview.js');
    else {
      target = resolve(root, path.slice(1));
      if (!target.startsWith(root + sep) || path.startsWith('/.')) { res.writeHead(403); res.end(); return; }
    }
    const type = { '.html': 'text/html; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' }[extname(target)] || 'application/octet-stream';
    const content = await readFile(target);
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'self'; img-src 'self' https:; style-src 'self'; script-src 'self'; base-uri 'none'; frame-ancestors 'none'" }); res.end(content);
  } catch { res.writeHead(404); res.end('文件不存在。'); }
});
server.on('error', error => { console.error(error.message); process.exit(1); });
server.listen(port, '127.0.0.1', () => console.log(`README 预览: http://127.0.0.1:${port}\nMarkdown: ${readme}`));
