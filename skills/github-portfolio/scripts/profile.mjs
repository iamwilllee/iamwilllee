import { escapeHtml as e, safeUrl } from '../../portfolio-builder/scripts/core.mjs';

// Presentation belongs to the Profile; it never changes the website selection or copy.
export function profileLayout(repos, input = {}) {
 const featured = input.featuredRepos ?? repos.slice(0, 4);
 if (!Array.isArray(featured) || featured.length > 4 || new Set(featured).size !== featured.length || featured.some(repo => !repos.includes(repo))) {
  throw Error('Profile 最多精选 4 个已选项目，且不能重复。');
 }
 const entries = {};
 for (const repo of repos) {
  const entry = input.entries?.[repo] || {};
  for (const [key, max] of [['group', 40], ['summary', 80]]) {
   if (entry[key] !== undefined && (typeof entry[key] !== 'string' || entry[key].length > max || /[\r\n]/.test(entry[key]))) throw Error('Profile 分类或短介绍格式不正确。');
  }
  entries[repo] = { group: entry.group?.trim() || '更多作品', summary: entry.summary?.trim() || '' };
 }
 return { featuredRepos: featured, entries };
}

export function renderProfile(profile, projects, input) {
 const layout = profileLayout(projects.map(p => p.repo), input);
 const featured = projects.filter(p => layout.featuredRepos.includes(p.repo));
 const cell = p => {
  const summary = layout.entries[p.repo].summary || p.description;
  return `<td width="50%" valign="top">\n${p.image ? `<a href="${e(p.url)}"><img src="${e(p.image)}" alt="${e(p.name)} · 项目概念配图" width="360"></a>\n` : ''}<h3><a href="${e(p.url)}">${e(p.name)}</a></h3>\n<p>${e(summary)}</p>\n<sub>${e(p.platform || '独立作品')}</sub>\n</td>`;
 };
 const rows = [];
 for (let i = 0; i < featured.length; i += 2) rows.push(`<tr>\n${featured.slice(i, i + 2).map(cell).join('\n')}\n${i + 1 === featured.length ? '<td width="50%"></td>\n' : ''}</tr>`);
 const groups = new Map();
 for (const p of projects.filter(p => !layout.featuredRepos.includes(p.repo))) {
  const group = layout.entries[p.repo].group;
  if (!groups.has(group)) groups.set(group, []);
  groups.get(group).push(p);
 }
 const links = [...groups].map(([name, items]) => `<p><b>${e(name)}</b><br>\n${items.map(p => `<a href="${e(p.url)}">${e(p.name)}</a>`).join(' · ')}\n</p>`).join('\n\n');
 const website = safeUrl(profile.website);
 const navigation = [website && `[个人站点 ↗](${website})`, safeUrl(profile.github) && `[GitHub](${safeUrl(profile.github)})`].filter(Boolean).join(' · ');
 return `# ${e(profile.name)}\n\n**${e(profile.headline)}**\n\n${e(profile.bio)}\n\n${navigation}\n\n${rows.length ? `## 精选作品\n\n<table>\n${rows.join('\n')}\n</table>\n\n` : ''}${links ? `## 也在做这些\n\n${links}\n\n` : ''}${website ? `[浏览完整作品集 →](${website})\n` : ''}`;
}
