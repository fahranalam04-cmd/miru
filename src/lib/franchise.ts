// Groups AniList entries into shows. AniList stores every season as its own entry, linked by
// PREQUEL/SEQUEL relations; we walk those links and treat each connected chain as one show.
import type { Media } from '../api/anilist';
import { getMany, peek } from './cache';

export interface Franchise {
  id: number; // first season's media id
  seasons: number[]; // TV / TV_SHORT / ONA entries, oldest first
  movies: number[];
  resolvedAt: number;
}

const KEY = 'miru:franchises:v1';
const MAIN = new Set(['TV', 'TV_SHORT', 'ONA']);
const LINKABLE = new Set([...MAIN, 'MOVIE']);

let franchises: Record<number, Franchise> = {};
let memberOf: Record<number, number> = {};
const listeners = new Set<() => void>();

try {
  const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
  if (raw) ({ franchises, memberOf } = raw);
} catch {}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify({ franchises, memberOf })); } catch {}
  listeners.forEach(fn => fn());
}

export const onFranchiseChange = (fn: () => void) => {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
};

export const franchiseOf = (mediaId: number): Franchise | undefined => franchises[memberOf[mediaId]];
export const allFranchises = () => franchises;

export const isMainFormat = (m: Media) => MAIN.has(m.format ?? '');

function links(m: Media): number[] {
  return m.relations.edges
    .filter(e => (e.relationType === 'PREQUEL' || e.relationType === 'SEQUEL') && e.node.type === 'ANIME' && LINKABLE.has(e.node.format ?? ''))
    .map(e => e.node.id);
}

const dateKey = (m: Media) => {
  const d = m.startDate;
  return d.year ? d.year * 10000 + (d.month ?? 12) * 100 + (d.day ?? 28) : Number.MAX_SAFE_INTEGER;
};

// Breadth-first over sequel/prequel links, one batched request per "ring" of the graph.
export async function resolveFranchises(ids: number[], maxAge?: number): Promise<void> {
  const seen = new Set<number>();
  let frontier = [...new Set(ids)];
  for (let round = 0; frontier.length && round < 25 && seen.size < 3000; round++) {
    frontier.forEach(id => seen.add(id));
    const media = await getMany(frontier, maxAge);
    const next = new Set<number>();
    for (const m of media) for (const id of links(m)) if (!seen.has(id)) next.add(id);
    frontier = [...next];
  }

  const parent = new Map<number, number>();
  const find = (x: number): number => {
    while (parent.get(x) !== x) {
      parent.set(x, parent.get(parent.get(x)!)!);
      x = parent.get(x)!;
    }
    return x;
  };
  const reached = [...seen].filter(id => peek(id));
  reached.forEach(id => parent.set(id, id));
  for (const id of reached) for (const l of links(peek(id)!)) if (parent.has(l)) parent.set(find(id), find(l));

  const groups = new Map<number, Media[]>();
  for (const id of reached) {
    const root = find(id);
    groups.set(root, [...(groups.get(root) ?? []), peek(id)!]);
  }

  const now = Date.now();
  for (const members of groups.values()) {
    members.sort((a, b) => dateKey(a) - dateKey(b));
    let seasons = members.filter(isMainFormat).map(m => m.id);
    let movies = members.filter(m => m.format === 'MOVIE').map(m => m.id);
    if (!seasons.length) { seasons = members.map(m => m.id); movies = []; }
    const f: Franchise = { id: seasons[0], seasons, movies, resolvedAt: now };
    for (const id of [...seasons, ...movies]) {
      const old = memberOf[id];
      if (old !== undefined && old !== f.id) delete franchises[old];
      memberOf[id] = f.id;
    }
    franchises[f.id] = f;
  }
  save();
}
