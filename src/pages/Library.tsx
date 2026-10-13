import { useEffect, useMemo, useState } from 'react';
import type { Media } from '../api/anilist';
import ShareCard from '../components/ShareCard';
import { H2, Kicker, Loading, Pic, Volume } from '../components/ui';
import { library, ownedIds, type Show, type ShowStatus } from '../lib/derive';
import { art, countdown, fmtScore, isAired, studio, title, verticalTitle } from '../lib/format';
import { recommend } from '../lib/recommend';
import { apply, useStore } from '../lib/store';

// Irregular manga-page rhythm: [columns, rows] per panel, cycling.
const SPANS: [number, number][] = [[3, 2], [3, 1], [2, 1], [2, 2], [2, 1], [2, 1], [2, 1], [3, 1], [3, 1], [2, 1], [4, 1], [2, 1]];

const FILTERS: { key: ShowStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'ALL' },
  { key: 'watching', label: 'WATCHING' },
  { key: 'completed', label: 'COMPLETED' },
  { key: 'planned', label: 'PLAN' },
  { key: 'dropped', label: 'DROPPED' },
];

const STATUS_CHIP: Record<ShowStatus, string> = { watching: 'Watching', completed: 'Completed', planned: 'Plan', dropped: 'Dropped' };

function progressLine(s: Show): string {
  const n = s.seasons.length;
  const score = s.avg != null ? ` · ★ ${fmtScore(Math.round(s.avg * 10) / 10)}` : '';
  switch (s.status) {
    case 'watching': return `On S${s.currentIndex + 1} of ${n}${score}`;
    case 'planned': return 'Plan to watch';
    case 'dropped': return `Dropped · ${s.seasonsWatched}/${n} seasons${score}`;
    default: return (s.current ? `${s.seasonsWatched}/${n} seasons` : n > 1 ? `All ${n} seasons` : 'Finished') + score;
  }
}

function Hero({ show }: { show: Show }) {
  const cur = show.current!;
  const i = show.currentIndex;
  const next = show.seasons[i + 1];
  const air = cur.nextAiringEpisode;
  const native = verticalTitle(cur.title.native ?? show.first.title.native);
  return (
    <section className="panel hero">
      <Pic src={art(cur)} />
      <div className="vert" style={{ fontSize: native.size }}>{native.text}</div>
      <a className="narr top" href={`#/show/${show.first.id}`}>
        <Kicker>NOW WATCHING</Kicker>
        <h1>{title(cur)}</h1>
        <span className="sub">Season {i + 1} of {show.seasons.length} · {studio(cur)}</span>
      </a>
      {air && <div className="narr bot">● EP {air.episode} AIRS IN {countdown(air.airingAt).toUpperCase()}</div>}
      <button className="tbc" onClick={() => apply([{ id: cur.id, status: 'watched' }], next && isAired(next) ? `S${i + 1} DONE! S${i + 2} is up next` : `S${i + 1} DONE!`)}>
        FINISHED S{i + 1} ✓
      </button>
    </section>
  );
}

function Empty() {
  const [picks, setPicks] = useState<Media[] | null>(null);
  useEffect(() => { recommend([], new Set()).then(p => setPicks(p.map(x => x.media))).catch(() => setPicks([])); }, []);
  return (
    <>
      <section className="panel empty">
        <div className="narr">
          <Kicker>CHAPTER 1</Kicker>
          <h1>Your story begins here.</h1>
          <p>Search above for anything you've watched. Shorthand works: <b>jjk</b>, <b>aot</b>, <b>fmab</b>. Pick the season you're on, and MIRU fills in the rest.</p>
        </div>
      </section>
      <H2 jp="名作">Start With The Classics</H2>
      {picks === null ? <Loading /> : (
        <div className="recs">
          {picks.map(m => <Volume key={m.id} m={m} onAdd={() => apply([{ id: m.id, status: 'planned' }], `${title(m)} → Plan to watch`)} />)}
        </div>
      )}
    </>
  );
}

