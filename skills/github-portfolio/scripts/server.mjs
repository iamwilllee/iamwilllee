import { createServer } from 'node:http';
import { readFile, stat, access } from 'node:fs/promises';
import { resolve, dirname, extname, sep, join } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { initialize, readState, act, refreshInventory, clientState, stateRoot, safeFile } from './workbench.mjs';
import { fetchRepositories, escapeHtml as e } from '../../portfolio-builder/scripts/core.mjs';

const option=name=>{const i=process.argv.indexOf(name);return i<0?undefined:process.argv[i+1];};
if(!option('--workspace'))throw Error('请用 --workspace 指定当前项目的实际目录。');
const workspace=resolve(option('--workspace')),root=stateRoot(workspace),port=Number(option('--port')||4318);
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('端口不正确。');
const assets=resolve(dirname(fileURLToPath(import.meta.url)),'../assets');
const markdownAssets=resolve(dirname(fileURLToPath(import.meta.url)),'../../readme-designer/references');
let Marked;
const modulePath=option('--marked-module')||process.env.README_MARKED_MODULE;
try{({Marked}=await import(modulePath?pathToFileURL(resolve(modulePath)).href:'marked'));}
catch{
 const bundled=join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/marked/lib/marked.esm.js');
 try{({Marked}=await import(pathToFileURL(bundled).href));}catch{throw Error('本地预览需要宿主已有的 marked；用 --marked-module 指定模块文件。');}
}
let state=await initialize(workspace);
for(const target of ['profile','site'])if(!state.results[target])try{state=await act(workspace,{type:`generate-${target}`,revision:state.revision});}catch(error){console.log(`${target} 尚未生成：${error.message}`);}
let refreshing=false;
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.md':'text/plain; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.webp':'image/webp'};
const csp="default-src 'self'; img-src 'self' https:; style-src 'self'; script-src 'self'; frame-src 'self'; frame-ancestors 'self'; base-uri 'none'; form-action 'self'";
function send(res,status,value,type='application/json; charset=utf-8'){
 res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':csp});res.end(type.startsWith('application/json')?JSON.stringify(value):value);
}
async function body(req){
 if(!req.headers['content-type']?.startsWith('application/json'))throw Error('请求需要 JSON。');
 let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>50000)throw Error('请求过大。');}return JSON.parse(raw||'{}');
}
async function file(res,base,relative){
 const path=await safeFile(base,relative);
 if(!(await stat(path)).isFile())throw Error('文件不存在。');
 const type=types[extname(path)];if(!type)throw Error('文件类型不提供预览。');send(res,200,await readFile(path),type);
}
async function markdownPage(markdown,base,project){
 const headings=new Map();
 const parser=new Marked({gfm:true,renderer:{heading({tokens,text,depth}){const slug=text.replace(/<[^>]*>/g,'').toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu,'').trim().replace(/\s/g,'-');const n=headings.get(slug)||0;headings.set(slug,n+1);return `<h${depth} id="${slug}${n?'-'+n:''}">${this.parser.parseInline(tokens)}</h${depth}>\n`;}}});
 let html=parser.parse(markdown);
 const replacements=new Map();
 for(const match of html.matchAll(/\b(src|href)="(?!https?:|#|mailto:|data:)([^"<>]+)"/g)){
  const [full,key,path]=match,decoded=path.replaceAll('&amp;','&');
  const [pathname,hash]=decoded.split('#');const mapped=resolve(base,pathname);
  if(!mapped.startsWith(root+sep)){replacements.set(full,`${key}="#"`);continue;}
  const exists=await access(mapped).then(()=>true,()=>false);
  const local=`/workbench-files/${mapped.slice(root.length+1).split(sep).map(encodeURIComponent).join('/')}${hash?'#'+encodeURIComponent(hash):''}`;
  const fallback=project?`https://github.com/${project.repo}/blob/${project.sourceSha||project.repository.default_branch}/${pathname}`:'#';
  replacements.set(full,`${key}="${e(exists?local:fallback)}"`);
 }
 for(const[from,to]of replacements)html=html.replaceAll(from,to);
 return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>README 本地预览</title><link rel="stylesheet" href="/readme.css"><link rel="stylesheet" href="/frame.css"><script src="/frame.js" defer></script></head><body><article class="markdown-body">${html}</article></body></html>`;
}
const server=createServer(async(req,res)=>{
 try{
  const origins=[`http://127.0.0.1:${port}`,`http://localhost:${port}`];
  if(![`127.0.0.1:${port}`,`localhost:${port}`].includes(req.headers.host))return send(res,403,{error:'只接受本机访问。'});
  const url=new URL(req.url,origins[0]),path=decodeURIComponent(url.pathname);
  if(req.method!=='GET'){
   if(req.method!=='POST')return send(res,405,{error:'不支持此请求。'});
   if(req.headers.origin&&!origins.includes(req.headers.origin))return send(res,403,{error:'请求来源不正确。'});
  }
  if(path==='/api/workbench/state'&&req.method==='GET')return send(res,200,{...clientState(await readState(workspace)),refreshing});
  if(path==='/api/workbench/action'&&req.method==='POST')return send(res,200,clientState(await act(workspace,await body(req))));
  if(path==='/api/workbench/refresh'&&req.method==='POST'){
   await body(req);if(refreshing)return send(res,409,{error:'正在刷新仓库。'});refreshing=true;
   try{return send(res,200,clientState(await refreshInventory(workspace,await fetchRepositories())));}finally{refreshing=false;}
  }
  if(req.method!=='GET')return send(res,404,{error:'接口不存在。'});
  if(path==='/workbench/preview/project'){
   const state=await readState(workspace),p=state.projects.find(p=>p.repo===url.searchParams.get('repo'));if(!p)throw Error('项目不存在。');
   const view=url.searchParams.get('view'),relative=view==='evidence'?'docs/readme/provenance.md':view==='original'?(p.repository.name==='runo'?'docs/project-guide.md':'docs/readme/original.md'):'README.md';
   const base=resolve(root,p.draft.root);let markdown;
   try{markdown=await readFile(await safeFile(base,relative),'utf8');}catch{markdown='# 暂无内容\n\n本项目没有这份历史说明。';}
   return send(res,200,await markdownPage(markdown,resolve(base,dirname(relative)),p),'text/html; charset=utf-8');
  }
  if(path==='/workbench/preview/profile')return send(res,200,await markdownPage(await readFile(join(root,'profile/README.md'),'utf8'),join(root,'profile')),'text/html; charset=utf-8');
  if(path.startsWith('/preview/'))return await file(res,join(root,'site'),path.slice('/preview/'.length)||'index.html');
  if(path==='/readme.css')return await file(res,markdownAssets,'preview.css');
  if(path.startsWith('/workbench-files/')){
   const relative=path.slice('/workbench-files/'.length);
   if(!/^(?:projects\/[\w-]+\/(?:draft|versions\/[\w-]+|approved\/[\w-]+)\/|profile\/)/.test(relative)||relative.split('/').some(part=>part.startsWith('.')))throw Error('此文件不提供预览。');
   return await file(res,root,relative);
  }
  if(path.startsWith('/api/'))return send(res,404,{error:'接口不存在。'});
  return await file(res,assets,path==='/'?'index.html':path.slice(1));
 }catch(error){return send(res,error.code==='ENOENT'?404:400,{error:error.message});}
});
server.on('error',error=>{console.error(error.message);process.exit(1);});
server.listen(port,'127.0.0.1',()=>console.log(`作品集工作台：http://127.0.0.1:${port}/\nWorkspace: ${workspace}`));
