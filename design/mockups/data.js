// Shared live-data loader for the mockups — AniList GraphQL, cached 6h in localStorage.
const API = 'https://graphql.anilist.co';
const LIB = [113415, 154587, 16498, 127230, 151807, 101922, 140960, 101348, 171018, 130003];

// Pretend personal data so the mockups have something to show.
const ME = {
  113415: { status: 'watching', ep: 7, mine: [9, 10] },
  154587: { status: 'watching', ep: 4, mine: [10] },
  16498:  { status: 'completed', mine: [8, 9, 10, 9] },
  127230: { status: 'completed', mine: [8] },
  151807: { status: 'watching', ep: 9, mine: [8] },
  101922: { status: 'paused', ep: 5, mine: [8, 9] },
  140960: { status: 'completed', mine: [8, 8] },
  101348: { status: 'completed', mine: [10, 9] },
  171018: { status: 'watching', ep: 3, mine: [9] },
  130003: { status: 'plan', mine: [] },
};

// Short-hand → real title. AniList synonyms cover a lot, this covers the rest.
const ALIASES = {
  jjk: 'Jujutsu Kaisen', aot: 'Attack on Titan', snk: 'Shingeki no Kyojin', mha: 'My Hero Academia',
  bnha: 'Boku no Hero Academia', csm: 'Chainsaw Man', kny: 'Demon Slayer', ds: 'Demon Slayer',
  opm: 'One Punch Man', hxh: 'Hunter x Hunter', fmab: 'Fullmetal Alchemist Brotherhood', fma: 'Fullmetal Alchemist',
  sxf: 'Spy x Family', op: 'One Piece', dbz: 'Dragon Ball Z', dbs: 'Dragon Ball Super', mp100: 'Mob Psycho 100',
  re0: 'Re:Zero', rezero: 'Re:Zero', sao: 'Sword Art Online', tpn: 'The Promised Neverland',
  cote: 'Classroom of the Elite', jojo: "JoJo's Bizarre Adventure", eva: 'Neon Genesis Evangelion',
  nge: 'Neon Genesis Evangelion', tg: 'Tokyo Ghoul', bc: 'Black Clover', sl: 'Solo Leveling',
  ddd: 'Dandadan', aphd: 'The Apothecary Diaries', kaiju: 'Kaiju No. 8', bl: 'Blue Lock',
  frieren: 'Sousou no Frieren', bocchi: 'Bocchi the Rock', konosuba: 'KonoSuba', mob: 'Mob Psycho 100',
};

const F = `id title{romaji english native} bannerImage coverImage{extraLarge large color}
  averageScore genres episodes seasonYear format studios(isMain:true){nodes{name}}
  nextAiringEpisode{episode timeUntilAiring}`;

async function gql(query, variables) {
  const r = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const j = await r.json();
  if (j.errors) throw new Error(j.errors[0].message);
  return j.data;
}

async function loadAnime() {
  const key = 'miru-mock-v1';
  try {
    const c = JSON.parse(localStorage.getItem(key));
    if (c && Date.now() - c.t < 6 * 36e5) return c.d;
  } catch {}

  const lib = (await gql(`query($ids:[Int]){Page(perPage:50){media(id_in:$ids,type:ANIME){${F}}}}`, { ids: LIB })).Page.media;
  lib.sort((a, b) => LIB.indexOf(a.id) - LIB.indexOf(b.id));

  // Walk the SEQUEL chain from JJK S1 to build its season list.
  const seasons = [];
  let recs = [];
  let id = 113415;
  for (let i = 0; i < 5 && id; i++) {
    const extra = i === 0 ? `recommendations(sort:RATING_DESC,perPage:10){nodes{mediaRecommendation{${F}}}}` : '';
    const m = (await gql(`query($id:Int){Media(id:$id){${F} relations{edges{relationType node{id format}}} ${extra}}}`, { id })).Media;
    seasons.push(m);
    if (i === 0) recs = m.recommendations.nodes.map(n => n.mediaRecommendation).filter(Boolean);
    const next = m.relations.edges.find(e => e.relationType === 'SEQUEL' && e.node.format === 'TV');
    id = next && next.node.id;
  }

  const d = { lib, seasons, recs };
  try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), d })); } catch {}
  return d;
}

async function searchAnime(q) {
  q = q.trim();
  if (!q) return [];
  const term = ALIASES[q.toLowerCase().replace(/[^a-z0-9]/g, '')] || q;
  const d = await gql(`query($s:String){Page(perPage:6){media(search:$s,type:ANIME,sort:SEARCH_MATCH,isAdult:false){${F}}}}`, { s: term });
  return d.Page.media;
}

function debounce(fn, ms = 300) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

const T = m => m.title.english || m.title.romaji;
const S = m => (m.averageScore ? (m.averageScore / 10).toFixed(1) : '—');
const STATUS = { watching: 'Watching', completed: 'Completed', paused: 'On hold', plan: 'Plan to watch' };
const seasonOf = m => (ME[m.id] ? Math.max(1, ME[m.id].mine.length) : 1);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const art = m => m.bannerImage || m.coverImage.extraLarge;
