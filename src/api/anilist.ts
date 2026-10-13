// Thin AniList GraphQL client: rate limiting, 429 back-off, and the queries MIRU needs.
const API = 'https://graphql.anilist.co';

export interface Relation {
  relationType: string;
  node: { id: number; format: string | null; type: string };
}

export interface Media {
  id: number;
  title: { romaji: string; english: string | null; native: string | null };
  synonyms: string[];
  bannerImage: string | null;
  coverImage: { extraLarge: string; large: string; color: string | null };
  averageScore: number | null;
  popularity: number | null;
  genres: string[];
  episodes: number | null;
  duration: number | null;
  season: string | null;
  seasonYear: number | null;
  startDate: { year: number | null; month: number | null; day: number | null };
  format: string | null;
  status: string | null;
  description: string | null;
  studios: { nodes: { name: string }[] };
  nextAiringEpisode: { episode: number; airingAt: number } | null;
  relations: { edges: Relation[] };
}

export const MEDIA_FIELDS = `
  id title { romaji english native } synonyms bannerImage
  coverImage { extraLarge large color } averageScore popularity genres episodes duration
  season seasonYear startDate { year month day } format status description(asHtml: false)
  studios(isMain: true) { nodes { name } }
  nextAiringEpisode { episode airingAt }
  relations { edges { relationType node { id format type } } }`;

let token: string | null = null;
export const setToken = (t: string | null) => { token = t; };

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// AniList allows roughly 30–90 requests a minute depending on load; stay under 25.
const recent: number[] = [];
async function throttle() {
  for (;;) {
    const now = Date.now();
    while (recent.length && now - recent[0] > 60_000) recent.shift();
    if (recent.length < 25) { recent.push(now); return; }
    await sleep(60_000 - (now - recent[0]) + 50);
  }
}

export async function gql<T>(query: string, variables: Record<string, unknown> = {}, tries = 3): Promise<T> {
  await throttle();
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(API, { method: 'POST', headers, body: JSON.stringify({ query, variables }) });
  if (res.status === 429 && tries > 0) {
    await sleep((Number(res.headers.get('Retry-After')) || 30) * 1000);
    return gql(query, variables, tries - 1);
  }
  const json = await res.json().catch(() => ({ errors: [{ message: `AniList returned ${res.status}` }] }));
  if (json.errors?.length) {
    const err = new Error(json.errors[0].message) as Error & { status?: number };
    err.status = json.errors[0].status ?? res.status;
    throw err;
  }
  return json.data as T;
}

export async function fetchMediaBatch(ids: number[]): Promise<Media[]> {
  const out: Media[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const d = await gql<{ Page: { media: Media[] } }>(
      `query($ids:[Int]){Page(perPage:50){media(id_in:$ids,type:ANIME){${MEDIA_FIELDS}}}}`,
      { ids: ids.slice(i, i + 50) },
    );
    out.push(...d.Page.media);
  }
  return out;
}

export async function searchMedia(term: string): Promise<Media[]> {
  const d = await gql<{ Page: { media: Media[] } }>(
    `query($s:String){Page(perPage:10){media(search:$s,type:ANIME,sort:SEARCH_MATCH,isAdult:false){${MEDIA_FIELDS}}}}`,
    { s: term },
  );
  return d.Page.media.filter(m => m.format !== 'MUSIC' && !/\bPV\b/.test(m.title.romaji));
}

export interface RecNode { rating: number; mediaRecommendation: Media | null }

export async function fetchRecommendations(id: number): Promise<RecNode[]> {
  const d = await gql<{ Media: { recommendations: { nodes: RecNode[] } } }>(
    `query($id:Int){Media(id:$id){recommendations(sort:RATING_DESC,perPage:15){nodes{rating mediaRecommendation{${MEDIA_FIELDS}}}}}}`,
    { id },
  );
  return d.Media.recommendations.nodes;
}

export async function fetchSeasonal(season: string, year: number): Promise<Media[]> {
  const d = await gql<{ Page: { media: Media[] } }>(
    `query($s:MediaSeason,$y:Int){Page(perPage:40){media(season:$s,seasonYear:$y,type:ANIME,isAdult:false,sort:POPULARITY_DESC,format_in:[TV,ONA]){${MEDIA_FIELDS}}}}`,
    { s: season, y: year },
  );
  return d.Page.media;
}

export async function fetchTopRated(): Promise<Media[]> {
  const d = await gql<{ Page: { media: Media[] } }>(
    `query{Page(perPage:30){media(type:ANIME,isAdult:false,sort:SCORE_DESC,format_in:[TV],popularity_greater:150000){${MEDIA_FIELDS}}}}`,
  );
  return d.Page.media;
}

// ---- Authenticated (AniList account) ----

export interface Viewer { id: number; name: string; avatar: { medium: string } }

export async function fetchViewer(): Promise<Viewer> {
  return (await gql<{ Viewer: Viewer }>(`query{Viewer{id name avatar{medium}}}`)).Viewer;
}

export interface ListEntry {
  id: number;
  mediaId: number;
  status: string;
  score: number;
  updatedAt: number;
  media: Media;
}

export async function fetchUserList(userId: number): Promise<ListEntry[]> {
  const d = await gql<{ MediaListCollection: { lists: { entries: ListEntry[] }[] } }>(
    `query($u:Int){MediaListCollection(userId:$u,type:ANIME){lists{entries{id mediaId status score(format:POINT_10) updatedAt media{${MEDIA_FIELDS}}}}}}`,
    { u: userId },
  );
  return d.MediaListCollection.lists.flatMap(l => l.entries);
}

export async function saveListEntry(v: { mediaId: number; status: string; scoreRaw: number; progress?: number }): Promise<number> {
  const d = await gql<{ SaveMediaListEntry: { id: number } }>(
    `mutation($mediaId:Int,$status:MediaListStatus,$scoreRaw:Int,$progress:Int){
      SaveMediaListEntry(mediaId:$mediaId,status:$status,scoreRaw:$scoreRaw,progress:$progress){id}}`,
    v,
  );
  return d.SaveMediaListEntry.id;
}

export async function deleteListEntry(id: number): Promise<void> {
  await gql(`mutation($id:Int){DeleteMediaListEntry(id:$id){deleted}}`, { id });
}
