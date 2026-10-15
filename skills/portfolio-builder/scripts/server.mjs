import { createServer } from 'node:http';
import { readFile, stat, mkdir } from 'node:fs/promises';
import { resolve, join, extname, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson, saveJson, fetchRepositories, existingProjects, defaultConfig, validateConfig, generate } from './core.mjs';

const option = name => { const i = process.argv.indexOf(name); return i < 0 ? undefined : process.argv[i + 1]; };
if (!option('--workspace')) throw new Error('请使用 --workspace 指定当前项目目录。');
const workspace = resolve(option('--workspace'));
const stateDir = resolve(option('--state-dir') || join(workspace, '.portfolio-builder'));
const assetsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../assets');
const port = Number(option('--port') || 4318);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('端口必须在 1024–65535 之间。');
await mkdir(stateDir, { recursive: true });
let snapshot = await readJson(join(stateDir, 'repositories.json'), { repositories: [], fetchedAt: null });
const existing = await existingProjects(workspace);
let config = await readJson(join(stateDir, 'config.json'), null);
let result = await readJson(join(stateDir, 'result.json'), null);
let job = { status: 'idle', message: '' }; let refreshing = false; let connectionError = ''; let saving = false;
async function refresh() {
  if (refreshing) throw new Error('仓库同步正在进行，请稍候。');
  refreshing = true;
  try {
    const repositories = await fetchRepositories();
    const next = { repositories, fetchedAt: new Date().toISOString() };
    await saveJson(join(stateDir, 'repositories.json'), next); snapshot = next; connectionError = '';
  } catch (error) { connectionError = error.message; throw error; } finally { refreshing = false; }
}
function currentConfig() { return config || defaultConfig(snapshot.repositories, existing); }
async function runGeneration(next) {
  job = { status: 'running', message: '准备读取所选项目…' };
  try {
    const nextResult = await generate(next, snapshot.repositories, existing, workspace, stateDir, message => { job.message = message; });
    await saveJson(join(stateDir, 'result.json'), nextResult); result = nextResult;
    job = { status: 'success', message: `已生成 ${result.count} 个项目的个人站点` };
  } catch (error) { job = { status: 'error', message: error.message }; }
}
if (process.argv.includes('--generate')) {
  await refresh();
  if (!config) throw new Error('还没有保存配置，请先打开配置页勾选项目。');
  await runGeneration(validateConfig(config, snapshot.repositories));
  console.log(job.message); if (job.status === 'error') process.exitCode = 1;
} else {
  const json = (res, status, value) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(value)); };
  async function body(req) {
    if (!req.headers['content-type']?.startsWith('application/json')) throw new Error('请求需要使用 JSON。');
    let raw = ''; for await (const chunk of req) { raw += chunk; if (raw.length > 100000) throw new Error('请求过大。'); }
    return JSON.parse(raw || '{}');
  }
  async function file(res, root, path) {
    const target = resolve(root, path);
    if (!target.startsWith(root + sep)) { res.writeHead(403); res.end(); return; }
    try {
      if (!(await stat(target)).isFile()) throw new Error('not a file');
      const type = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml' }[extname(target)] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'self'; img-src 'self'; style-src 'self'; script-src 'self'; frame-src 'self'; frame-ancestors 'self'; base-uri 'none'; form-action 'self'" });
      res.end(await readFile(target));
    } catch { res.writeHead(404); res.end('未找到文件。请先生成站点。'); }
  }
  const server = createServer(async (req, res) => {
    try {
      if (![ `127.0.0.1:${port}`, `localhost:${port}` ].includes(req.headers.host)) return json(res, 403, { error: '只接受本机访问。' });
      const path = decodeURIComponent(new URL(req.url, `http://127.0.0.1:${port}`).pathname);
      if (req.method !== 'GET') {
        if (req.headers.origin && ![`http://127.0.0.1:${port}`, `http://localhost:${port}`].includes(req.headers.origin)) return json(res, 403, { error: '请求来源不正确。' });
        if (req.method !== 'POST') return json(res, 405, { error: '不支持此请求。' });
      }
      if (path === '/api/state' && req.method === 'GET') return json(res, 200, { ...snapshot, config: currentConfig(), saved: !!config, existing, result, job, refreshing, connectionError });
      if (path === '/api/refresh' && req.method === 'POST') {
        if (job.status === 'running' || saving) return json(res, 409, { error: '正在生成或保存，请稍后同步。' });
        await body(req); await refresh(); return json(res, 200, { ...snapshot });
      }
      if (['/api/config', '/api/generate'].includes(path) && req.method === 'POST') {
        if (job.status === 'running' || saving || refreshing) return json(res, 409, { error: '正在同步、生成或保存，请完成后再修改配置。' });
        saving = true;
        try {
          const next = validateConfig(await body(req), snapshot.repositories);
          if (path === '/api/generate' && !next.projects.length) throw new Error('请先勾选至少一个项目。');
          await saveJson(join(stateDir, 'config.json'), next); config = next;
          if (path === '/api/generate') { void runGeneration(structuredClone(next)); return json(res, 202, { started: true }); }
          return json(res, 200, { saved: true });
        } finally { saving = false; }
      }
      if (path.startsWith('/api/')) return json(res, 404, { error: '接口不存在。' });
      if (req.method !== 'GET') return json(res, 405, { error: '不支持此请求。' });
      if (path.startsWith('/preview/')) return file(res, join(stateDir, 'site'), path.slice(9) || 'index.html');
      if (path.startsWith('/project-assets/')) {
        const name = path.slice(16);
        if (!Object.values(existing).some(p => p.image === name)) { res.writeHead(404); res.end(); return; }
        return file(res, join(workspace, 'assets'), name);
      }
      return file(res, assetsDir, path === '/' ? 'index.html' : path.slice(1));
    } catch (error) { json(res, 400, { error: error.message }); }
  });
  server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? `端口 ${port} 已使用，请换 --port 或复用已有服务。` : error.message); process.exit(1); });
  server.listen(port, '127.0.0.1', () => {
    console.log(`Portfolio Builder: http://127.0.0.1:${port}\nWorkspace: ${workspace}`);
    void refresh().catch(() => {});
  });
}
