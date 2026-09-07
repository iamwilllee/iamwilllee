import { createHash } from 'node:crypto';
import { access, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));

export function dateInShanghai(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function parseDateArgument(argv, fallback = dateInShanghai()) {
  const inline = argv.find((argument) => argument.startsWith('--date='));
  const dateFlag = argv.indexOf('--date');
  const date = inline?.slice('--date='.length) || (dateFlag >= 0 ? argv[dateFlag + 1] : fallback);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) {
    throw new Error(`Invalid archive date: ${date || '(missing)'}`);
  }
  return date;
}

export function rewriteSnapshotHtml(html, assetPaths) {
  const rewrittenAssets = new Map(assetPaths.map(({ original, archived }) => [original, `../assets/${archived}`]));
  let output = html
    .replace('href="css/style.css"', 'href="style.css"')
    .replace('src="js/theme.js"', 'src="theme.js"')
    .replace('class="history-link" href="history/"', 'class="history-link" href="../"')
    .replace('<head>', '<head>\n  <meta name="robots" content="noindex">');

  for (const [original, archived] of rewrittenAssets) {
    output = output.replaceAll(`"${original}"`, `"${archived}"`);
  }

  return output;
}

export function upsertVersion(registry, entry) {
  const versions = [...(registry.versions || []).filter((version) => version.date !== entry.date), entry]
    .sort((left, right) => right.date.localeCompare(left.date));
  return { versions };
}

function collectLocalAssets(html) {
  const matches = html.matchAll(/(?:src|href)="((?:assets\/[^"?#]+)|favicon\.svg)"/g);
  return [...new Set([...matches].map((match) => match[1]))];
}

async function archiveAssets(portfolioRoot, historyRoot, html) {
  const assetRoot = join(historyRoot, 'assets');
  await mkdir(assetRoot, { recursive: true });

  return Promise.all(collectLocalAssets(html).map(async (original) => {
    const source = join(portfolioRoot, original);
    const content = await readFile(source);
    const hash = createHash('sha256').update(content).digest('hex').slice(0, 20);
    const archived = `${hash}${extname(original)}`;
    const destination = join(assetRoot, archived);
    try {
      await access(destination);
    } catch {
      await writeFile(destination, content);
    }
    return { original, archived };
  }));
}

async function readRegistry(historyRoot) {
  try {
    return JSON.parse(await readFile(join(historyRoot, 'versions.json'), 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return { versions: [] };
    throw error;
  }
}

function versionEntry(date, manifest) {
  return {
    date,
    title: manifest.reference?.name || 'Daily homepage',
    concept: (manifest.interpretation || []).join(' · '),
    source: manifest.random?.source || 'unknown',
    referenceUrl: manifest.reference?.websiteUrl || manifest.reference?.galleryUrl || '',
    galleryUrl: manifest.reference?.galleryUrl || '',
    seed: manifest.random?.seed || '',
    path: `./${date}/`,
  };
}

export async function archivePortfolio({ root = repositoryRoot, date = dateInShanghai() } = {}) {
  const portfolioRoot = join(root, 'portfolio');
  const historyRoot = join(portfolioRoot, 'history');
  const versionRoot = join(historyRoot, date);
  const html = await readFile(join(portfolioRoot, 'index.html'), 'utf8');
  const manifest = JSON.parse(await readFile(join(portfolioRoot, 'design-manifest.json'), 'utf8'));
  const assetPaths = await archiveAssets(portfolioRoot, historyRoot, html);

  await mkdir(versionRoot, { recursive: true });
  await writeFile(join(versionRoot, 'index.html'), rewriteSnapshotHtml(html, assetPaths));
  await copyFile(join(portfolioRoot, 'css', 'style.css'), join(versionRoot, 'style.css'));
  await copyFile(join(portfolioRoot, 'js', 'theme.js'), join(versionRoot, 'theme.js'));
  await writeFile(join(versionRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

  const registry = upsertVersion(await readRegistry(historyRoot), versionEntry(date, manifest));
  await writeFile(join(historyRoot, 'versions.json'), `${JSON.stringify(registry, null, 2)}\n`);
  return registry;
}

async function assertExists(path) {
  try {
    await access(path);
  } catch {
    throw new Error(`Missing history file: ${relative(repositoryRoot, path)}`);
  }
}

export async function checkHistory({ root = repositoryRoot } = {}) {
  const historyRoot = join(root, 'portfolio', 'history');
  const registry = await readRegistry(historyRoot);
  if (!registry.versions?.length) throw new Error('History has no archived versions.');

  const dates = registry.versions.map(({ date }) => date);
  if (new Set(dates).size !== dates.length) throw new Error('History contains duplicate dates.');
  if ([...dates].sort().reverse().join() !== dates.join()) throw new Error('History is not newest-first.');

  for (const version of registry.versions) {
    const versionRoot = join(historyRoot, version.date);
    await Promise.all(['index.html', 'style.css', 'theme.js', 'manifest.json'].map((name) => assertExists(join(versionRoot, name))));
    const html = await readFile(join(versionRoot, 'index.html'), 'utf8');
    const archivedAssets = [...html.matchAll(/(?:src|href)="\.\.\/assets\/([^"?#]+)"/g)].map((match) => match[1]);
    await Promise.all(archivedAssets.map((name) => assertExists(join(historyRoot, 'assets', name))));
  }

  return registry;
}

async function main() {
  if (process.argv.includes('--check')) {
    const registry = await checkHistory();
    console.log(`History is valid (${registry.versions.length} version${registry.versions.length === 1 ? '' : 's'}).`);
    return;
  }
  const date = parseDateArgument(process.argv.slice(2));
  const registry = await archivePortfolio({ date });
  console.log(`Archived portfolio ${date} (${registry.versions.length} total).`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
