// Media cache: memory + localStorage, refetched from AniList once an entry is older than its max age.
import { fetchMediaBatch, type Media } from '../api/anilist';

const KEY = 'miru:media:v1';
export const MEDIA_TTL = 12 * 3600_000;

type Cached = { m: Media; t: number };
const mem = new Map<number, Cached>();
const listeners = new Set<() => void>();

try {
  const raw = JSON.parse(localStorage.getItem(KEY) || '{}') as Record<string, Cached>;
  for (const [k, v] of Object.entries(raw)) mem.set(Number(k), v);
} catch { /* storage unavailable: ignore */ }

let saveTimer: ReturnType<typeof setTimeout> | undefined;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(mem)));
    } catch {
      // Over quota: drop the oldest half and try once more.
      [...mem.entries()].sort((a, b) => a[1].t - b[1].t).slice(0, mem.size / 2).forEach(([id]) => mem.delete(id));
      try { localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(mem))); } catch { /* storage unavailable: ignore */ }
    }
  }, 400);
}

function cleanDescription(d: string | null): string | null {
  if (!d) return d;
  const text = d.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/\(Source:[^)]*\)/gi, '').replace(/\n{2,}/g, '\n').trim();
  return text.length > 700 ? text.slice(0, 700).replace(/\s+\S*$/, '') + '…' : text;
}

export function onMediaChange(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function peek(id: number): Media | undefined {
  return mem.get(id)?.m;
}

export function putMedia(list: Media[]) {
  const t = Date.now();
  for (const m of list) mem.set(m.id, { m: { ...m, description: cleanDescription(m.description) }, t });
  persist();
  listeners.forEach(fn => fn());
}

export async function getMany(ids: number[], maxAge = MEDIA_TTL): Promise<Media[]> {
  const now = Date.now();
  const need = [...new Set(ids)].filter(id => {
    const c = mem.get(id);
    return !c || now - c.t > maxAge;
  });
  if (need.length) {
    try {
      putMedia(await fetchMediaBatch(need));
    } catch (e) {
      // Stale data beats no data; only fail when we have nothing to show.
      if (need.some(id => !mem.has(id))) throw e;
    }
  }
  return ids.map(id => mem.get(id)?.m).filter((m): m is Media => !!m);
}
