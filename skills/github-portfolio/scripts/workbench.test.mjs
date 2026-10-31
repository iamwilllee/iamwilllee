import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, cp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { initialize, act, readState, stateRoot, importDraft, importSiteCovers, clientState, refreshInventory, syncPlan } from './workbench.mjs';
import { validatePublication } from '../../../scripts/sync-portfolio.mjs';
import { profileLayout, renderProfile } from './profile.mjs';

const image='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#315944"/></svg>';
async function fixture(){
 const root=await mkdtemp(join(tmpdir(),'portfolio-workbench-'));
 await mkdir(join(root,'.portfolio-builder'),{recursive:true});await mkdir(join(root,'scripts'),{recursive:true});await mkdir(join(root,'assets'),{recursive:true});
 await cp(new URL('../../../scripts/sync-portfolio.mjs',import.meta.url),join(root,'scripts/sync-portfolio.mjs'));
 await mkdir(join(root,'skills/portfolio-builder/scripts'),{recursive:true});
 await cp(new URL('../../portfolio-builder/scripts/core.mjs',import.meta.url),join(root,'skills/portfolio-builder/scripts/core.mjs'));
 await writeFile(join(root,'assets/old.svg'),image);
 await writeFile(join(root,'README.md'),'<table><tr><td><a href="https://xiaohuayu.example"><img src="assets/old.svg" alt="小画屿"></a><p><b>小画屿</b> · 已确认的公开介绍</p><p>Web</p></td></tr></table>');
 const repositories=[{id:1,name:'xiaohuayu',full_name:'owner/xiaohuayu',private:true,html_url:'https://github.com/owner/xiaohuayu',default_branch:'main',pushed_at:'2026-01-01'}, {id:2,name:'runo',full_name:'owner/runo',private:true,html_url:'https://github.com/owner/runo',default_branch:'main',pushed_at:'2026-01-01'}];
 await writeFile(join(root,'.portfolio-builder/repositories.json'),JSON.stringify({repositories,fetchedAt:'2026-01-01'}));
 const profile={name:'Maker',headline:'My projects',bio:'A maker.',github:'https://github.com/owner'};
 await writeFile(join(root,'.portfolio-builder/config.json'),JSON.stringify({profile,projects:repositories.map(r=>({repo:r.full_name,name:'',description:'',url:'',platform:''}))}));
 const projects=[];
 for(const [i,r]of repositories.entries()){
  const path=`projects/${r.name}`,folder=join(root,'experiments/github-readmes',path);await mkdir(join(folder,'docs/readme/assets'),{recursive:true});
  await writeFile(join(folder,'docs/readme/assets/cover.svg'),image);
  await writeFile(join(folder,'README.md'),`<img src="docs/readme/assets/cover.svg" alt="concept">\n\n# ${r.name}\n\nINTERNAL_SOURCE_ONLY\n\n[Website](https://${r.name}.example/)\n`);
  projects.push({repository:r.full_name,repo:r.name,path,title:r.name,tag:'Web',category:'Tools',sourceCommit:`sha-${i}`,status:i===1?'published':'draft'});
 }
 await writeFile(join(root,'experiments/github-readmes/manifest.json'),JSON.stringify({projects}));
 const state=await initialize(root);return {root,state};
}
const input=p=>({name:p.name,description:p.description,platform:p.platform,url:p.url,...p.design});

test('migration retains independent selections and emits compact Profile cards using confirmed data',async()=>{
 const {root,state}=await fixture();
 try{
  assert.deepEqual(state.profileRepos,['owner/xiaohuayu']);assert.equal(state.siteRepos.length,2);
  const p=state.projects[0];assert.equal(p.approved.description,'已确认的公开介绍');
  const next=await act(root,{type:'generate-profile',revision:state.revision});
  const markdown=await readFile(join(stateRoot(root),'profile/README.md'),'utf8');
  assert.equal((markdown.match(/<img /g)||[]).length,1);assert.match(markdown, /width="360"/);assert.ok(!markdown.includes('INTERNAL_SOURCE_ONLY'));
  await act(root,{type:'generate-site',revision:next.revision});
  const html=await readFile(join(stateRoot(root),'site/index.html'),'utf8');
  assert.ok(!html.includes('https://github.com/owner/xiaohuayu'));
  assert.ok(html.includes('已确认的公开介绍'));
  assert.match(html, /<link rel="icon"[^>]+href="favicon\.svg"/);
  assert.deepEqual(await readFile(join(stateRoot(root),'site/favicon.svg')),await readFile(new URL('../../portfolio-builder/assets/favicon.svg',import.meta.url)));
 }finally{await rm(root,{recursive:true,force:true});}
});

