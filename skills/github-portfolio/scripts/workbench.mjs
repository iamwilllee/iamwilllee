import { readFile, writeFile, mkdir, cp, copyFile, rename, rm, access, realpath } from 'node:fs/promises';
import { resolve, join, dirname, extname, sep } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { readJson, saveJson, existingProjects, safeUrl, renderSite, escapeHtml } from '../../portfolio-builder/scripts/core.mjs';

export const stateRoot = workspace => resolve(workspace, '.portfolio-workbench');
export const digest = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const exists = path => access(path).then(() => true, () => false);
const text = (value, max) => { if(typeof value !== 'string' || value.length > max) throw Error('文本格式不正确或过长。'); return value.trim(); };
const themes = { runo:'北欧工作台，保留现有品牌绿与已确认封面', fluo:'轻盈通透的蓝色玻璃与精确传输感', xiaoshiye:'温暖家庭手账、米白纸张与鼠尾草绿', xiaohuayu:'明快的儿童绘本与亲子互动故事', 'tale-loop':'岛屿故事、动画情境与轻松英语学习', vpet:'柔软的宠物陪伴与梦境', inspire:'艺术画廊、图片收藏与灵感探索', 'sticker-web':'轻快的手作切纸与贴纸工坊', 'sticker-mp':'活泼的表情创作与宫格编辑', wordjar:'阅读、词卡与个人知识收藏', 'ticket-stub-mp':'旧纸票根、展厅与回忆手账', 'social-security-roi':'清楚理性的家庭规划与情景比较', 'frontend-interview-guide':'结构清晰的技术出版物与知识图解', 'vscode-demon':'精简的编辑器工具与代码示例', 'demon-cli':'终端、目录结构与轻量技术文档', CapMind:'专注阅读、清晰摘录与智能辅助', iamwilllee:'统一的个人作品集品牌，保留各产品个性' };
const firstParagraph = md => md.split(/\n\s*\n/).map(s => s.trim()).find(s => s && !/^(?:#|<|>|!|\*\*|\[|\|)/.test(s)) || '';
const projectFor = (state, repo) => { const p=state.projects.find(p=>p.repo===repo); if(!p) throw Error('项目不存在，请刷新仓库。'); return p; };
const imagePath = md => md.match(/<img\b[^>]*src="([^"]+)"/i)?.[1] || md.match(/!\[[^\]]*\]\(([^)]+)\)/)?.[1];

export async function safeFile(root, relative) {
 const target=resolve(root,relative);
 if(!target.startsWith(resolve(root)+sep)) throw Error('文件路径超出项目目录。');
 const actual=await realpath(target);
 if(!actual.startsWith(await realpath(root)+sep)) throw Error('文件链接超出项目目录。');
 return actual;
}

export async function initialize(workspace) {
 const root=stateRoot(workspace),file=join(root,'workbench.json');
 if(await exists(file)) return readJson(file);
 await mkdir(root,{recursive:true});
 const oldSnapshot=await readJson(join(workspace,'.portfolio-builder/repositories.json'),{repositories:[],fetchedAt:null});
 const oldConfig=await readJson(join(workspace,'.portfolio-builder/config.json'),null);
 const batch=await readJson(join(workspace,'experiments/github-readmes/manifest.json'),{projects:[]});
 const existing=await existingProjects(workspace);
 const repositories=[...oldSnapshot.repositories];
 for(const entry of batch.projects) if(!repositories.some(r=>r.full_name===entry.repository)) repositories.push({id:entry.repository,name:entry.repo,full_name:entry.repository,private:entry.isPrivate,html_url:`https://github.com/${entry.repository}`,homepage:'',description:'',default_branch:entry.defaultBranch});
 const profileRepos=Object.keys(existing).flatMap(name=>repositories.filter(r=>r.name===name).map(r=>r.full_name));
 const state={schemaVersion:1,revision:0,initializedAt:new Date().toISOString(),fetchedAt:oldSnapshot.fetchedAt,profile:oldConfig?.profile||{name:'Will Lee',headline:'把想法，做成小产品。',bio:'从一个具体的问题开始，做成可以使用的东西。',github:'https://github.com/iamwilllee'},profileRepos,siteRepos:oldConfig?.projects.map(p=>p.repo)||profileRepos,projects:[],requests:[],results:{profile:null,site:null}};
 for(const repo of repositories){
  const entry=batch.projects.find(p=>p.repository===repo.full_name),id=/^\d+$/.test(String(repo.id))?String(repo.id):digest(repo.full_name).slice(0,12);
  const relative=`projects/${id}/draft`,folder=join(root,relative);
  await mkdir(folder,{recursive:true});
  if(entry) await cp(join(workspace,'experiments/github-readmes',entry.path),folder,{recursive:true});
  else await writeFile(join(folder,'README.md'),`# ${repo.name}\n\n${repo.description||'项目资料尚未分析。'}\n`);
  const markdown=await readFile(join(folder,'README.md'),'utf8');
  const previous=oldConfig?.projects.find(p=>p.repo===repo.full_name),legacy=existing[repo.name];
  const website=safeUrl(previous?.url||legacy?.url||repo.homepage||markdown.match(/https:\/\/(?!github\.com)[^\s"<>)]*/)?.[0]||'');
  const sourceCover=imagePath(markdown),cover=sourceCover&&await exists(resolve(folder,sourceCover))?`${relative}/${sourceCover}`:null;
  const name=previous?.name||legacy?.name||entry?.title||repo.name;
  const description=previous?.description||legacy?.description||firstParagraph(markdown)||repo.description||'';
  const p={id,repo:repo.full_name,repository:repo,name,description,platform:previous?.platform||legacy?.platform||entry?.tag||repo.language||'',url:website,category:entry?.category||'其他项目',sourceSha:entry?.sourceCommit||null,sourcePushedAt:repo.pushed_at||null,sourceChanged:false,draft:{root:relative,hash:digest(markdown),cover,importedAt:new Date().toISOString(),theme:entry?.status==='published'?'北欧工作台':entry?'北欧初稿':'未设计',published:entry?.status==='published'},design:{direction:themes[repo.name]||'按项目定位定制主题',keepCover:entry?.status==='published',keepCopy:true,notes:''},approved:null};
  if(legacy||entry?.status==='published'){
   const publicRoot=`projects/${id}/approved/initial`;await mkdir(join(root,publicRoot),{recursive:true});
   let publicCover=null;
   if(legacy?.image){publicCover=`${publicRoot}/cover${extname(legacy.image)}`;await copyFile(join(workspace,'assets',legacy.image),join(root,publicCover));}
   else if(cover){publicCover=`${publicRoot}/cover${extname(cover)}`;await copyFile(await safeFile(root,cover),join(root,publicCover));}
   p.approved={name,description,platform:p.platform,url:website,cover:publicCover,draftHash:entry?.status==='published'?p.draft.hash:null,confirmedAt:state.initializedAt,basis:legacy?'此前已保存的展示资料':'已发布 Runo README'};
  }
  state.projects.push(p);
 }
 state.profileRepos=state.profileRepos.filter(repo=>state.projects.some(p=>p.repo===repo));
 state.siteRepos=state.siteRepos.filter(repo=>state.projects.some(p=>p.repo===repo));
 await saveJson(file,state);return state;
}
export async function readState(workspace){return readJson(join(stateRoot(workspace),'workbench.json'));}
async function writeOperation(workspace,expected,operation){
 const root=stateRoot(workspace),lock=join(root,'.write-lock');
 try{await mkdir(lock);}catch(e){if(e.code==='EEXIST')throw Error('工作台正在保存，请稍后重试。');throw e;}
 try{
  const state=await readState(workspace);
  if(expected!==undefined&&expected!==state.revision)throw Error('配置已在其他操作中更新，请重新载入后重试；当前输入仍保留。');
  await operation(state,root);
  state.revision++;state.savedAt=new Date().toISOString();await saveJson(join(root,'workbench.json'),state);return state;
 }finally{await rm(lock,{recursive:true,force:true});}
}
function publicFields(input){
 const url=text(input.url||'',1000);
 if(url&&!safeUrl(url))throw Error('项目入口需要有效的 http 或 https 地址。');
 const result={name:text(input.name,100),description:text(input.description,600),platform:text(input.platform||'',100),url:safeUrl(url)};
 if(!result.name||!result.description)throw Error('请填写项目名称和一句话介绍。');return result;
}
function updateProject(p,input){
 Object.assign(p,publicFields(input));
 p.design={direction:text(input.direction||p.design.direction,600),keepCover:!!input.keepCover,keepCopy:!!input.keepCopy,notes:text(input.notes||'',2000)};
 if(!p.design.direction)throw Error('请填写项目主题方向。');
}
function validateSelection(state,input){
 const list=(values)=>{if(!Array.isArray(values)||values.length>state.projects.length)throw Error('展示选择格式不正确。');if(new Set(values).size!==values.length)throw Error('展示项目重复。');for(const repo of values)projectFor(state,repo);return values;};
 const profile={name:text(input.profile.name,80),headline:text(input.profile.headline,180),bio:text(input.profile.bio,600),github:safeUrl(input.profile.github)};
 if(!profile.name)throw Error('请填写展示名称。');return {profile,profileRepos:list(input.profileRepos),siteRepos:list(input.siteRepos)};
}
async function adopt(p,root){
 const acceptedRoot=`projects/${p.id}/approved/${p.draft.hash.slice(0,16)}`;
 await mkdir(join(root,acceptedRoot),{recursive:true});
 let cover=null;
 if(p.draft.cover){cover=`${acceptedRoot}/cover${extname(p.draft.cover)}`;await copyFile(await safeFile(root,p.draft.cover),join(root,cover));}
 p.approved={...publicFields(p),cover,draftHash:p.draft.hash,confirmedAt:new Date().toISOString(),basis:'用户在工作台本地采用'};
}
function publicProjects(state,target){
 const repos=target==='profile'?state.profileRepos:state.siteRepos;
 if(!repos.length)throw Error('请至少选择一个展示项目。');
 return repos.map(repo=>{
  const p=projectFor(state,repo),a=p.approved;
  if(!a)throw Error(`请先在项目详情确认「${p.name}」的展示资料。`);
  const privateLink=p.repository.private&&a.url.startsWith(p.repository.html_url);
  const url=privateLink?'':safeUrl(a.url)||(p.repository.private?'':safeUrl(p.repository.html_url));
  return {repo:p.repo,id:p.id,name:a.name,description:a.description,platform:a.platform,url,cover:target==='site'&&p.siteCover?p.siteCover.file:a.cover,imageSource:target==='site'&&p.siteCover?p.siteCover.source:undefined,private:!!p.repository.private,html_url:p.repository.html_url,language:p.repository.language||'',confirmedAt:a.confirmedAt};
 });
}
export function outputSignature(state,target){
 try{return digest({profile:state.profile,projects:publicProjects(state,target)});}catch{return null;}
}
async function swapDirectory(staging,target){
 const backup=`${target}.previous`;
 await rm(backup,{recursive:true,force:true});
 const had=await exists(target);if(had)await rename(target,backup);
 try{await rename(staging,target);}catch(e){if(had)await rename(backup,target);throw e;}
 await rm(backup,{recursive:true,force:true});
}
export async function generateOutput(state,root,target){
 const projects=publicProjects(state,target),staging=join(root,`.${target}-${randomUUID()}`);
 await mkdir(join(staging,'assets'),{recursive:true});
 try{
  for(const p of projects)if(p.cover){p.image=`${p.id}${extname(p.cover)}`;await copyFile(await safeFile(root,p.cover),join(staging,'assets',p.image));}
  if(target==='site'){
   const html=renderSite({profile:state.profile},projects);
   await writeFile(join(staging,'index.html'),html);
   for(const file of ['site.css','site.js'])await copyFile(new URL(`../../portfolio-builder/assets/${file}`,import.meta.url),join(staging,file));
  }else{
   if(projects.some(p=>!p.url))throw Error('Profile 展示项目需要公开产品入口，或可公开访问的源码链接。请先补充项目入口。');
   const e=escapeHtml,profile=state.profile;
   const cards=projects.map(p=>`<tr><td width="100%">\n<a href="${e(p.url)}">${p.image?`<img src="assets/${e(p.image)}" alt="${e(p.name)}" width="840">`:e(p.name)}</a>\n<p><b>${e(p.name)}</b> · ${e(p.description)}</p>\n<p>${e(p.platform||'独立作品')}</p>\n</td></tr>`).join('\n');
   const markdown=`# ${e(profile.name)}\n\n**${e(profile.headline)}**\n\n${e(profile.bio)}\n\n${profile.github?`[GitHub](${profile.github})\n\n`:''}## 我的作品\n\n<table>\n${cards}\n</table>\n`;
   await writeFile(join(staging,'README.md'),markdown);
  }
  await swapDirectory(staging,join(root,target));
  state.results[target]={generatedAt:new Date().toISOString(),count:projects.length,signature:outputSignature(state,target),repos:projects.map(p=>p.repo)};
 }catch(e){await rm(staging,{recursive:true,force:true});throw e;}
}
export async function act(workspace,input){
 return writeOperation(workspace,input.revision,async(state,root)=>{
  if(input.type==='config'){Object.assign(state,validateSelection(state,input));return;}
  if(['generate-profile','generate-site'].includes(input.type)){
   if(input.config)Object.assign(state,validateSelection(state,input.config));
   await generateOutput(state,root,input.type==='generate-profile'?'profile':'site');return;
  }
  const p=projectFor(state,input.repo);
  if(['project','request','adopt'].includes(input.type))updateProject(p,input.project);
  if(input.type==='project')return;
  if(input.type==='adopt'){await adopt(p,root);return;}
  if(input.type==='request'){
   const request={repo:p.repo,projectId:p.id,sourceSha:p.sourceSha,baseDraftHash:p.draft.hash,design:structuredClone(p.design),display:publicFields(p)};
   const same=state.requests.find(r=>r.status==='pending'&&r.fingerprint===digest(request));
   if(same){state.activeRequestId=same.id;return;}
   for(const old of state.requests)if(old.repo===p.repo&&old.status==='pending')old.status='superseded';
   const next={...request,id:randomUUID(),fingerprint:digest(request),status:'pending',createdAt:new Date().toISOString()};
   state.requests.unshift(next);state.requests=state.requests.slice(0,50);state.activeRequestId=next.id;return;
  }
  throw Error('不支持的工作台操作。');
 });
}
export async function refreshInventory(workspace,repositories){
 return writeOperation(workspace,undefined,async(state,root)=>{
  for(const repo of repositories){
   let p=state.projects.find(p=>p.repo===repo.full_name);
   if(p){p.sourceChanged=!!p.sourcePushedAt&&p.sourcePushedAt!==repo.pushed_at;p.repository=repo;continue;}
   const id=/^\d+$/.test(String(repo.id))?String(repo.id):digest(repo.full_name).slice(0,12),relative=`projects/${id}/draft`;await mkdir(join(root,relative),{recursive:true});
   const markdown=`# ${repo.name}\n\n${repo.description||'尚未分析，请在聊天中发起项目分析。'}\n`;await writeFile(join(root,relative,'README.md'),markdown);
   p={id,repo:repo.full_name,repository:repo,name:repo.name,description:repo.description||'',platform:repo.language||'',url:safeUrl(repo.homepage),category:'新发现',sourceSha:null,sourcePushedAt:repo.pushed_at,sourceChanged:false,draft:{root:relative,hash:digest(markdown),cover:null,theme:'未设计',published:false},design:{direction:'按项目定位定制主题',keepCover:false,keepCopy:true,notes:''},approved:null};state.projects.push(p);
  }
  state.fetchedAt=new Date().toISOString();
 });
}
export async function importDraft(workspace,{repo,requestId,folder,sourceSha}){
 return writeOperation(workspace,undefined,async(state,root)=>{
  const p=projectFor(state,repo),request=state.requests.find(r=>r.id===requestId&&r.repo===repo);
  if(!request||request.status!=='pending')throw Error('优化任务不存在或已经结束。');
  if(request.baseDraftHash!==p.draft.hash)throw Error('当前 README 已有新版本，请重新准备优化任务。');
  const inputRoot=resolve(folder),markdown=await readFile(join(inputRoot,'README.md'),'utf8');
  if(!/^#\s+\S/m.test(markdown))throw Error('新 README 缺少原生一级标题。');
  const files=[...markdown.matchAll(/<img\b[^>]*src="([^"]+)"/gi)].map(m=>m[1]);
  files.push(...[...markdown.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map(m=>m[1]));
  for(const file of files)if(!/^https?:/.test(file))await safeFile(inputRoot,file);
  if(/<(?:script|style|iframe)\b|\b(?:style|class|on\w+)\s*=/i.test(markdown.replace(/```[\s\S]*?```/g,'')))throw Error('新 README 含不支持的样式或脚本。');
  if(request.design.keepCover&&p.draft.cover){
   const current=await readFile(await safeFile(root,p.draft.cover));const candidate=imagePath(markdown);
   if(!candidate||digest(await readFile(await safeFile(inputRoot,candidate)))!==digest(current))throw Error('任务要求保留封面，新稿封面却发生改变。');
  }
  const hash=digest(markdown),relative=`projects/${p.id}/versions/${request.id}`;
  await cp(inputRoot,join(root,relative),{recursive:true});
  const cover=imagePath(markdown);p.draft={root:relative,hash,cover:cover&&!/^https?:/.test(cover)?`${relative}/${cover}`:null,theme:request.design.direction,importedAt:new Date().toISOString(),published:false};
  p.sourceSha=sourceSha||p.sourceSha;p.sourcePushedAt=p.repository.pushed_at;p.sourceChanged=false;
  request.status='completed';request.completedAt=new Date().toISOString();request.resultHash=hash;
 });
}
export async function importSiteCovers(workspace,manifestFile,{includeProfile=false}={}){
 const manifest=await readJson(resolve(manifestFile));
 if(!Array.isArray(manifest?.projects)||!manifest.projects.length)throw Error('配图清单不能为空。');
 return writeOperation(workspace,undefined,async(state,root)=>{
  const seen=new Set(),prepared=[];
  for(const entry of manifest.projects){
   const p=projectFor(state,entry.repo);
   if(seen.has(p.repo))throw Error('配图清单中项目重复。');seen.add(p.repo);
   if(!p.approved)throw Error(`请先确认「${p.name}」的公开展示资料。`);
   const file=await safeFile(dirname(resolve(manifestFile)),entry.file),bytes=await readFile(file);
   if(bytes.length<24||bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||bytes.toString('ascii',12,16)!=='IHDR')throw Error('站点配图需要 PNG 文件。');
   const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
   if(width<1280||height<720||Math.abs(height-width*9/16)>1)throw Error('站点配图需要至少 1280×720 的 16:9 图片（允许 1px 取整误差）。');
   const hash=createHash('sha256').update(bytes).digest('hex');
   prepared.push({p,bytes,cover:{file:`projects/${p.id}/approved/site-${hash.slice(0,16)}/cover.png`,hash,width,height,theme:text(entry.theme||'',100),source:'AI 概念配图',confirmedAt:new Date().toISOString()}});
  }
  for(const {p,bytes,cover}of prepared){await mkdir(dirname(join(root,cover.file)),{recursive:true});await writeFile(join(root,cover.file),bytes);p.siteCover=cover;if(includeProfile)p.approved.cover=cover.file;}
 });
}
export function clientState(state){
 return {...state,results:Object.fromEntries(Object.entries(state.results).map(([target,result])=>[target,result?{...result,stale:result.signature!==outputSignature(state,target)}:null]))};
}
