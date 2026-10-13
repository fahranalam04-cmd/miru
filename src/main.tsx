import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { init } from './lib/store';
import './styles.css';

// Loaded fine: re-arm the stale-cache reload in index.html and drop its ?v= cache-buster.
try { sessionStorage.removeItem('miru:reloaded'); } catch {}
if (location.search) history.replaceState(null, '', location.pathname + location.hash);

init();
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
