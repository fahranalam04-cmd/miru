import { useEffect, useMemo, useState } from 'react';
import { H2, Loading, Volume } from '../components/ui';
import { library, ownedIds } from '../lib/derive';
import { currentSeason, title } from '../lib/format';
import { recommend, seasonalForYou, tasteProfile, type Pick } from '../lib/recommend';
import { apply, useStore } from '../lib/store';

function Shelf({ picks, reason }: { picks: Pick[] | null; reason?: boolean }) {
  if (picks === null) return <Loading text="Flipping through the shelves" />;
  if (!picks.length) return <p className="muted">Nothing new to suggest. You've seen it all?</p>;
  return (
    <div className="shelf">
      {picks.map(p => (
        <Volume key={p.media.id} m={p.media} onAdd={() => apply([{ id: p.media.id, status: 'planned' }], `${title(p.media)} → Plan to watch`)}>
          <span className="match">{p.match}<small>%</small></span>
          {reason && p.because && <span className="because">because you liked <b>{p.because}</b></span>}
        </Volume>
      ))}
    </div>
  );
}

export default function Discover() {
  const { entries, tick } = useStore();
  const shows = useMemo(() => library(entries), [entries, tick]);
  const owned = useMemo(() => ownedIds(shows, entries), [shows, entries]);
  const [picks, setPicks] = useState<Pick[] | null>(null);
  const [seasonal, setSeasonal] = useState<Pick[] | null>(null);
  const { season, year } = currentSeason();
  const profile = tasteProfile(shows);
  const loves = Object.entries(profile).filter(([, v]) => v > 0.25).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([g]) => g);

  useEffect(() => {
    recommend(shows, owned).then(setPicks).catch(() => setPicks([]));
    seasonalForYou(shows, owned).then(s => setSeasonal(s.slice(0, 14))).catch(() => setSeasonal([]));
  }, [shows.length]); // recompute when shows are added or removed

  return (
    <>
      <section className="panel intro">
        <div className="narr">
          <h1>Picked for you.</h1>
          <p>
            {shows.length
              ? <>Picks come from what fans of your top-rated shows also loved, weighted by <b>your</b> scores{loves.length ? <>, and tilted toward what you rate highest: {loves.map(g => <span key={g} className="tag">{g}</span>)}</> : null}.</>
              : <>Add a few shows and rate their seasons, and this page learns your taste. Until then, here are the all-time greats.</>}
          </p>
        </div>
      </section>

      <H2 jp="おすすめ">Next Volumes</H2>
      <Shelf picks={picks} reason />

      <H2 jp={`${{ WINTER: '冬', SPRING: '春', SUMMER: '夏', FALL: '秋' }[season]}アニメ`}>
        {season[0] + season.slice(1).toLowerCase()} {year}, Ranked For You
      </H2>
      <Shelf picks={seasonal} />
    </>
  );
}
