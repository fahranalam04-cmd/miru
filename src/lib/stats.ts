import type { Media } from '../api/anilist';
import { peek } from './cache';
import type { Show } from './derive';
import { crowd, title } from './format';
import type { Entry } from './store';

export interface Stats {
  shows: number;
  seasons: number;
  episodes: number;
  hours: number;
  genres: [string, number][];
  studios: [string, number][];
  histogram: number[]; // index 0 → score 1
  yourAvg: number | null;
  crowdAvg: number | null;
  hottest: { media: Media; you: number; crowd: number } | null;
  best: { media: Media; you: number } | null;
}

export function computeStats(shows: Show[], entries: Record<number, Entry>): Stats {
  const watched = Object.entries(entries)
    .filter(([, e]) => e.status === 'watched' || e.status === 'watching')
    .map(([id, e]) => ({ m: peek(Number(id)), e }))
    .filter((x): x is { m: Media; e: Entry } => !!x.m);

  const done = watched.filter(x => x.e.status === 'watched');
  const episodes = done.reduce((a, x) => a + (x.m.episodes ?? 0), 0);
  const minutes = done.reduce((a, x) => a + (x.m.episodes ?? 0) * (x.m.duration ?? 24), 0);

  const tally = (keys: (x: { m: Media }) => string[]) => {
    const c: Record<string, number> = {};
    for (const x of watched) for (const k of keys(x)) c[k] = (c[k] ?? 0) + 1;
    return Object.entries(c).sort((a, b) => b[1] - a[1]);
  };

  const rated = Object.entries(entries)
    .filter(([, e]) => e.score != null)
    .map(([id, e]) => ({ m: peek(Number(id)), you: e.score! }))
    .filter((x): x is { m: Media; you: number } => !!x.m);

  const histogram = Array(10).fill(0);
  for (const r of rated) histogram[Math.min(10, Math.max(1, Math.round(r.you))) - 1]++;

  const withCrowd = rated.filter(r => crowd(r.m) != null).map(r => ({ ...r, crowd: crowd(r.m)! }));
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const hottest = withCrowd.sort((a, b) => Math.abs(b.you - b.crowd) - Math.abs(a.you - a.crowd))[0];
  const best = [...rated].sort((a, b) => b.you - a.you || title(a.m).localeCompare(title(b.m)))[0];

  return {
    shows: shows.filter(s => s.status !== 'planned').length,
    seasons: done.length,
    episodes,
    hours: minutes / 60,
    genres: tally(x => x.m.genres).slice(0, 8),
    studios: tally(x => x.m.studios.nodes.slice(0, 1).map(s => s.name)).slice(0, 5),
    histogram,
    yourAvg: avg(rated.map(r => r.you)),
    crowdAvg: avg(withCrowd.map(r => r.crowd)),
    hottest: hottest && Math.abs(hottest.you - hottest.crowd) >= 0.5 ? { media: hottest.m, you: hottest.you, crowd: hottest.crowd } : null,
    best: best ? { media: best.m, you: best.you } : null,
  };
}
