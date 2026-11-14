import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { registerServiceWorker } from './services/notifications';
import { sound } from './services/audio';
import { haptics } from './services/haptics';

// Notifications in the installed app need a service worker; audio needs unlocking on first tap;
// every button / switch / tab gets a light haptic tap
registerServiceWorker();
sound.installUnlock();
haptics.installGlobal();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

