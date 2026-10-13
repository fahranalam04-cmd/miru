import { useMemo, useState } from 'react';
import ShareCard from '../components/ShareCard';
import { H2, Kicker, Pic } from '../components/ui';
import { library } from '../lib/derive';
import { art, fmtScore, title } from '../lib/format';
import { computeStats } from '../lib/stats';
import { useStore } from '../lib/store';

const round1 = (n: number) => Math.round(n * 10) / 10;

function Bars({ rows, unit }: { rows: [string, number][]; unit: string }) {
  const max = Math.max(1, ...rows.map(r => r[1]));
  return (
    <ul className="hbars">
      {rows.map(([label, n]) => (
        <li key={label} title={`${label}: ${n} ${unit}`}>
          <span className="lbl">{label}</span>
          <span className="track"><span style={{ width: `${(n / max) * 100}%` }} /></span>
          <span className="val">{n}</span>
        </li>
      ))}
    </ul>
  );
}

export default function StatsPage() {
  const { entries, tick } = useStore();
  const shows = useMemo(() => library(entries), [entries, tick]);
  const s = useMemo(() => computeStats(shows, entries), [shows, entries]);
  const [sharing, setSharing] = useState(false);

  if (!s.seasons && !s.yourAvg) {
    return (
      <section className="panel empty">
        <div className="narr"><Kicker>STATS</Kicker><h1>No numbers yet.</h1><p>Mark a few seasons as watched and rate them, and this page fills in.</p></div>
      </section>
    );
  }

  const maxH = Math.max(1, ...s.histogram);
  const mode = s.histogram.indexOf(maxH) + 1;
  const diff = s.yourAvg != null && s.crowdAvg != null ? s.yourAvg - s.crowdAvg : null;

  return (
    <>
      <section className="tiles">
        <div className="panel tile"><span className="big">{s.seasons}</span><Kicker>SEASONS FINISHED</Kicker></div>
        <div className="panel tile"><span className="big">{s.episodes.toLocaleString()}</span><Kicker>EPISODES</Kicker></div>
        <div className="panel tile red"><span className="big">{Math.round(s.hours).toLocaleString()}</span><Kicker>HOURS · {round1(s.hours / 24)} DAYS</Kicker></div>
        <div className="panel tile"><span className="big">{s.shows}</span><Kicker>SHOWS</Kicker></div>
      </section>

      <div className="stats-grid">
        <section>
          <H2 jp="ジャンル">Your Genres</H2>
          <Bars rows={s.genres} unit="seasons" />
        </section>

        <section>
          <H2 jp="採点">How You Rate</H2>
          {s.yourAvg == null ? <p className="muted">Rate some seasons to see this.</p> : (
            <>
              <div className="hist" role="img" aria-label={`Your ratings, mostly ${mode}s`}>
                {s.histogram.map((n, i) => (
                  <div key={i} className={i + 1 === mode ? 'col on' : 'col'} title={`${n} season${n === 1 ? '' : 's'} rated ${i + 1}`}>
                    <span className="n">{n || ''}</span>
                    <span className="bar" style={{ height: `${(n / maxH) * 100}%` }} />
                    <span className="x">{i + 1}</span>
                  </div>
                ))}
              </div>
              <div className="versus">
                <span className="score you">{fmtScore(round1(s.yourAvg))}<small>YOUR AVG</small></span>
                <span className="vs-mark">VS</span>
                <span className="score">{fmtScore(s.crowdAvg != null ? round1(s.crowdAvg) : null)}<small>CROWD AVG</small></span>
                {diff != null && (
                  <p>{Math.abs(diff) < 0.3 ? 'You and the crowd agree, most of the time.'
                    : diff > 0 ? `You score ${round1(diff)} higher than everyone else. Generous!`
                    : `You score ${round1(-diff)} lower than everyone else. Tough critic.`}</p>
                )}
              </div>
            </>
          )}
        </section>
      </div>

      <div className="stats-grid">
        {s.hottest && (
          <section>
            <H2 jp="異論">Hottest Take</H2>
            <a className="panel take" href={`#/show/${s.hottest.media.id}`}>
              <Pic src={art(s.hottest.media)} />
              <span className="narr">
                <b>{title(s.hottest.media)}</b>
                You gave it <em>{s.hottest.you}</em>. The crowd says <em>{fmtScore(round1(s.hottest.crowd))}</em>.
              </span>
            </a>
          </section>
        )}
        <section>
          <H2 jp="制作">Top Studios</H2>
          <Bars rows={s.studios} unit="seasons" />
          <button className="ink-btn" style={{ marginTop: 26 }} onClick={() => setSharing(true)}>MAKE MY TOP 5 CARD</button>
        </section>
      </div>

      {sharing && <ShareCard shows={shows} onClose={() => setSharing(false)} />}
    </>
  );
}
