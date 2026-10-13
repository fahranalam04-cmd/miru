// Turns raw per-season entries into "shows" with a current season, overall status and badges.
import type { Media } from '../api/anilist';
import { peek } from './cache';
import { allFranchises, franchiseOf, type Franchise } from './franchise';
import { isAired } from './format';
import type { Entry } from './store';

export type ShowStatus = 'watching' | 'completed' | 'planned' | 'dropped';
export type Badge = { kind: 'airing' | 'new' | 'more' | 'announced'; label: string } | null;

export interface Show {
  f: Franchise;
  seasons: Media[];
  movies: Media[];
  first: Media;
  current: Media | null; // the season you're on (or should start next); null when caught up
  currentIndex: number;
  status: ShowStatus;
  avg: number | null;
  seasonsWatched: number;
  badge: Badge;
  updatedAt: number;
}

export function buildShow(f: Franchise, entries: Record<number, Entry>): Show | null {
  const seasons = f.seasons.map(peek).filter((m): m is Media => !!m);
  const movies = f.movies.map(peek).filter((m): m is Media => !!m);
  if (!seasons.length) return null;

  const marks = seasons.map(s => entries[s.id]?.status);
  const lastWatched = marks.lastIndexOf('watched');
  let currentIndex = marks.lastIndexOf('watching');
  if (currentIndex < 0) {
    currentIndex = seasons.findIndex((s, i) => i > lastWatched && marks[i] !== 'watched' && marks[i] !== 'dropped' && isAired(s));
  }

  const marked = marks.filter(Boolean);
  let status: ShowStatus;
  if (marks.includes('watching')) status = 'watching';
  else if (marked.length && marked.every(m => m === 'planned')) status = 'planned';
  else if (marks[marks.findLastIndex(Boolean)] === 'dropped') status = 'dropped';
  else status = 'completed';

  // Something after your last watched season that you haven't touched yet?
  let badge: Badge = null;
  if (status === 'completed' && lastWatched >= 0) {
    const next = seasons.slice(lastWatched + 1).find((_, i) => !marks[lastWatched + 1 + i]);
    if (next) {
      const start = next.startDate.year ? new Date(next.startDate.year, (next.startDate.month ?? 1) - 1, next.startDate.day ?? 1).getTime() : 0;
      if (next.status === 'RELEASING') badge = { kind: 'airing', label: 'NEW SEASON AIRING' };
      else if (next.status === 'FINISHED' && Date.now() - start < 200 * 86400_000) badge = { kind: 'new', label: 'NEW SEASON!' };
      else if (next.status === 'FINISHED') badge = { kind: 'more', label: `S${seasons.indexOf(next) + 1} READY` };
      else badge = { kind: 'announced', label: 'SEQUEL ANNOUNCED' };
    }
  }

  const all = [...seasons, ...movies];
  const scores = all.map(m => entries[m.id]?.score).filter((s): s is number => s != null);
  return {
    f,
    seasons,
    movies,
    first: seasons[0],
    current: currentIndex >= 0 ? seasons[currentIndex] : null,
    currentIndex,
    status,
    avg: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
    seasonsWatched: marks.filter(m => m === 'watched').length,
    badge,
    updatedAt: Math.max(0, ...all.map(m => entries[m.id]?.updatedAt ?? 0)),
  };
}

// Every show with at least one tracked season or movie. Entries we haven't grouped yet show up alone.
export function library(entries: Record<number, Entry>): Show[] {
  const seen = new Set<number>();
  const shows: Show[] = [];
  for (const key of Object.keys(entries)) {
    const id = Number(key);
    const f = franchiseOf(id) ?? { id, seasons: [id], movies: [], resolvedAt: 0 };
    if (seen.has(f.id)) continue;
    seen.add(f.id);
    const s = buildShow(f, entries);
    if (s) shows.push(s);
  }
  return shows.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function showFor(mediaId: number, entries: Record<number, Entry>): Show | null {
  const f = franchiseOf(mediaId) ?? allFranchises()[mediaId];
  return f ? buildShow(f, entries) : null;
}

export function ownedIds(shows: Show[], entries: Record<number, Entry>): Set<number> {
  const ids = new Set(Object.keys(entries).map(Number));
  for (const s of shows) [...s.f.seasons, ...s.f.movies].forEach(id => ids.add(id));
  return ids;
}