export default function Library() {
  const { entries, tick } = useStore();
  const shows = useMemo(() => library(entries), [entries, tick]);
  const [filter, setFilter] = useState<ShowStatus | 'all'>('all');
  const [sort, setSort] = useState<'recent' | 'rating' | 'az'>('recent');
  const [sharing, setSharing] = useState(false);

  if (!shows.length) return <Empty />;

  const hero = shows.find(s => s.status === 'watching' && s.current);
  const airing = shows.filter(s => s.status === 'watching' && s.current?.nextAiringEpisode)
    .sort((a, b) => a.current!.nextAiringEpisode!.airingAt - b.current!.nextAiringEpisode!.airingAt);
  const visible = shows
    .filter(s => filter === 'all' || s.status === filter)
    .sort(sort === 'rating' ? (a, b) => (b.avg ?? -1) - (a.avg ?? -1)
      : sort === 'az' ? (a, b) => title(a.first).localeCompare(title(b.first))
      : () => 0);
  const count = (k: ShowStatus | 'all') => (k === 'all' ? shows.length : shows.filter(s => s.status === k).length);

  return (
    <>
      {hero && <Hero show={hero} />}

      {airing.length > 0 && (
        <div className="onair">
          <span className="onair-tag">ON AIR</span>
          {airing.slice(0, 4).map(s => (
            <a key={s.f.id} href={`#/show/${s.first.id}`}>
              <b>{title(s.first)}</b> ep {s.current!.nextAiringEpisode!.episode} in {countdown(s.current!.nextAiringEpisode!.airingAt)}
            </a>
          ))}
        </div>
      )}

      <H2 jp="第一章">Your Library</H2>
      <div className="toolbar">
        <div className="tabs">
          {FILTERS.map(f => (
            <button key={f.key} className={filter === f.key ? 'on' : ''} onClick={() => setFilter(f.key)}>
              {f.label}<sup>{count(f.key)}</sup>
            </button>
          ))}
        </div>
        <select value={sort} onChange={e => setSort(e.target.value as typeof sort)} aria-label="Sort">
          <option value="recent">Recently updated</option>
          <option value="rating">My rating</option>
          <option value="az">A–Z</option>
        </select>
        <button className="ink-btn small" onClick={() => setSharing(true)}>TOP 5 CARD</button>
      </div>

      {visible.length ? (
        <section className="grid">
          {visible.map((s, i) => {
            const [c, r] = SPANS[i % SPANS.length];
            const big = c > 2 || r > 1;
            return (
              <a key={s.f.id} href={`#/show/${s.first.id}`} className="panel" style={{ gridColumn: `span ${c}`, gridRow: `span ${r}` }}>
                <Pic src={big ? art(s.current ?? s.first) : s.first.coverImage.extraLarge} />
                <span className={`chip ${s.status}`}>{s.status === 'completed' && s.current ? 'Catch up' : STATUS_CHIP[s.status]}</span>
                {s.badge && <span className={`burst ${s.badge.kind}`}>{s.badge.label}</span>}
                <span className="narr"><b>{title(s.first)}</b>{progressLine(s)}</span>
              </a>
            );
          })}
        </section>
      ) : <p className="muted">Nothing here yet.</p>}

      {sharing && <ShareCard shows={shows} onClose={() => setSharing(false)} />}
      <OwnedHint shows={shows} />
    </>
  );
}

// Small teaser linking to Discover with the single best pick.
function OwnedHint({ shows }: { shows: Show[] }) {
  const { entries } = useStore();
  const [pick, setPick] = useState<{ m: Media; because: string | null } | null>(null);
  useEffect(() => {
    recommend(shows, ownedIds(shows, entries)).then(p => p[0] && setPick({ m: p[0].media, because: p[0].because })).catch(() => {});
  }, [shows.length]); // recompute only when shows are added or removed
  if (!pick) return null;
  return (
    <a className="next-vol" href="#/discover">
      <img src={pick.m.coverImage.large} alt="" />
      <span><Kicker>NEXT VOLUME</Kicker><b>{title(pick.m)}</b>{pick.because && <small>because you liked {pick.because}</small>}</span>
      <i>MORE PICKS →</i>
    </a>
  );
}
