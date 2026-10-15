const $=id=>document.getElementById(id);
const e=(value='')=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state,config,tab=location.hash.slice(1)||'repos',selectedRepo,view='draft',busy=false,query='',filter='all';
const edits=new Map();
const date=value=>value?new Date(value).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}):'未记录';
const uri=encodeURIComponent;
const current=()=>state.projects.find(p=>p.repo===selectedRepo)||state.projects[0];
const projectInput=p=>edits.get(p.repo)||{name:p.name,description:p.description,platform:p.platform,url:p.url,...p.design};
const configFrom=s=>({profile:structuredClone(s.profile),profileRepos:[...s.profileRepos],siteRepos:[...s.siteRepos]});
const isDirty=()=>JSON.stringify(config)!==JSON.stringify(configFrom(state));
function notice(message,error=false){$('notice').textContent=message;$('notice').classList.toggle('error',error);$('notice').hidden=!message;}
async function api(path,data){const response=await fetch(path,data===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const result=await response.json();if(!response.ok)throw Error(result.error||'请求失败');return result;}
function badge(p){return p.draft.published?'<span class="badge good">已发布 README</span>':p.approved?.draftHash===p.draft.hash?'<span class="badge good">本地已采用</span>':'<span class="badge">图文初稿</span>';}
function requestFor(p){return state.requests.find(r=>r.repo===p.repo&&r.status==='pending');}
function head(eyebrow,title,description,action=''){return `<div class="page-head"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${description}</p></div>${action}</div>`;}
function fileUrl(path){return '/workbench-files/'+path.split('/').map(uri).join('/');}
function rememberProject(repo){selectedRepo=repo;const url=new URL(location.href);url.searchParams.set('project',repo);url.hash='project';history.replaceState(null,'',url);}
function renderRepos(){
 $('content').innerHTML=head('YOUR PROJECTS, ONE WORKSPACE','让作品，从这里开始。','项目资料、README、Profile 和个人站点，在同一处继续打磨。','<button class="button" data-action="refresh">↻ 刷新 GitHub 仓库</button>')+`<div class="stats"><div class="stat"><strong>${state.projects.length}</strong><span>个人仓库</span><small>完整盘点，独立管理</small></div><div class="stat"><strong>${state.projects.filter(p=>p.draft.cover).length}</strong><span>图文项目稿</span><small>保留素材与内容依据</small></div><div class="stat"><strong>${config.profileRepos.length}</strong><span>Profile 展示</span><small>挑选代表作品</small></div><div class="stat"><strong>${config.siteRepos.length}</strong><span>站点作品</span><small>共享已确认的项目资料</small></div></div><div class="collection-tools"><div><input class="search" id="search" type="search" aria-label="搜索项目" placeholder="搜索项目、名称或用途…" value="${e(query)}"><select class="filter" id="filter" aria-label="项目可见性"><option value="all">全部仓库</option><option value="private" ${filter==='private'?'selected':''}>私有仓库</option><option value="public" ${filter==='public'?'selected':''}>公开仓库</option></select></div><small>上次盘点 ${date(state.fetchedAt)} · 已导入本轮资料</small></div><div class="repo-grid" id="repo-grid"></div>`;
 renderCards();
}
function renderCards(){
 const rows=state.projects.filter(p=>(`${p.name} ${p.repo} ${p.description}`).toLowerCase().includes(query.toLowerCase())&&(filter==='all'||(filter==='private')===p.repository.private));
 $('repo-grid').innerHTML=rows.map(p=>`<article class="repo-card">${p.draft.cover?`<img class="repo-media" src="${fileUrl(p.draft.cover)}" alt="${e(p.name)}主题概念封面" loading="lazy">`:`<div class="empty-cover">${e(p.name)}</div>`}<div class="repo-body"><div class="repo-meta"><span>${e(p.category)}</span><span>${p.repository.private?'私有':'公开'}仓库</span></div><h3>${e(p.name)}</h3><p>${e(p.description)}</p><div class="repo-bottom">${badge(p)}<button class="button small" data-project="${e(p.repo)}">查看与优化 ↗</button></div><div class="repo-id">${e(p.repo)}${p.sourceChanged?' · 源码待核对':''}</div></div></article>`).join('')||'<p class="help">没有匹配的项目。</p>';
}
function renderProject(){
 const p=current();if(!p){$('content').innerHTML='<p>请先刷新仓库。</p>';return;}
 selectedRepo=p.repo;const input=projectInput(p),request=requestFor(p);
 $('content').innerHTML=head('PROJECT README / MAKE IT YOUR OWN',e(p.name),'按项目定位调整主题；查看文案、素材和来源，再决定采用哪一版。','<button class="button" data-tab="repos">← 返回总览</button>')+`<div class="two-columns"><section class="panel"><div class="panel-head"><h2>项目与设计</h2>${badge(p)}</div><div class="panel-body"><label class="field">当前项目<select id="project-select">${state.projects.map(item=>`<option value="${e(item.repo)}" ${p===item?'selected':''}>${e(item.name)}</option>`).join('')}</select></label><div class="theme-line">当前稿：<b>${e(p.draft.theme)}</b><br>源提交：${e(p.sourceSha?.slice(0,7)||'待分析')} · ${p.approved?'展示资料已确认':'展示资料待确认'}</div><label class="field">想要的主题方向<textarea id="project-direction" data-edit="direction" rows="3" maxlength="600">${e(input.direction)}</textarea></label><label class="field">这次想调整什么<textarea data-edit="notes" rows="3" maxlength="2000" placeholder="例如：封面轻盈一些，重点讲空间账本…">${e(input.notes)}</textarea></label><div class="checks"><label><input type="checkbox" data-edit="keepCover" ${input.keepCover?'checked':''}>保留现有封面</label><label><input type="checkbox" data-edit="keepCopy" ${input.keepCopy?'checked':''}>保留我编辑的展示文案</label></div><div class="button-row"><button class="button primary" data-action="request">保存并准备优化</button><button class="button" data-action="project">保存设置</button></div><p class="help">保存后回到 Codex 聊天执行 AI 分析与配图，结果会写回这里。</p><details class="edit-fields"><summary>编辑 Profile / 站点展示资料</summary><label class="field">项目名称<input data-edit="name" maxlength="100" value="${e(input.name)}"></label><label class="field">一句话介绍<textarea data-edit="description" maxlength="600" rows="3">${e(input.description)}</textarea></label><label class="field">公开产品入口<input data-edit="url" type="url" value="${e(input.url)}" placeholder="https://…"></label><label class="field">平台<input data-edit="platform" maxlength="100" value="${e(input.platform)}"></label><p class="help">这些资料在你采用后供 Profile 与站点共用。</p></details><button class="button soft" data-action="adopt">采用当前稿与展示资料 ✓</button><p class="help">采用保存在本地工作台，不会替换 GitHub 上的文件。</p>${request?`<div class="request-box"><strong>已准备 · 等待聊天执行</strong><p>回到当前 Codex 聊天，说：</p><code>优化工作台选中的项目</code><button class="text-button" data-action="copy">复制这句话 ↗</button><small>${date(request.createdAt)} · ${e(p.name)}<br>执行完成后，点击顶部“刷新结果”。</small></div>`:''}${state.requests.some(r=>r.repo===p.repo)?`<details class="history"><summary>优化记录</summary><ul>${state.requests.filter(r=>r.repo===p.repo).map(r=>`<li>${date(r.createdAt)} · ${r.status==='completed'?'已回写新稿':r.status==='pending'?'等待 Codex 执行':'已被新要求替代'}</li>`).join('')}</ul></details>`:''}</div></section><section class="panel"><div class="panel-head preview-heading"><div><h2>README 预览</h2><p>本地 GFM 渲染 · 保留原生文字与图片</p></div><a href="/workbench/preview/project?repo=${uri(p.repo)}&view=${view}" target="_blank" rel="noopener">展开 ↗</a></div><div class="preview-tabs">${[['draft','当前图文稿'],['original','原文存档'],['evidence','内容依据']].map(([id,label])=>`<button data-view="${id}" class="${view===id?'active':''}">${label}</button>`).join('')}</div><iframe class="preview-frame" title="项目 README 预览" src="/workbench/preview/project?repo=${uri(p.repo)}&view=${view}"></iframe></section></div>`;
}
function picker(kind){
 const key=kind==='profile'?'profileRepos':'siteRepos',selected=config[key];
 const ordered=[...selected.map(repo=>state.projects.find(p=>p.repo===repo)).filter(Boolean),...state.projects.filter(p=>!selected.includes(p.repo))];
 return `<div class="picker"><div class="picker-head"><h3>${kind==='profile'?'代表作品':'上站项目'}</h3><span>${selected.length} 个已选</span></div>${ordered.map(p=>{const index=selected.indexOf(p.repo),yes=index>=0;return `<div class="pick-row"><label><input type="checkbox" data-pick="${key}" data-repo="${e(p.repo)}" ${yes?'checked':''} ${!p.approved?'disabled':''}><span>${e(p.approved?.name||p.name)}<small>${e(p.repo)}</small></span></label>${p.approved?`<button class="move" data-move="${key}" data-repo="${e(p.repo)}" data-direction="-1" aria-label="上移 ${e(p.name)}" ${index<=0?'disabled':''}>↑</button><button class="move" data-move="${key}" data-repo="${e(p.repo)}" data-direction="1" aria-label="下移 ${e(p.name)}" ${index<0||index===selected.length-1?'disabled':''}>↓</button>`:`<button class="text-button needs-approval" data-project="${e(p.repo)}">先确认资料</button>`}</div>`;}).join('')}<p class="picker-note">展示列表使用已确认资料。新项目先在项目详情采用；项目是否私有与是否展示产品简介分别处理。</p></div>`;
}
function renderOutput(kind){
 const profile=kind==='profile',result=state.results[kind];
 const title=profile?'把你做的事，整理成一张名片。':'给这些作品，一个自己的地方。';
 $('content').innerHTML=head(profile?'PROFILE README / YOUR SELECTED WORK':'PERSONAL WEBSITE / YOUR COLLECTION',title,profile?'挑选代表作品，保留你的个人表达。':'沿用同一份项目资料，选择更适合站点的作品组合。',`<button class="button primary" data-action="generate-${kind}">生成并预览 ↗</button>`)+`<div class="two-columns"><section class="panel"><div class="panel-head"><h2>${profile?'个人介绍与代表作品':'站点作品配置'}</h2><span class="dirty-dot">${isDirty()?'有未保存修改':''}</span></div><div class="panel-body">${profile?`<label class="field">展示名称<input data-profile="name" maxlength="80" value="${e(config.profile.name)}"></label><label class="field">个人标题<input data-profile="headline" maxlength="180" value="${e(config.profile.headline)}"></label><label class="field">个人介绍<textarea data-profile="bio" maxlength="600" rows="4">${e(config.profile.bio)}</textarea></label><label class="field">GitHub 主页<input data-profile="github" type="url" value="${e(config.profile.github)}"></label>`:`<div class="profile-info"><strong>${e(config.profile.name)}</strong><br>${e(config.profile.headline)}<br><button class="text-button" data-tab="profile">编辑共享个人资料 ↗</button></div>`}${picker(kind)}</div><div class="panel-actions"><button class="button" data-action="config">保存配置</button><button class="button primary" data-action="generate-${kind}">${profile?'生成 Profile':'生成个人站点'} ↗</button></div></section><section class="panel"><div class="panel-head preview-heading"><div><h2>${profile?'Profile README':'个人站点'}预览</h2><p>使用已确认的文案、入口与素材</p></div>${result?`<a href="${profile?'/workbench/preview/profile':'/preview/'}" target="_blank" rel="noopener">展开 ↗</a>`:''}</div><div class="result-note">${result?`${date(result.generatedAt)} · ${result.count} 个作品${result.stale?' · 资料已变化，请重新生成':''}${isDirty()?' · 先保存并生成以更新预览':''}`:'选好作品后，点击生成查看效果。'}</div>${result?`<iframe class="preview-frame ${profile?'':'site-frame'}" title="${profile?'Profile README':'个人站点'}预览" src="${profile?'/workbench/preview/profile':'/preview/'}"></iframe>`:'<div class="empty-preview">你的作品会在这里成形。</div>'}${profile&&result?'<div class="panel-actions"><a class="button small" href="/workbench-files/profile/README.md" download>下载 Markdown ↓</a></div>':''}</section></div>`;
}
function render(){
 if(!state)return;
 if(!['repos','project','profile','site'].includes(tab))tab='repos';
 $('owner-name').textContent=state.profile.name;$('nav-count').textContent=state.projects.length;
 const names={repos:'仓库总览',project:'项目 README',profile:'Profile README',site:'个人站点'};$('crumb').textContent=names[tab];
 document.querySelectorAll('.nav').forEach(button=>button.classList.toggle('active',button.dataset.tab===tab));
 $('saved-at').textContent=`本地保存 ${date(state.savedAt||state.initializedAt)}`;
 if(tab==='repos')renderRepos();else if(tab==='project')renderProject();else renderOutput(tab);
 document.querySelectorAll('button[data-action]').forEach(button=>button.disabled=busy);
}
async function execute(type){
 if(busy)return;busy=true;render();
 try{
  let next;
  if(type==='refresh')next=await api('/api/workbench/refresh',{});
  else{
   const payload={type,revision:state.revision};
   if(['project','request','adopt'].includes(type)){const p=current();payload.repo=p.repo;payload.project=projectInput(p);}
   if(type==='config')Object.assign(payload,config);
   if(type.startsWith('generate-'))payload.config=config;
   next=await api('/api/workbench/action',payload);
  }
  const dirty=isDirty();state=next;
  if(type==='config'||type.startsWith('generate-')||!dirty)config=configFrom(next);
  if(['project','request','adopt'].includes(type))edits.delete(selectedRepo);
  const messages={refresh:'仓库清单已刷新，已有主题与展示选择继续保留。',project:'项目设置已保存。',request:'优化要求已保存。回到聊天说“优化工作台选中的项目”，由 Codex 执行。',adopt:'已在本地采用当前稿与展示资料，可用于 Profile 和站点。',config:'个人资料与展示选择已保存。','generate-profile':'Profile 已生成，展示内容来自已确认的项目资料。','generate-site':'个人站点已生成，可在右侧预览或展开。'};
  notice(messages[type]||'已完成。');
 }catch(error){notice(error.message,true);}finally{busy=false;render();if(type.startsWith('generate-'))document.querySelector('.preview-heading')?.scrollIntoView({block:'start'});}
}
document.addEventListener('input',event=>{
 const target=event.target;
 if(target.id==='search'){query=target.value;renderCards();return;}
 if(target.dataset.profile){config.profile[target.dataset.profile]=target.value;document.querySelector('.dirty-dot').textContent='有未保存修改';}
 if(target.dataset.edit){const p=current(),input={...projectInput(p)};input[target.dataset.edit]=target.type==='checkbox'?target.checked:target.value;edits.set(p.repo,input);}
});
document.addEventListener('change',event=>{
 const target=event.target;
 if(target.id==='filter'){filter=target.value;renderCards();}
 if(target.id==='project-select'){rememberProject(target.value);view='draft';render();}
 if(target.dataset.pick){const list=config[target.dataset.pick];config[target.dataset.pick]=target.checked?[...list,target.dataset.repo]:list.filter(repo=>repo!==target.dataset.repo);render();}
});
document.addEventListener('click',async event=>{
 const button=event.target.closest('button');if(!button||button.disabled)return;
 if(button.dataset.tab){tab=button.dataset.tab;history.replaceState(null,'','#'+tab);render();window.scrollTo(0,0);return;}
 if(button.dataset.project){rememberProject(button.dataset.project);tab='project';view='draft';render();window.scrollTo(0,0);return;}
 if(button.dataset.view){view=button.dataset.view;render();return;}
 if(button.dataset.move){const list=config[button.dataset.move],index=list.indexOf(button.dataset.repo),to=index+Number(button.dataset.direction);if(index>=0&&to>=0&&to<list.length)[list[index],list[to]]=[list[to],list[index]];render();return;}
 if(button.dataset.action==='copy'){try{await navigator.clipboard.writeText('优化工作台选中的项目');notice('已复制。回到 Codex 聊天粘贴即可。');}catch{notice('请在聊天输入：优化工作台选中的项目');}return;}
 if(button.dataset.action){await execute(button.dataset.action);return;}
 if(button.id==='reload-state'){
  try{const next=await api('/api/workbench/state');const dirty=isDirty();state=next;if(!dirty)config=configFrom(next);render();notice('已读取最新执行结果，未保存的配置输入继续保留。');}catch(error){notice(error.message,true);}
 }
});
api('/api/workbench/state').then(result=>{state=result;config=configFrom(result);selectedRepo=new URL(location.href).searchParams.get('project')||state.requests.find(r=>r.id===state.activeRequestId)?.repo||state.projects[0]?.repo;render();}).catch(error=>notice(error.message,true));
