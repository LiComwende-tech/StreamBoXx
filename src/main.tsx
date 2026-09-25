import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import './player.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch(() => {
      // The site remains usable if this browser does not allow offline installation.
    });
  });
}
