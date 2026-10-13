import { useEffect, useState } from 'react';
import type { Media } from '../api/anilist';
import { H2, Kicker, Loading, Pic, RatingPicker, StatusPicker, Volume } from '../components/ui';
import { library, ownedIds, showFor, type Show } from '../lib/derive';
import { franchiseOf, resolveFranchises } from '../lib/franchise';
import { art, countdown, crowd, fmtScore, isAired, pad2, studio, title, verticalTitle } from '../lib/format';
import { similarTo } from '../lib/recommend';
import { apply, useStore, type Change, type Entry } from '../lib/store';

const SEASON_NAME: Record<string, string> = { WINTER: 'Winter', SPRING: 'Spring', SUMMER: 'Summer', FALL: 'Fall' };

function meta(m: Media): string {
  if (!isAired(m)) return `Not yet aired${m.startDate.year ? ` · ${m.startDate.year}` : ''}`;
  const when = m.season && m.seasonYear ? `${SEASON_NAME[m.season]} ${m.seasonYear}` : m.seasonYear;
  return [when, m.episodes && `${m.episodes} eps`, studio(m)].filter(Boolean).join(' · ');
}

function SeasonRow({ m, label, entry, current }: { m: Media; label: string; entry?: Entry; current: boolean }) {
  const aired = isAired(m);
  return (
    <li className={current ? 'cur' : ''}>
      <span className="num">{label}</span>
      <img className="thumb" src={m.coverImage.large} alt="" loading="lazy" />
      <span className="ttl">
        {title(m)}
        <small>{meta(m)}</small>
        {m.nextAiringEpisode && (
          <span className="air">● EP {m.nextAiringEpisode.episode} airs in {countdown(m.nextAiringEpisode.airingAt)}</span>
        )}
      </span>
      <span className="score">{fmtScore(crowd(m))}<small>COMMUNITY</small></span>
      {aired
        ? <RatingPicker value={entry?.score ?? null} onChange={n => apply([{ id: m.id, status: entry?.status ?? 'watched', score: n }])} />
        : <span className="score you unset">—<small>YOU</small></span>}
      <StatusPicker
        value={entry?.status}
        onChange={s => apply([{ id: m.id, status: s }])}
      />
    </li>
  );
}

function AddPanel({ show }: { show: Show }) {
  const aired = show.seasons.filter(isAired);
  const start = (at: number | 'all' | 'plan') => {
    let changes: Change[];
    if (at === 'plan') changes = [{ id: show.first.id, status: 'planned' }];
    else if (at === 'all') changes = aired.map(s => ({ id: s.id, status: 'watched' }));
    else changes = show.seasons.slice(0, at + 1).map((s, i) => ({ id: s.id, status: i < at ? 'watched' : 'watching' }));
    apply(changes, at === 'plan' ? 'Added to Plan to watch' : 'Added to your library!');
  };
  return (
    <div className="add-panel">
      <div className="say">Where are you in this one?</div>
      <div className="add-row">
        {aired.length > 1 && aired.map((s, i) => (
          <button key={s.id} className="ink-btn ghost" onClick={() => start(i)}>ON S{i + 1}</button>
        ))}
        {aired.length === 1 && <button className="ink-btn ghost" onClick={() => start(0)}>WATCHING</button>}
        {aired.length > 0 && <button className="ink-btn" onClick={() => start('all')}>{aired.length > 1 ? `WATCHED ALL ${aired.length} ✓` : 'WATCHED IT ✓'}</button>}
        <button className="ink-btn ghost" onClick={() => start('plan')}>PLAN TO WATCH</button>
      </div>
    </div>
  );
}

