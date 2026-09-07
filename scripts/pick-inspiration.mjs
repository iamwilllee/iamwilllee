import { randomBytes, randomInt } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));

export const SOURCES = [
  { id: 'siteinspire', label: 'SiteInspire', pageMin: 2, pageMax: 24, positionMin: 2, positionMax: 31, url: (page) => `https://www.siteinspire.com/websites?page=${page}` },
  { id: 'godly', label: 'Godly', pageMin: 2, pageMax: 20, positionMin: 2, positionMax: 24, url: (page) => `https://godly.website/websites?page=${page}` },
  { id: 'awwwards', label: 'Awwwards', pageMin: 2, pageMax: 30, positionMin: 2, positionMax: 24, url: (page) => `https://www.awwwards.com/websites/?page=${page}` },
  { id: 'onepagelove', label: 'One Page Love', pageMin: 2, pageMax: 25, positionMin: 2, positionMax: 24, url: (page) => `https://onepagelove.com/inspiration?page=${page}` },
];

export function chooseDraw({ sources = SOURCES, recentSources = [], randomIntFn = randomInt, seed = randomBytes(8).toString('hex') } = {}) {
  const eligible = sources.filter(({ id }) => !recentSources.includes(id));
  const pool = eligible.length ? eligible : sources;
  const source = pool[randomIntFn(pool.length)];
  const page = randomIntFn(source.pageMin, source.pageMax + 1);
  const position = randomIntFn(source.positionMin, source.positionMax + 1);
  return {
    seed,
    source: source.id,
    sourceLabel: source.label,
    page,
    position,
    listingUrl: source.url(page),
  };
}

async function recentSources() {
  try {
    const history = JSON.parse(await readFile(join(repositoryRoot, 'portfolio', 'history', 'versions.json'), 'utf8'));
    return history.versions.slice(0, 2).map(({ source }) => source);
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function main() {
  console.log(JSON.stringify(chooseDraw({ recentSources: await recentSources() }), null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
