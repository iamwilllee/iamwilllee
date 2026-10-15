import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, cp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { initialize, act, readState, stateRoot, importDraft, clientState } from './workbench.mjs';
import { parseProjects } from '../../../scripts/sync-portfolio.mjs';

const image='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#315944"/></svg>';
async function fixture(){
 const root=await mkdtemp(join(tmpdir(),'portfolio-workbench-'));
 await mkdir(join(root,'.portfolio-builder'),{recursive:true});await mkdir(join(root,'scripts'),{recursive:true});await mkdir(join(root,'assets'),{recursive:true});
 await cp(new URL('../../../scripts/sync-portfolio.mjs',import.meta.url),join(root,'scripts/sync-portfolio.mjs'));
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

test('migration retains independent selections and emits legacy-compatible Profile cards using confirmed data',async()=>{
 const {root,state}=await fixture();
 try{
  assert.deepEqual(state.profileRepos,['owner/xiaohuayu']);assert.equal(state.siteRepos.length,2);
  const p=state.projects[0];assert.equal(p.approved.description,'已确认的公开介绍');
  const next=await act(root,{type:'generate-profile',revision:state.revision});
  const markdown=await readFile(join(stateRoot(root),'profile/README.md'),'utf8');
  assert.equal(parseProjects(markdown).length,1);assert.ok(!markdown.includes('INTERNAL_SOURCE_ONLY'));
  await act(root,{type:'generate-site',revision:next.revision});
  const html=await readFile(join(stateRoot(root),'site/index.html'),'utf8');
  assert.ok(!html.includes('https://github.com/owner/xiaohuayu'));
  assert.ok(html.includes('已确认的公开介绍'));
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
