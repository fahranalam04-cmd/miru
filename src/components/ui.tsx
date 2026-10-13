import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Media } from '../api/anilist';
import { fmtScore, title } from '../lib/format';
import type { Status } from '../lib/store';

// Grayscale + halftone image that blooms into color on hover.
export function Pic({ src, alt = '', color }: { src: string; alt?: string; color?: boolean }) {
  return (
    <div className={`pic${color ? ' color' : ''}`}>
      <img src={src} alt={alt} loading="lazy" />
    </div>
  );
}

export function Kicker({ children }: { children: ReactNode }) {
  return <div className="kicker">{children}</div>;
}

export function H2({ children, jp }: { children: ReactNode; jp: string }) {
  return <h2>{children} <em>{jp}</em></h2>;
}

export function Loading({ text = 'Loading' }: { text?: string }) {
  return <div className="loading"><span>{text}</span><i>…</i></div>;
}

const STATUSES: { s: Status; label: string; icon: string }[] = [
  { s: 'watched', label: 'Watched', icon: '✓' },
  { s: 'watching', label: 'Watching', icon: '▶' },
  { s: 'planned', label: 'Plan', icon: '◷' },
  { s: 'dropped', label: 'Dropped', icon: '✕' },
];

export function StatusPicker({ value, onChange, disabled }: { value?: Status; onChange: (s: Status | null) => void; disabled?: boolean }) {
  return (
    <div className="status-picker" role="group" aria-label="Season status">
      {STATUSES.map(({ s, label, icon }) => (
        <button
          key={s}
          className={value === s ? `on ${s}` : ''}
          disabled={disabled}
          title={value === s ? `Clear (${label})` : label}
          onClick={() => onChange(value === s ? null : s)}
        >
          <span>{icon}</span>{label}
        </button>
      ))}
    </div>
  );
}

export function RatingPicker({ value, onChange }: { value: number | null; onChange: (n: number | null) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    addEventListener('mousedown', close);
    return () => removeEventListener('mousedown', close);
  }, [open]);

  // Scores run 1.0–10.0 in steps of 0.1: pick the whole number, then optionally the decimal.
  const whole = value == null ? null : Math.floor(value);
  const tenth = value == null ? 0 : Math.round((value - Math.floor(value)) * 10);
  const commit = (n: number | null, close = false) => {
    onChange(n == null ? null : Math.min(10, Math.max(1, Math.round(n * 10) / 10)));
    if (close) setOpen(false);
  };

  return (
    <div className="rating" ref={ref}>
      <button className={`score you${value == null ? ' unset' : ''}`} onClick={() => setOpen(o => !o)} aria-label="Your rating">
        {fmtScore(value)}<small>YOU</small>
      </button>
      {open && (
        <div className="rate-pop" onKeyDown={e => e.key === 'Escape' && setOpen(false)}>
          <div className="rate-now">{value == null ? '—' : value.toFixed(1)}</div>
          <span className="rate-label">SCORE</span>
          <div className="rate-row">
            {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
              <button key={n} className={n === whole ? 'on' : ''} onClick={() => commit(n === 10 ? 10 : n + tenth / 10)}>{n}</button>
            ))}
          </div>
          <span className="rate-label">DECIMAL</span>
          <div className="rate-row tenths">
            {Array.from({ length: 10 }, (_, d) => (
              <button key={d} className={whole != null && d === tenth ? 'on' : ''} disabled={whole == null || whole === 10}
                onClick={() => commit(whole! + d / 10, true)}>.{d}</button>
            ))}
          </div>
          <div className="rate-foot">
            <input
              type="number" min={1} max={10} step={0.1} placeholder="or type 8.7" aria-label="Type a score"
              onKeyDown={e => {
                const n = parseFloat(e.currentTarget.value);
                if (e.key === 'Enter' && !Number.isNaN(n)) commit(n, true);
              }}
            />
            {value != null && <button className="clear" onClick={() => commit(null, true)}>clear</button>}
            <button className="done" onClick={() => setOpen(false)}>done</button>
          </div>
        </div>
      )}
    </div>
  );
}

// A manga volume standing on the shelf; used for recommendation strips.
export function Volume({ m, children, onAdd }: { m: Media; children?: ReactNode; onAdd?: () => void }) {
  return (
    <div className="vol">
      <a href={`#/show/${m.id}`} aria-label={title(m)}>
        <img src={m.coverImage.extraLarge} alt="" loading="lazy" />
        <span className="vol-title">{title(m)}</span>
      </a>
      {children}
      {onAdd && <button className="vol-add" onClick={onAdd} title="Add to Plan to watch">+ PLAN</button>}
    </div>
  );
}
