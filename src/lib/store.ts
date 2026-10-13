// App state: your per-season entries, the signed-in AniList user, and toasts.
// Signed out, entries live in localStorage. Signed in, AniList is the source of truth and
// localStorage is only a fast-start cache.
import { useSyncExternalStore } from 'react';
import * as al from '../api/anilist';
import { ANILIST_CLIENT_ID } from '../config';
import { onMediaChange, peek, putMedia } from './cache';
import { franchiseOf, onFranchiseChange, resolveFranchises } from './franchise';

export type Status = 'watched' | 'watching' | 'planned' | 'dropped';
export interface Entry {
  status: Status;
  score: number | null;
  updatedAt: number;
  listId?: number; // AniList list-entry id once saved there
  dirty?: boolean; // changed locally, not yet saved to AniList
}
export interface User { id: number; name: string; avatar: string }
export interface Toast { id: number; text: string; kind: 'ok' | 'err' }

interface State {
  entries: Record<number, Entry>;
  user: User | null;
  busy: string | null;
  toast: Toast | null;
  tick: number; // bumps when cached media or show groupings change
}

const TOKEN_KEY = 'miru:token';
const USER_KEY = 'miru:user';
const entriesKey = (u: User | null) => `miru:entries:${u ? u.id : 'local'}`;

function loadEntries(u: User | null): Record<number, Entry> {
  try { return JSON.parse(localStorage.getItem(entriesKey(u)) || '{}'); } catch { return {}; }
}

let state: State = { entries: loadEntries(null), user: null, busy: null, toast: null, tick: 0 };
const subs = new Set<() => void>();

function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  subs.forEach(fn => fn());
}
function saveEntries() {
  try { localStorage.setItem(entriesKey(state.user), JSON.stringify(state.entries)); } catch {}
}

const bump = () => set({ tick: state.tick + 1 });
onMediaChange(bump);
onFranchiseChange(bump);

export const getState = () => state;
export function useStore(): State {
  return useSyncExternalStore(
    fn => { subs.add(fn); return () => { subs.delete(fn); }; },
    () => state,
  );
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function toast(text: string, kind: Toast['kind'] = 'ok') {
  set({ toast: { id: Date.now(), text, kind } });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => set({ toast: null }), 2800);
}

// ---- AniList status mapping ----
const TO_AL: Record<Status, string> = { watched: 'COMPLETED', watching: 'CURRENT', planned: 'PLANNING', dropped: 'DROPPED' };
const FROM_AL: Record<string, Status> = {
  COMPLETED: 'watched', CURRENT: 'watching', REPEATING: 'watching', PAUSED: 'watching', PLANNING: 'planned', DROPPED: 'dropped',
};

// ---- Auth ----
export const canSignIn = !!ANILIST_CLIENT_ID;

export function signIn() {
  location.href = `https://anilist.co/api/v2/oauth/authorize?client_id=${ANILIST_CLIENT_ID}&response_type=token`;
}

export function signOut() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  al.setToken(null);
  set({ user: null, entries: loadEntries(null) });
  toast('Signed out');
}

export async function init() {
  // AniList's implicit grant hands the token back in the URL fragment.
  const frag = new URLSearchParams(location.hash.replace(/^#/, ''));
  const fresh = frag.get('access_token');
  if (fresh) {
    const ttl = Number(frag.get('expires_in')) || 365 * 86400;
    localStorage.setItem(TOKEN_KEY, JSON.stringify({ t: fresh, exp: Date.now() + ttl * 1000 }));
    history.replaceState(null, '', location.pathname + '#/');
  }

  let saved: { t: string; exp: number } | null = null;
  try { saved = JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null'); } catch {}

  if (saved && saved.exp > Date.now()) {
    al.setToken(saved.t);
    try {
      const cached = JSON.parse(localStorage.getItem(USER_KEY) || 'null') as User | null;
      if (cached) set({ user: cached, entries: loadEntries(cached) });
    } catch {}
    try {
      const v = await al.fetchViewer();
      const user = { id: v.id, name: v.name, avatar: v.avatar.medium };
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      if (state.user?.id !== user.id) set({ user, entries: loadEntries(user) });
      if (fresh) toast(`Welcome, ${user.name}!`);
      await pull();
    } catch (e) {
      const status = (e as { status?: number }).status;
      if (status === 400 || status === 401) signOut();
      else toast("Couldn't reach AniList — showing your saved copy", 'err');
    }
  }

  // Refetch stale media in the background; this is also how newly announced seasons show up.
  resolveFranchises(Object.keys(state.entries).map(Number)).catch(() => {});
}

async function pull() {
  const user = state.user!;
  set({ busy: 'Syncing with AniList…' });
  try {
    const list = await al.fetchUserList(user.id);
    putMedia(list.map(e => e.media));
    const entries: Record<number, Entry> = {};
    for (const e of list) {
      entries[e.mediaId] = { status: FROM_AL[e.status] ?? 'watching', score: e.score ? e.score / 10 : null, updatedAt: e.updatedAt * 1000, listId: e.id };
    }
    // Edits made here that never reached AniList, plus anything tracked before signing in.
    const unsaved = Object.entries(state.entries).filter(([, e]) => e.dirty);
    const signedOut = Object.entries(loadEntries(null)).filter(([id, e]) => !entries[+id] || e.updatedAt > entries[+id].updatedAt);
    const toPush = [...unsaved, ...signedOut].map(([id, e]) => {
      entries[+id] = { ...e, listId: entries[+id]?.listId, dirty: true };
      return +id;
    });
    set({ entries });
    saveEntries();
    if (toPush.length) {
      await pushMany(toPush);
      if (signedOut.length) {
        localStorage.removeItem(entriesKey(null));
        toast(`Moved ${signedOut.length} seasons to your AniList`);
      }
    }
    await resolveFranchises(Object.keys(entries).map(Number));
  } finally {
    set({ busy: null });
  }
}

async function pushMany(ids: number[]) {
  for (const id of ids) {
    const e = state.entries[id];
    if (!e) continue;
    const listId = await al.saveListEntry({
      mediaId: id,
      status: TO_AL[e.status],
      scoreRaw: e.score ? Math.round(e.score * 10) : 0,
      progress: e.status === 'watched' ? peek(id)?.episodes ?? undefined : undefined,
    });
    set({ entries: { ...state.entries, [id]: { ...state.entries[id], listId, dirty: false } } });
  }
  saveEntries();
}

// ---- Edits ----
export interface Change { id: number; status: Status | null; score?: number | null }

export async function apply(changes: Change[], message?: string) {
  const entries = { ...state.entries };
  const removed: number[] = [];
  const now = Date.now();
  for (const c of changes) {
    const prev = entries[c.id];
    if (c.status === null) {
      if (prev?.listId) removed.push(prev.listId);
      delete entries[c.id];
    } else {
      entries[c.id] = {
        status: c.status,
        score: c.score !== undefined ? c.score : prev?.score ?? null,
        updatedAt: now,
        listId: prev?.listId,
        dirty: !!state.user,
      };
    }
  }
  set({ entries });
  saveEntries();
  if (message) toast(message);

  const ungrouped = changes.filter(c => c.status && !franchiseOf(c.id)).map(c => c.id);
  if (ungrouped.length) resolveFranchises(ungrouped).catch(() => {});

  if (!state.user) return;
  try {
    for (const id of removed) await al.deleteListEntry(id);
    await pushMany(changes.filter(c => c.status).map(c => c.id));
  } catch {
    toast('AniList save failed. It will retry next time you open MIRU.', 'err');
  }
}
