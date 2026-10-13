import { useEffect, useState } from 'react';
import type { Show } from '../lib/derive';
import { makeShareCard } from '../lib/shareCard';
import { useStore } from '../lib/store';
import { Loading } from './ui';

export default function ShareCard({ shows, onClose }: { shows: Show[]; onClose: () => void }) {
  const { user } = useStore();
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const top = shows
    .filter(s => s.status !== 'planned')
    .sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0) || b.updatedAt - a.updatedAt);

  useEffect(() => {
    let u: string | null = null;
    makeShareCard(top, user?.name ?? null)
      .then(b => { setBlob(b); u = URL.createObjectURL(b); setUrl(u); })
      .catch(e => setError(String(e.message || e)));
    return () => { if (u) URL.revokeObjectURL(u); };
  }, []); // render once per open

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [onClose]);

  const file = blob && new File([blob], 'miru-top5.png', { type: 'image/png' });
  const canShare = !!file && !!navigator.canShare?.({ files: [file] });

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-body" onClick={e => e.stopPropagation()}>
        <button className="close" onClick={onClose} aria-label="Close">✕</button>
        {error ? <p>Couldn't draw the card: {error}</p> : !url ? <Loading text="Inking your top 5" /> : (
          <>
            <img className="card-preview" src={url} alt="Your top 5 anime as a manga page" />
            <div className="add-row">
              <a className="ink-btn" href={url} download="miru-top5.png">DOWNLOAD PNG</a>
              {canShare && <button className="ink-btn ghost" onClick={() => navigator.share({ files: [file!], title: 'My top 5 anime' }).catch(() => {})}>SHARE…</button>}
            </div>
            {top.length < 5 && <p className="muted">Rate more shows to fill all five panels.</p>}
          </>
        )}
      </div>
    </div>
  );
}
