const $ = id => document.getElementById(id);
const escape = (s = '') => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let state; let config; let tab = 'repos'; let editRepo; let busy = false; let dirty = false; let poll;
async function api(path, data) {
  const response = await fetch(path, data === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  const body = await response.json(); if (!response.ok) throw new Error(body.error || '请求失败，请重试。'); return body;
}
function notice(text, error = false) { $('notice').textContent = text; $('notice').classList.toggle('error', error); $('notice').hidden = !text; }
function markDirty() { dirty = true; $('save').textContent = '保存配置 · 有修改'; }
function repoInfo(repo) { return state.repositories.find(r => r.full_name === repo); }
function projectName(p) { return p.name || repoInfo(p.repo)?.name || p.repo; }
function visibleRepos() {
  const query = $('search').value.toLowerCase(); const visibility = $('visibility').value;
  return state.repositories.filter(r => `${r.name} ${r.description} ${state.existing[r.name]?.name || ''}`.toLowerCase().includes(query) && (visibility === 'all' || (visibility === 'private') === r.private));
}
function renderList() {
  const repos = visibleRepos(); const chosen = new Set(config.projects.map(p => p.repo));
  $('filter-count').textContent = `${repos.length} 个仓库 · 已选 ${chosen.size} 个`;
  $('list-count').textContent = state.repositories.length;
  $('repo-list').innerHTML = repos.map(r => {
    const p = config.projects.find(p => p.repo === r.full_name); const existing = state.existing[r.name];
    const description = p?.description || existing?.description || r.description || '选择后，生成时将读取 README 整理项目介绍';
    return `<div class="repo-row ${chosen.has(r.full_name) ? 'chosen' : ''}"><label class="repo-label"><input type="checkbox" data-repo="${escape(r.full_name)}" aria-label="展示 ${escape(r.name)}" ${chosen.has(r.full_name) ? 'checked' : ''} ${busy ? 'disabled' : ''}><span class="repo-symbol color-${r.name.length % 4}">${escape((existing?.name || r.name).slice(0, 1).toUpperCase())}</span><span class="repo-copy"><span class="repo-title"><strong>${escape(p?.name || existing?.name || r.name)}</strong><span class="visibility">${r.private ? '私有' : '公开'}</span>${r.archived ? '<span class="visibility">归档</span>' : ''}</span><span class="repo-description">${escape(description)}</span><span class="repo-meta"><span class="language-dot lang-${['TypeScript', 'JavaScript', 'Go', 'Swift'].indexOf(r.language)}"></span>${escape(r.language || '未标注')}<span>·</span>${escape(r.name)}<span>·</span>${r.pushed_at ? `更新于 ${new Date(r.pushed_at).toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric' })}` : '更新时间未知'}</span></span></label>${chosen.has(r.full_name) ? `<button class="edit-project" data-edit="${escape(r.full_name)}" aria-label="编辑 ${escape(r.name)}" ${busy ? 'disabled' : ''}>✎</button>` : ''}</div>`;
  }).join('') || '<div class="empty">没有符合条件的仓库。试试其他关键词或筛选条件。</div>';
}
function renderOrdered() {
  $('ordered-count').textContent = config.projects.length;
  $('ordered-list').innerHTML = config.projects.map((p, i) => `<div class="ordered-row"><span class="order-number">${String(i + 1).padStart(2, '0')}</span><div><strong>${escape(projectName(p))}</strong><small>${escape(p.repo)}</small></div><button data-move="${escape(p.repo)}" data-direction="-1" aria-label="上移 ${escape(projectName(p))}" ${i === 0 || busy ? 'disabled' : ''}>↑</button><button data-move="${escape(p.repo)}" data-direction="1" aria-label="下移 ${escape(projectName(p))}" ${i === config.projects.length - 1 || busy ? 'disabled' : ''}>↓</button><button data-edit="${escape(p.repo)}" aria-label="编辑 ${escape(repoInfo(p.repo).name)}" ${busy ? 'disabled' : ''}>✎</button><button data-remove="${escape(p.repo)}" aria-label="移除 ${escape(projectName(p))}" ${busy ? 'disabled' : ''}>×</button></div>`).join('') || '<div class="empty">还没有展示项目。先去项目仓库勾选几个作品吧。</div>';
}
function miniArt(p) {
  const image = state.existing[repoInfo(p.repo)?.name]?.image;
  return image ? `<img src="/project-assets/${escape(image)}" alt="${escape(projectName(p))}">` : escape(projectName(p).slice(0, 2));
}
function renderPreview() {
  const count = config.projects.length;
  $('selected-nav').textContent = count; $('selected-count').textContent = String(count).padStart(2, '0');
  const first = config.projects[0];
  $('mini-site').innerHTML = `<div class="mini-nav"><strong>${escape(config.profile.name || '你的名字')}</strong><span>作品 &nbsp; GitHub ↗</span></div><h3>${escape(config.profile.headline || '把想法，做成小产品。')}</h3><p>${escape(config.profile.bio || '你的个人介绍会出现在这里。')}</p><div class="mini-filters"><span>全部作品 ${count}</span><span>Web</span><span>微信小程序</span></div>${first ? `<div class="mini-featured"><div class="mini-art color-0">${miniArt(first)}</div><div><small>从这个作品开始</small><strong>${escape(projectName(first))}</strong><p>${escape(first.description || '')}</p><span>探索这个项目 ↗</span></div></div>` : ''}<div class="mini-divider"><strong>更多小产品，更多可能</strong></div><div class="mini-cards">${config.projects.slice(1, 4).map((p, i) => `<div><div class="mini-art color-${(i + 1) % 4}">${miniArt(p)}</div><strong>${escape(projectName(p))}</strong><small>${escape(p.platform || repoInfo(p.repo)?.language || 'PRODUCT')}</small></div>`).join('')}</div>${count === 0 ? '<div class="mini-empty">你的第一个作品，会出现在这里。</div>' : ''}`;
  $('selection-summary').innerHTML = `<span>已选择</span><div>${config.projects.slice(0, 3).map(p => `<span class="selected-chip">${escape(projectName(p))}</span>`).join('')}${count > 3 ? `<span class="selected-chip">+${count - 3}</span>` : ''}${count === 0 ? '<small>从左侧勾选项目</small>' : ''}</div>`;
  $('generate').disabled = busy || count === 0; $('save').disabled = busy;
}
function render() { renderList(); renderOrdered(); renderPreview(); }
function fillProfile() { for (const key of ['name', 'headline', 'bio', 'github']) $(`profile-${key}`).value = config.profile[key] || ''; }
function activate(next) {
  tab = next;
  const titles = { repos: ['项目仓库', '让你的项目，被看见', '从 GitHub 选出想展示的作品，生成一个属于你的个人站点。'], selected: ['展示项目', '好作品，也值得好好介绍', '调整展示顺序，让每个项目都有自己的名字和故事。'], profile: ['个人资料', '让作品，带上你的名字', '写下你是谁，以及你正在创造什么。'] };
  $('breadcrumb').textContent = titles[tab][0]; $('page-title').innerHTML = `${escape(titles[tab][1])}<span>。</span>`; $('page-description').textContent = titles[tab][2];
  for (const [key, id] of [['repos', 'repository-view'], ['selected', 'selected-view'], ['profile', 'profile-view']]) $(id).hidden = key !== tab;
  document.querySelectorAll('[data-tab]').forEach(button => button.classList.toggle('active', button.dataset.tab === tab));
  document.querySelectorAll('.step').forEach((step, index) => step.classList.toggle('active', index === (tab === 'profile' ? 1 : 0)));
}
function edit(repo) {
  editRepo = repo; const project = config.projects.find(p => p.repo === repo);
  for (const key of ['name', 'description', 'url', 'platform']) $(`edit-${key}`).value = project[key] || '';
  $('edit-dialog').showModal();
}
function applyStatus() {
  busy = state.job.status === 'running';
  $('generate').innerHTML = busy ? '<span class="spinner"></span> 正在生成…' : '生成个人站点 <span>↗</span>';
  $('job-status').textContent = state.job.message || (state.result ? `上次生成 ${new Date(state.result.generatedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}` : '读取所选仓库的 README，整理成站点');
  $('job-status').classList.toggle('error-text', state.job.status === 'error');
  $('open-preview').hidden = !state.result;
  $('refresh').disabled = busy || state.refreshing;
  for (const key of ['name', 'headline', 'bio', 'github']) $(`profile-${key}`).disabled = busy;
  render();
}
async function pollState() {
  try {
    state = await api('/api/state'); updateMetadata(); applyStatus();
    $('connection').textContent = state.connectionError ? '缓存数据 · 同步失败' : state.refreshing ? '正在同步仓库…' : 'GitHub 已连接';
    if (state.job.status !== 'running' && !state.refreshing) { clearInterval(poll); poll = null; }
  } catch (error) { clearInterval(poll); poll = null; busy = false; notice(error.message, true); }
}
function startPolling() { if (!poll) poll = setInterval(pollState, 1000); }
document.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click', () => activate(button.dataset.tab)));
$('search').addEventListener('input', renderList); $('visibility').addEventListener('change', renderList);
$('repo-list').addEventListener('change', event => {
  const repo = event.target.dataset.repo; if (!repo) return;
  if (event.target.checked) config.projects.push({ repo, name: '', description: '', url: '', platform: '', ...(state.existing[repoInfo(repo).name] || {}) });
  else config.projects = config.projects.filter(p => p.repo !== repo);
  markDirty(); render();
});
document.addEventListener('click', event => {
  const button = event.target.closest('button'); if (!button || busy) return;
  if (button.dataset.edit) edit(button.dataset.edit);
  if (button.dataset.remove) { config.projects = config.projects.filter(p => p.repo !== button.dataset.remove); markDirty(); render(); }
  if (button.dataset.move) { const i = config.projects.findIndex(p => p.repo === button.dataset.move); const target = i + Number(button.dataset.direction); if (target < 0 || target >= config.projects.length) return; [config.projects[i], config.projects[target]] = [config.projects[target], config.projects[i]]; markDirty(); render(); }
});
$('select-visible').addEventListener('click', () => {
  if (busy) return;
  for (const r of visibleRepos()) if (!config.projects.some(p => p.repo === r.full_name)) config.projects.push({ repo: r.full_name, name: '', description: '', url: '', platform: '', ...(state.existing[r.name] || {}) });
  markDirty(); render();
});
for (const key of ['name', 'headline', 'bio', 'github']) $(`profile-${key}`).addEventListener('input', event => { config.profile[key] = event.target.value; markDirty(); renderPreview(); });
$('close-dialog').addEventListener('click', () => $('edit-dialog').close());
$('edit-form').addEventListener('submit', event => {
  event.preventDefault(); const project = config.projects.find(p => p.repo === editRepo);
  for (const key of ['name', 'description', 'url', 'platform']) project[key] = $(`edit-${key}`).value.trim();
  markDirty(); render(); $('edit-dialog').close();
});
$('save').addEventListener('click', async () => {
  $('save').disabled = true;
  try { await api('/api/config', config); dirty = false; $('save').textContent = '保存配置'; notice('配置已保存。下次打开会恢复你的选择和修改。'); } catch (error) { notice(error.message, true); } finally { $('save').disabled = busy; }
});
$('generate').addEventListener('click', async () => {
  busy = true; render(); notice('');
  try { await api('/api/generate', config); dirty = false; $('save').textContent = '保存配置'; state.job = { status: 'running', message: '准备读取所选项目…' }; applyStatus(); startPolling(); }
  catch (error) { busy = false; notice(error.message, true); render(); }
});
$('refresh').addEventListener('click', async () => {
  $('refresh').disabled = true; $('refresh').textContent = '同步中…';
  try { await api('/api/refresh', {}); state = await api('/api/state'); notice(`已从 GitHub 同步 ${state.repositories.length} 个仓库。`); updateMetadata(); render(); }
  catch (error) { notice(error.message, true); } finally { $('refresh').disabled = busy; $('refresh').innerHTML = '<span>↻</span> 同步仓库'; }
});
function updateMetadata() {
  $('repo-count').textContent = state.repositories.length;
  $('account').textContent = state.repositories[0]?.full_name.split('/')[0] || 'GitHub';
  $('synced-at').textContent = state.fetchedAt ? `从 GitHub 同步 · ${new Date(state.fetchedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}` : '尚未同步，点击同步仓库重试';
  $('connection').textContent = state.connectionError ? '缓存数据 · 同步失败' : state.refreshing ? '正在同步仓库…' : 'GitHub 已连接';
}
async function init() {
  try {
    state = await api('/api/state');
    if (state.refreshing && !state.repositories.length) {
      const wait = setInterval(async () => { try { const next = await api('/api/state'); if (!next.refreshing) { clearInterval(wait); init(); } } catch (e) { clearInterval(wait); notice(e.message, true); } }, 1000); return;
    }
    config = state.config; fillProfile(); updateMetadata(); applyStatus();
    if (state.connectionError) notice(state.connectionError, true);
    else if (!state.saved && config.projects.length) notice(`已带入当前站点的 ${config.projects.length} 个项目。你可以取消勾选或加入新的作品。`);
    if (state.refreshing || state.job.status === 'running') startPolling();
  } catch (error) { notice(error.message, true); $('generate').disabled = true; $('save').disabled = true; }
}
init();
