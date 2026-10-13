import { useEffect, useRef, useState } from 'react';
import { searchMedia, type Media } from '../api/anilist';
import { expandQuery } from '../lib/aliases';
import { putMedia } from '../lib/cache';
import { franchiseOf } from '../lib/franchise';
import { crowd, fmtScore, title } from '../lib/format';
import { useStore } from '../lib/store';

const FORMAT: Record<string, string> = { TV: 'TV', TV_SHORT: 'TV short', MOVIE: 'Movie', OVA: 'OVA', ONA: 'ONA', SPECIAL: 'Special' };

async function find(q: string): Promise<{ term: string; results: Media[] }> {
  const term = expandQuery(q);
  let results = await searchMedia(term);
  // Typos: fall back to the first word, which AniList matches more loosely.
  if (!results.length && term.includes(' ')) results = await searchMedia(term.split(' ')[0]);
  putMedia(results);
  return { term, results };
}

export default function Search() {
  const { entries } = useStore();
  const [q, setQ] = useState('');
  const [res, setRes] = useState<Media[]>([]);
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const seq = useRef(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') { e.preventDefault(); input.current?.focus(); }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (q.trim().length < 2) { setRes([]); return; }
    const id = ++seq.current;
    setLoading(true);
    const t = setTimeout(() => {
      find(q).then(r => {
        if (id !== seq.current) return;
        setRes(r.results); setTerm(r.term); setActive(0); setOpen(true);
      }).catch(() => {}).finally(() => id === seq.current && setLoading(false));
    }, 280);
    return () => clearTimeout(t);
  }, [q]);

  const go = (m: Media) => {
    location.hash = `#/show/${m.id}`;
    setOpen(false); setQ(''); input.current?.blur();
  };

  const owned = (m: Media) => !!entries[m.id] || (!!franchiseOf(m.id) && [...franchiseOf(m.id)!.seasons].some(id => entries[id]));
  const expanded = term && term.toLowerCase() !== q.trim().toLowerCase();

  return (
    <div className="bubble">
      <input
        ref={input}
        value={q}
        placeholder="who are we watching? (try jjk)"
        aria-label="Search anime"
        onChange={e => setQ(e.target.value)}
        onFocus={() => res.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={e => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, res.length - 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
          if (e.key === 'Enter' && res[active]) go(res[active]);
          if (e.key === 'Escape') { setOpen(false); input.current?.blur(); }
        }}
      />
      {loading && <span className="dots" aria-hidden>…</span>}
      {open && q.trim().length >= 2 && (
        <div className="results">
          {expanded && <div className="hint">“{q.trim()}” → {term}</div>}
          {!res.length && !loading && <div className="hint">Nothing found. Try another spelling?</div>}
          {res.map((m, i) => (
            <button key={m.id} className={i === active ? 'on' : ''} onMouseDown={() => go(m)} onMouseEnter={() => setActive(i)}>
              <img src={m.coverImage.large} alt="" loading="lazy" />
              <span>
                <b>{title(m)}</b>
                <small>{[m.seasonYear, FORMAT[m.format ?? ''], m.episodes && `${m.episodes} eps`, crowd(m) && `★ ${fmtScore(crowd(m))}`].filter(Boolean).join(' · ')}</small>
              </span>
              {owned(m) && <em>IN LIBRARY</em>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
