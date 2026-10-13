import { useEffect, useState } from 'react';
import Search from './components/Search';
import { canSignIn, signIn, signOut, useStore } from './lib/store';
import Discover from './pages/Discover';
import Library from './pages/Library';
import ShowPage from './pages/ShowPage';
import StatsPage from './pages/Stats';

function useRoute(): string[] {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const onChange = () => { setHash(location.hash); window.scrollTo(0, 0); };
    addEventListener('hashchange', onChange);
    return () => removeEventListener('hashchange', onChange);
  }, []);
  return hash.replace(/^#\/?/, '').split('/');
}

export default function App() {
  const [page, arg] = useRoute();
  const { user, busy, toast } = useStore();
  const [menu, setMenu] = useState(false);

  const nav = (to: string, label: string) => (
    <a href={`#/${to}`} className={(page || '') === to ? 'on' : ''}>{label}</a>
  );

  return (
    <>
      <div className="wrap">
        <header className="mast">
          <a className="logo" href="#/" aria-label="MIRU home">
            <b>MIRU</b><i>見る記録</i>
          </a>
          <nav>
            {nav('', 'LIBRARY')}
            {nav('discover', 'DISCOVER')}
            {nav('stats', 'STATS')}
          </nav>
          <Search />
          <div className="account">
            {user ? (
              <button className="avatar" onClick={() => setMenu(m => !m)} aria-label="Account">
                <img src={user.avatar} alt="" />
                {menu && (
                  <span className="menu" onMouseLeave={() => setMenu(false)}>
                    <span>Synced to AniList as <b>{user.name}</b></span>
                    <a href={`https://anilist.co/user/${user.name}`} target="_blank" rel="noreferrer">Open AniList profile ↗</a>
                    <span className="link" onClick={signOut}>Sign out</span>
                  </span>
                )}
              </button>
            ) : canSignIn ? (
              <button className="ink-btn small" onClick={signIn}>SIGN IN WITH ANILIST</button>
            ) : (
              <span className="local-note" title="Your list is saved in this browser.">LOCAL MODE</span>
            )}
          </div>
        </header>

        {page === 'show' && arg ? <ShowPage key={arg} id={Number(arg)} />
          : page === 'discover' ? <Discover />
          : page === 'stats' ? <StatsPage />
          : <Library />}

        <footer className="foot">
          <span>MIRU 見る記録 · data from <a href="https://anilist.co" target="_blank" rel="noreferrer">AniList</a></span>
          <span>続く…</span>
        </footer>
      </div>

      {busy && <div className="busy">{busy}</div>}
      {toast && <div key={toast.id} className={`sfx ${toast.kind}`}>{toast.text}</div>}
    </>
  );
}