export default function ShowPage({ id }: { id: number }) {
  const { entries } = useStore();
  const [error, setError] = useState<string | null>(null);
  const [similar, setSimilar] = useState<Media[] | null>(null);

  useEffect(() => {
    resolveFranchises([id]).catch(e => { if (!franchiseOf(id)) setError(String(e.message || e)); });
  }, [id]);

  const show = showFor(id, entries);
  const firstId = show?.first.id;

  useEffect(() => {
    if (!firstId) return;
    const owned = ownedIds(library(entries), entries);
    similarTo(firstId, owned).then(setSimilar).catch(() => setSimilar([]));
  }, [firstId]); // only refetch when the show changes, not on every rating

  if (!show) {
    return error
      ? <div className="panel notice"><div className="narr">Couldn't open this one: {error}</div></div>
      : <Loading text="Opening the volume" />;
  }

  const members = [...show.seasons, ...show.movies];
  const inLibrary = members.some(m => entries[m.id]);
  const latest = [...show.seasons].reverse().find(isAired) ?? show.first;
  const cur = show.current;
  const curEntry = cur && entries[cur.id];
  const years = [show.first.seasonYear, latest.seasonYear].filter(Boolean);
  const native = verticalTitle(show.first.title.native);
  const crowdAvg = (() => {
    const xs = show.seasons.map(crowd).filter((x): x is number => x != null);
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
  })();

  const finish = () => {
    if (!cur) return;
    const i = show.seasons.indexOf(cur);
    const next = show.seasons[i + 1];
    apply([{ id: cur.id, status: 'watched' }], next && isAired(next) ? `S${i + 1} DONE! S${i + 2} is up next` : `S${i + 1} DONE!`);
  };

  const remove = () => {
    apply(members.filter(m => entries[m.id]).map(m => ({ id: m.id, status: null })), 'Removed from library');
  };

  return (
    <>
      <section className="panel hero">
        <Pic src={art(cur ?? latest)} />
        <div className="vert" style={{ fontSize: native.size }}>{native.text}</div>
        <div className="narr top">
          <Kicker>{inLibrary ? { watching: 'NOW WATCHING', completed: 'COMPLETED', planned: 'PLAN TO WATCH', dropped: 'DROPPED' }[show.status] : 'NOT IN YOUR LIBRARY'}</Kicker>
          <h1>{title(show.first)}</h1>
          <span className="sub">{[years.length === 2 && years[0] !== years[1] ? `${years[0]}–${years[1]}` : years[0], `${show.seasons.length} season${show.seasons.length > 1 ? 's' : ''}`, studio(show.first)].filter(Boolean).join(' · ')}</span>
          <div className="genres">{show.first.genres.slice(0, 4).map(g => <span key={g}>{g}</span>)}</div>
        </div>
        {inLibrary && cur && curEntry?.status !== 'planned' && (
          <button className="tbc" onClick={finish}>FINISHED S{show.currentIndex + 1} ✓</button>
        )}
        {inLibrary && !cur && show.status === 'completed' && <div className="tbc static">ALL CAUGHT UP</div>}
      </section>

      {!inLibrary && <AddPanel show={show} />}

      <div className="show-grid">
        <aside className="synopsis">
          {inLibrary && (
            <div className="you-box">
              <div>
                <Kicker>YOU'RE ON</Kicker>
                <b>{cur ? `Season ${show.currentIndex + 1}` : show.status === 'completed' ? 'All caught up' : '—'}</b>
                {cur && <small>{title(cur)}</small>}
              </div>
              <div className="vs">
                <span className="score you">{fmtScore(show.avg && Math.round(show.avg * 10) / 10)}<small>YOUR AVG</small></span>
                <span className="score">{fmtScore(crowdAvg && Math.round(crowdAvg * 10) / 10)}<small>CROWD</small></span>
              </div>
            </div>
          )}
          {show.first.description && <p className="desc">{show.first.description}</p>}
          {show.badge && <div className="burst-tag">{show.badge.label}</div>}
          {inLibrary && <button className="text-btn" onClick={remove}>Remove from library</button>}
        </aside>

        <section>
          <H2 jp="目次">Seasons</H2>
          <ol className="toc">
            {show.seasons.map((s, i) => (
              <SeasonRow key={s.id} m={s} label={pad2(i + 1)} entry={entries[s.id]} current={inLibrary && s === cur} />
            ))}
          </ol>
          {show.movies.length > 0 && (
            <>
              <H2 jp="劇場版">Movies</H2>
              <ol className="toc movies">
                {show.movies.map(m => <SeasonRow key={m.id} m={m} label="映" entry={entries[m.id]} current={false} />)}
              </ol>
            </>
          )}
        </section>
      </div>

      <H2 jp="おすすめ">If You Like This</H2>
      {similar === null ? <Loading /> : similar.length ? (
        <div className="recs">
          {similar.map(m => <Volume key={m.id} m={m} onAdd={() => apply([{ id: m.id, status: 'planned' }], `${title(m)} → Plan to watch`)} />)}
        </div>
      ) : <p className="muted">No community recommendations yet.</p>}
    </>
  );
}
