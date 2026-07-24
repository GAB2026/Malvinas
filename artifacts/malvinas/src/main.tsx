import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';

import App from './App';
import './index.css';

// Register the service worker (no-op in dev mode)
registerSW({
  onOfflineReady() {
    console.log('[PWA] App lista para funcionar sin conexión.');
  },
  onNeedRefresh() {
    // autoUpdate — Workbox applies updates automatically on next reload
  },
});

createRoot(document.getElementById('root')!).render(<App />);
