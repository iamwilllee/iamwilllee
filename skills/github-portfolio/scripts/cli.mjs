import { resolve, join } from 'node:path';
import { readState, initialize, importDraft, importSiteCovers, stateRoot, act, optimizationEnabled, syncPlan, refreshInventory } from './workbench.mjs';
import { fetchRepositories } from '../../portfolio-builder/scripts/core.mjs';
const option=name=>{const i=process.argv.indexOf(name);return i<0?undefined:process.argv[i+1];};
if(!option('--workspace'))throw Error('需要 --workspace，使用当前聊天实际项目目录。');
const workspace=resolve(option('--workspace'));await initialize(workspace);
const command=process.argv[2];
if(command==='request'){
 const state=await readState(workspace),request=state.requests.find(r=>r.id===state.activeRequestId&&r.status==='pending');
 if(!request)throw Error('没有待执行的优化任务，请先在工作台选择项目并准备任务。');
 const p=state.projects.find(p=>p.repo===request.repo);
 if(!optimizationEnabled(p))throw Error('此项目已暂停 README 优化，请先在工作台恢复。');
 console.log(JSON.stringify({...request,currentDraft:join(stateRoot(workspace),p.draft.root),workspace},null,2));
}else if(command==='plan'||command==='sync'){
 const state=command==='sync'?await refreshInventory(workspace,await fetchRepositories()):await readState(workspace);
 console.log(JSON.stringify(syncPlan(state),null,2));
}else if(command==='record-check'){
 const state=await act(workspace,{type:'record-check',repo:option('--repo'),sourceSha:option('--source-sha'),pushedAt:option('--pushed-at'),needsUpdate:process.argv.includes('--needs-update'),summary:option('--summary')});
 console.log(JSON.stringify(state.projects.find(p=>p.repo===option('--repo')).lastUpdateCheck,null,2));
}else if(command==='import'){
 const state=await importDraft(workspace,{repo:option('--repo'),requestId:option('--request'),folder:option('--draft'),sourceSha:option('--source-sha')});
 console.log(JSON.stringify({saved:true,revision:state.revision,preview:'http://127.0.0.1:4318/'}));
}else if(command==='import-site-covers'){
 if(!option('--manifest'))throw Error('需要 --manifest 指定站点配图清单。');
 const state=await importSiteCovers(workspace,option('--manifest'),{includeProfile:process.argv.includes('--include-profile')});
 console.log(JSON.stringify({saved:true,revision:state.revision,siteCovers:state.projects.filter(p=>p.siteCover).length}));
}else if(['generate-profile','generate-site'].includes(command)){
 const state=await act(workspace,{type:command});console.log(JSON.stringify(state.results[command.slice(9)],null,2));
}else throw Error('支持 request、plan、sync、record-check、import、import-site-covers、generate-profile、generate-site。');
