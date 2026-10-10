import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/plus-jakarta-sans';
import './index.css';
import { App } from './App';

if (import.meta.env.DEV) {
  // Debug handle for development and automated QA (never included in production builds).
  void Promise.all([import('./services/audioEngine'), import('./state/playerStore'), import('./state/settingsStore')]).then(
    ([engine, playerMod, settings]) => {
      (window as unknown as { __musicwave: unknown }).__musicwave = {
        engine: engine.getAudioEngine(),
        player: playerMod.player,
        playerStore: playerMod.playerStore,
        settingsStore: settings.settingsStore,
      };
    },
  );
}

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  // Precached app shell: MusicWave opens offline, and downloaded music plays from IndexedDB.
  window.addEventListener('load', () => void navigator.serviceWorker.register('/sw.js').catch(() => undefined));
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
