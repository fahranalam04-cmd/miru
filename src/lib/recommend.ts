// Recommendations. Two signals combined:
//  1. AniList's community "if you liked X" links, taken from your highest-rated shows and weighted by your score.
//  2. A taste profile: genres you rate above your own average push a pick up, ones you rate below push it down.
import { fetchRecommendations, fetchSeasonal, fetchTopRated, type Media, type RecNode } from '../api/anilist';
import { putMedia } from './cache';
import type { Show } from './derive';
import { currentSeason, title } from './format';

export interface Pick { media: Media; score: number; because: string | null; match: number }

const REC_KEY = 'miru:recs:v1';
const DAY = 86400_000;

function cached<T>(key: string, ttl: number, load: () => Promise<T>): Promise<T> {
  let all: Record<string, { t: number; v: T }> = {};
  try { all = JSON.parse(localStorage.getItem(REC_KEY) || '{}'); } catch {}
  const hit = all[key];
  if (hit && Date.now() - hit.t < ttl) return Promise.resolve(hit.v);
  return load().then(v => {
    all[key] = { t: Date.now(), v };
    try { localStorage.setItem(REC_KEY, JSON.stringify(all)); } catch {}
    return v;
  });
}

const showScore = (s: Show) => s.avg ?? (s.status === 'dropped' ? 3 : 7);

export function tasteProfile(shows: Show[]): Record<string, number> {
  const tracked = shows.filter(s => s.status !== 'planned');
  if (!tracked.length) return {};
  const mean = tracked.reduce((a, s) => a + showScore(s), 0) / tracked.length;
  const p: Record<string, number> = {};
  for (const s of tracked) {
    const w = showScore(s) - mean + 0.6; // +0.6: watching something at all is a mild vote for it
    for (const g of s.first.genres) p[g] = (p[g] ?? 0) + w;
  }
  const max = Math.max(...Object.values(p).map(Math.abs), 1);
  for (const g in p) p[g] /= max;
  return p;
}

const affinity = (p: Record<string, number>, m: Media) =>
  m.genres.length ? m.genres.reduce((a, g) => a + (p[g] ?? 0), 0) / m.genres.length : 0;

// A later season of something (it has a TV prequel) shouldn't be recommended on its own.
const isSequel = (m: Media) => m.relations.edges.some(e => e.relationType === 'PREQUEL' && ['TV', 'TV_SHORT', 'ONA'].includes(e.node.format ?? ''));
const touchesOwned = (m: Media, owned: Set<number>) => owned.has(m.id) || m.relations.edges.some(e => owned.has(e.node.id));

// Sort, then spread raw scores into a readable 60–98% "match", relative to the best pick in the list.
function ranked(picks: Omit<Pick, 'match'>[]): Pick[] {
  picks.sort((a, b) => b.score - a.score);
  const hi = picks[0]?.score ?? 0, lo = picks[picks.length - 1]?.score ?? 0;
  return picks.map(p => ({ ...p, match: Math.round(60 + 38 * (hi === lo ? 1 : (p.score - lo) / (hi - lo))) }));
}

export async function recommend(shows: Show[], owned: Set<number>): Promise<Pick[]> {
  const profile = tasteProfile(shows);
  const sources = shows
    .filter(s => s.status !== 'planned' && showScore(s) >= 7)
    .sort((a, b) => showScore(b) - showScore(a) || b.updatedAt - a.updatedAt)
    .slice(0, 8);

  if (!sources.length) {
    const top = await cached('top', DAY, fetchTopRated);
    putMedia(top);
    return ranked(top.filter(m => !touchesOwned(m, owned) && !isSequel(m)).slice(0, 12)
      .map(m => ({ media: m, score: (m.averageScore ?? 0) / 10 + affinity(profile, m), because: null })));
  }

  const pool = new Map<number, { m: Media; s: number; because: Map<string, number> }>();
  for (const src of sources) {
    let nodes: RecNode[] = [];
    try { nodes = await cached(`r${src.first.id}`, DAY, () => fetchRecommendations(src.first.id)); } catch { continue; }
    for (const n of nodes) {
      const m = n.mediaRecommendation;
      if (!m || touchesOwned(m, owned) || isSequel(m) || m.genres.includes('Hentai')) continue;
      const w = ((showScore(src) - 5) / 5) * Math.log2(2 + Math.max(0, n.rating));
      const p = pool.get(m.id) ?? { m, s: 0, because: new Map() };
      p.s += w;
      p.because.set(title(src.first), (p.because.get(title(src.first)) ?? 0) + w);
      pool.set(m.id, p);
    }
  }

  return ranked([...pool.values()].map(p => ({
    media: p.m,
    score: p.s + affinity(profile, p.m) * 2.5 + ((p.m.averageScore ?? 65) - 72) / 8,
    because: [...p.because.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
  }))).slice(0, 18);
}

// "If you like this show" strip on a show page.
export async function similarTo(id: number, owned: Set<number>): Promise<Media[]> {
  const nodes = await cached(`r${id}`, DAY, () => fetchRecommendations(id));
  return nodes
    .map(n => n.mediaRecommendation)
    .filter((m): m is Media => !!m && !isSequel(m) && !owned.has(m.id) && !m.genres.includes('Hentai'))
    .slice(0, 10);
}

export async function seasonalForYou(shows: Show[], owned: Set<number>): Promise<Pick[]> {
  const { season, year } = currentSeason();
  const list = await cached(`s${season}${year}`, DAY / 4, () => fetchSeasonal(season, year));
  const profile = tasteProfile(shows);
  return ranked(list
    .filter(m => !touchesOwned(m, owned))
    .map(m => ({ media: m, score: affinity(profile, m) * 3 + ((m.averageScore ?? 65) - 65) / 6, because: null })));
}
