import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { registerServiceWorker } from './services/notifications';
import { sound } from './services/audio';

// Notifications in the installed app need a service worker; audio needs unlocking on first tap
registerServiceWorker();
sound.installUnlock();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

