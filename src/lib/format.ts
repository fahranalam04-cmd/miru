import type { Media } from '../api/anilist';

export const title = (m: Media) => m.title.english || m.title.romaji;
export const crowd = (m: Media) => (m.averageScore ? m.averageScore / 10 : null);
export const fmtScore = (n: number | null | undefined) => (n == null ? '—' : Number.isInteger(n) ? String(n) : n.toFixed(1));
export const art = (m: Media) => m.bannerImage || m.coverImage.extraLarge;
export const studio = (m: Media) => m.studios.nodes[0]?.name ?? '';

export function countdown(airingAt: number): string {
  const s = Math.max(0, airingAt - Date.now() / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), min = Math.floor((s % 3600) / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${min}m` : `${min}m`;
}

export const KANJI_NUM = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
export const pad2 = (n: number) => String(n).padStart(2, '0');

export function currentSeason(d = new Date()): { season: string; year: number } {
  const seasons = ['WINTER', 'WINTER', 'WINTER', 'SPRING', 'SPRING', 'SPRING', 'SUMMER', 'SUMMER', 'SUMMER', 'FALL', 'FALL', 'FALL'];
  return { season: seasons[d.getMonth()], year: d.getFullYear() };
}

export const isAired = (m: Media) => m.status === 'FINISHED' || m.status === 'RELEASING';

// Native title for the vertical ink column: first phrase, shrunk to fit the panel height.
export function verticalTitle(native: string | null | undefined): { text: string; size: number } {
  const text = (native ?? '').split(/[\s　:：]/)[0].slice(0, 14);
  return { text, size: Math.max(16, Math.min(34, Math.floor(330 / Math.max(1, text.length)))) };
}