test('a queued Codex draft returns to the same project and stays separate from adopted public content',async()=>{
 const {root,state}=await fixture();
 try{
  const p=state.projects[1],project={...input(p),description:'New public description'};
  let next=await act(root,{type:'generate-site',revision:state.revision});
  next=await act(root,{type:'request',repo:p.repo,project,revision:next.revision});
  const request=next.requests[0];
  next=await act(root,{type:'request',repo:p.repo,project,revision:next.revision});assert.equal(next.requests.length,1);
  const draft=join(root,'next-draft');await cp(join(stateRoot(root),p.draft.root),draft,{recursive:true});
  await writeFile(join(draft,'README.md'),'<img src="docs/readme/assets/cover.svg" alt="kept cover">\n\n# Runo\n\nVerified new feature.\n');
  next=await importDraft(root,{repo:p.repo,requestId:request.id,folder:draft,sourceSha:'verified-new-sha'});
  assert.equal(next.requests[0].status,'completed');assert.equal(next.projects[1].sourceSha,'verified-new-sha');
  assert.equal(next.projects[0].draft.hash,state.projects[0].draft.hash);
  assert.equal(clientState(next).results.site.stale,false);
  assert.notEqual(next.projects[1].approved.draftHash,next.projects[1].draft.hash);
  next=await act(root,{type:'adopt',repo:p.repo,project,revision:next.revision});
  assert.equal(clientState(next).results.site.stale,true);
  assert.equal(next.projects[1].approved.description,'New public description');
  const persisted=await readState(root);assert.equal(persisted.projects[1].approved.draftHash,persisted.projects[1].draft.hash);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('stale writes, changed locked covers and failed generation preserve the existing state and output',async()=>{
 const {root,state}=await fixture();
 try{
  const p=state.projects[1];let next=await act(root,{type:'generate-site',revision:state.revision});
  const oldHtml=await readFile(join(stateRoot(root),'site/index.html'),'utf8');
  await assert.rejects(act(root,{type:'project',repo:p.repo,project:input(p),revision:state.revision}),/已在其他操作中更新/);
  next=await act(root,{type:'request',repo:p.repo,project:input(p),revision:next.revision});
  const draft=join(root,'bad-draft');await cp(join(stateRoot(root),p.draft.root),draft,{recursive:true});
  await writeFile(join(draft,'docs/readme/assets/cover.svg'),image.replace('#315944','#ff0000'));
  await assert.rejects(importDraft(root,{repo:p.repo,requestId:next.requests[0].id,folder:draft}),/保留封面/);
  assert.equal((await readState(root)).projects[1].draft.hash,p.draft.hash);
  await rm(join(stateRoot(root),next.projects[1].approved.cover));
  await assert.rejects(act(root,{type:'generate-site',revision:next.revision}));
  assert.equal(await readFile(join(stateRoot(root),'site/index.html'),'utf8'),oldHtml);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('website covers update independently of locked README covers and survive adoption and regeneration',async()=>{
 const {root,state}=await fixture();
 try{
  const p=state.projects[1],manifest=join(root,'covers.json');
  const png=await readFile(new URL('../../../assets/project-covers/runo.png',import.meta.url));
  await writeFile(join(root,'cover.png'),png);
  await writeFile(manifest,JSON.stringify({projects:[{repo:p.repo,file:'cover.png',theme:'Nordic'}]}));
  let next=await act(root,{type:'config',revision:state.revision,profile:state.profile,profileRepos:[p.repo],siteRepos:state.siteRepos});
  next=await act(root,{type:'generate-site',revision:next.revision});
  next=await act(root,{type:'generate-profile',revision:next.revision});
  const originalProfile=await readFile(join(stateRoot(root),'profile/README.md'),'utf8');
  next=await importSiteCovers(root,manifest);
  assert.equal(next.projects[1].draft.cover,p.draft.cover);
  assert.deepEqual(next.projects[1].approved,p.approved);
  assert.equal(clientState(next).results.site.stale,true);
  assert.equal(clientState(next).results.profile.stale,false);
  next=await act(root,{type:'adopt',repo:p.repo,project:input(p),revision:next.revision});
  const siteCover=next.projects[1].siteCover;
  next=await act(root,{type:'generate-site',revision:next.revision});
  const output=await readFile(join(stateRoot(root),'site/assets/2.png'));
  assert.deepEqual(output,png);assert.deepEqual(next.projects[1].siteCover,siteCover);
  assert.equal(await readFile(join(stateRoot(root),'profile/README.md'),'utf8'),originalProfile);
  next=await importSiteCovers(root,manifest,{includeProfile:true});
  assert.equal(next.projects[1].approved.cover,siteCover.file);
  assert.equal(clientState(next).results.profile.stale,true);
  png.writeUInt32BE(1200,16);await writeFile(join(root,'cover.png'),png);
  await assert.rejects(importSiteCovers(root,manifest),/16:9/);
  assert.deepEqual((await readState(root)).projects[1].siteCover,next.projects[1].siteCover);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('pausing optimization persists, cancels pending work and blocks new requests and late draft imports without hiding published work',async()=>{
 const {root,state}=await fixture();
 try{
  const p=state.projects[1];
  assert.equal(clientState(state).projects[1].optimizationEnabled,true);
  let next=await act(root,{type:'generate-site',revision:state.revision});
  const html=await readFile(join(stateRoot(root),'site/index.html'),'utf8');
  next=await act(root,{type:'request',repo:p.repo,project:input(p),revision:next.revision});
  const request=next.requests[0];
  assert.ok(syncPlan(next).candidates.some(c=>c.repo===p.repo));
  next=await act(root,{type:'optimization',repo:p.repo,enabled:false,revision:next.revision});
  assert.equal((await readState(root)).projects[1].optimizationEnabled,false);
  assert.equal(next.requests[0].status,'cancelled');assert.equal(next.activeRequestId,null);
  assert.deepEqual(next.profileRepos,state.profileRepos);assert.deepEqual(next.siteRepos,state.siteRepos);
  assert.deepEqual(next.projects[1].approved,p.approved);assert.deepEqual(next.projects[1].draft,p.draft);
  assert.equal(clientState(next).results.site.stale,false);
  assert.equal(await readFile(join(stateRoot(root),'site/index.html'),'utf8'),html);
  assert.ok(!syncPlan(next).candidates.some(c=>c.repo===p.repo));
  await assert.rejects(act(root,{type:'request',repo:p.repo,project:input(p),revision:next.revision}),/暂停/);
  await assert.rejects(importDraft(root,{repo:p.repo,requestId:request.id,folder:root}),/暂停/);
  next=await act(root,{type:'optimization',repo:p.repo,enabled:true,revision:next.revision});
  assert.equal(next.requests[0].status,'cancelled');
  next=await act(root,{type:'request',repo:p.repo,project:input(p),revision:next.revision});
  assert.equal(next.requests[0].status,'pending');assert.notEqual(next.requests[0].id,request.id);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('manual inventory refresh retains exclusions and source-change hints; newly discovered repositories require opt-in',async()=>{
 const {root,state}=await fixture();
 try{
  const p=state.projects[1];
  let next=await act(root,{type:'optimization',repo:p.repo,enabled:false,revision:state.revision});
  const changed=state.projects.map(p=>({...p.repository,pushed_at:'2026-02-01'}));
  const fresh={id:3,name:'new-app',full_name:'owner/new-app',private:true,html_url:'https://github.com/owner/new-app',pushed_at:'2026-02-01'};
  next=await refreshInventory(root,[...changed,fresh]);
  assert.equal(next.projects[1].optimizationEnabled,false);assert.equal(next.projects[1].sourceChanged,true);
  assert.equal(next.projects[2].optimizationEnabled,false);
  assert.deepEqual(next.siteRepos,state.siteRepos);assert.deepEqual(next.profileRepos,state.profileRepos);
  const plan=syncPlan(next);
  assert.deepEqual(plan.candidates.map(p=>p.repo),['owner/xiaohuayu']);
  assert.deepEqual(plan.paused.map(p=>p.repo),['owner/runo','owner/new-app']);
  assert.equal(plan.checkedAt,next.fetchedAt);
  next=await act(root,{type:'optimization',repo:fresh.full_name,enabled:true,revision:next.revision});
  assert.ok(syncPlan(next).candidates.some(p=>p.repo===fresh.full_name&&p.reason==='尚未分析'));
 }finally{await rm(root,{recursive:true,force:true});}
});

test('a verified update check clears old hints without changing the analysis snapshot, and future pushes are detected',async()=>{
 const {root,state}=await fixture();
 try{
  const p=state.projects[1],sha='a'.repeat(40),changed=state.projects.map(p=>({...p.repository,pushed_at:'2026-02-01'}));
  let next=await refreshInventory(root,changed);
  next=await act(root,{type:'record-check',repo:p.repo,sourceSha:sha,pushedAt:'2026-02-01',needsUpdate:false,summary:'提交已核对，无需重写。',revision:next.revision});
  assert.equal(next.projects[1].sourceSha,p.sourceSha);assert.deepEqual(next.projects[1].approved,p.approved);assert.deepEqual(next.projects[1].draft,p.draft);
  assert.equal(next.projects[1].lastUpdateCheck.sourceSha,sha);assert.equal(next.projects[1].sourceChanged,false);
  next=await refreshInventory(root,changed);
  assert.equal(next.projects[1].sourceChanged,false);assert.ok(!syncPlan(next).candidates.some(c=>c.repo===p.repo));
  next=await refreshInventory(root,changed.map(r=>({...r,pushed_at:'2026-03-01'})));
  assert.equal(next.projects[1].sourceChanged,true);
  await assert.rejects(act(root,{type:'record-check',repo:p.repo,sourceSha:sha,pushedAt:'2026-02-01',needsUpdate:false}),/资料已变化/);
  next=await act(root,{type:'optimization',repo:p.repo,enabled:false,revision:next.revision});
  await assert.rejects(act(root,{type:'record-check',repo:p.repo,sourceSha:sha,pushedAt:'2026-03-01',needsUpdate:false}),/暂停/);
 }finally{await rm(root,{recursive:true,force:true});}
});


test('Profile uses at most four featured images and keeps every other project as a native grouped link',()=>{
 const projects=Array.from({length:12},(_,i)=>({repo:`owner/${i}`,name:`Project ${i}`,description:'Approved description',platform:'Web',url:`https://example.com/${i}`,image:`assets/${i}.png`}));
 const layout={featuredRepos:projects.slice(0,4).map(p=>p.repo),entries:Object.fromEntries(projects.map((p,i)=>[p.repo,{group:i<8?'研究与创作':'亲子与家庭',summary:'简短介绍'}]))};
 const markdown=renderProfile({name:'Maker',headline:'Build things.',bio:'A maker.',github:'https://github.com/owner',website:'https://example.com/'},projects,layout);
 assert.equal((markdown.match(/<img /g)||[]).length,4);
 assert.equal((markdown.match(/<tr>/g)||[]).length,2);
 assert.equal((markdown.match(/<td width="50%"/g)||[]).length,4);
 for(const p of projects)assert.ok(markdown.includes(p.url));
 assert.match(markdown, /研究与创作/);assert.match(markdown, /亲子与家庭/);assert.match(markdown,/个人站点/);
 assert.doesNotMatch(markdown, /style=|class=|<script|<iframe|width="840"/);
 assert.throws(()=>profileLayout(projects.map(p=>p.repo),{featuredRepos:projects.slice(0,5).map(p=>p.repo)}),/最多精选/);
 assert.throws(()=>profileLayout(['owner/1'],{featuredRepos:['owner/2']}),/最多精选/);
 assert.throws(()=>profileLayout(['owner/1'],{featuredRepos:[],entries:{'owner/1':{group:'bad\nheading'}}}),/格式/);
});

test('Profile presentation persists without changing website selection, descriptions, covers or freshness',async()=>{
 const {root,state}=await fixture();
 try{
  let next=await act(root,{type:'adopt',revision:state.revision,repo:state.projects[1].repo,project:{...input(state.projects[1]),description:'Approved Runo introduction'}});
  next=await act(root,{type:'config',revision:next.revision,profile:next.profile,profileRepos:next.siteRepos,siteRepos:next.siteRepos});
  next=await act(root,{type:'generate-site',revision:next.revision});
  next=await act(root,{type:'generate-profile',revision:next.revision});
  const before=await readFile(join(stateRoot(root),'site/index.html'),'utf8');
  const repo=next.profileRepos[0],ordinary=next.profileRepos[1];
  const layout={featuredRepos:[repo],entries:{[repo]:{summary:'A tiny introduction'},[ordinary]:{group:'日常工具'}}};
  next=await act(root,{type:'config',revision:next.revision,profile:{...next.profile,website:'https://example.com/'},profileRepos:next.profileRepos,siteRepos:next.siteRepos,profileLayout:layout});
  assert.equal(clientState(next).results.profile.stale,true);assert.equal(clientState(next).results.site.stale,false);
  assert.deepEqual((await readState(root)).profileLayout,next.profileLayout);
  // An ordinary text entry needs no image to generate a Profile.
  await rm(join(stateRoot(root),next.projects[1].approved.cover));
  next=await act(root,{type:'generate-profile',revision:next.revision});
  const markdown=await readFile(join(stateRoot(root),'profile/README.md'),'utf8');
  assert.equal((markdown.match(/<img /g)||[]).length,1);assert.match(markdown,/A tiny introduction/);assert.match(markdown,/日常工具/);
  assert.equal(await readFile(join(stateRoot(root),'site/index.html'),'utf8'),before);
  const data=validatePublication(JSON.parse(await readFile(join(stateRoot(root),'site/portfolio-data.json'),'utf8')));
  assert.equal(data.projects.length,2);assert.equal(data.projects[0].description,'已确认的公开介绍');
  assert.doesNotMatch(JSON.stringify(data),/INTERNAL_SOURCE_ONLY|sourceSha|draftHash|github.com\/owner\/(?:runo|xiaohuayu)/);
 }finally{await rm(root,{recursive:true,force:true});}
});
