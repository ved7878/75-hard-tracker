import { sound } from './audio';
import { haptics } from './haptics';

/* ------------------------------------------------------------------ */
/* Service worker                                                      */
/* Android Chrome (and so the installed app) refuses `new Notification`*/
/* from a page – notifications must go through a service worker.       */
/* ------------------------------------------------------------------ */

const META_CACHE = '75hard-meta';
const LAST_SENT_URL = '/__75hard/reminder-last-sent';
const LAST_SENT_LS_KEY = '75hard_last_reminder_date';

let swRegistration: Promise<ServiceWorkerRegistration | null> | null = null;

export function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (swRegistration) return swRegistration;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    swRegistration = Promise.resolve(null);
    return swRegistration;
  }
  swRegistration = navigator.serviceWorker
    .register('/sw.js')
    .then(async reg => {
      await navigator.serviceWorker.ready;
      return reg;
    })
    .catch(err => {
      console.warn('Service worker registration failed:', err);
      return null;
    });
  return swRegistration;
}

/** Ask Chrome to wake the installed app now and then, so the reminder can fire while it's closed. */
async function registerPeriodicReminder(reg: ServiceWorkerRegistration | null): Promise<void> {
  const periodicSync = (reg as any)?.periodicSync;
  if (!periodicSync) return;
  try {
    const status = await (navigator.permissions as any).query({ name: 'periodic-background-sync' });
    if (status.state !== 'granted') return;
    await periodicSync.register('daily-reminder', { minInterval: 60 * 60 * 1000 });
  } catch (e) {
    // Not installed / not supported – the in-app check still runs while the app is open
  }
}

const localDateStr = (d: Date = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** "Already reminded today" is shared with the service worker so the two never double-send. */
async function getLastSent(): Promise<string | null> {
  try {
    if ('caches' in window) {
      const res = await (await caches.open(META_CACHE)).match(LAST_SENT_URL);
      if (res) return await res.json();
    }
  } catch (e) {}
  try {
    return localStorage.getItem(LAST_SENT_LS_KEY);
  } catch (e) {
    return null;
  }
}

async function setLastSent(date: string): Promise<void> {
  try {
    localStorage.setItem(LAST_SENT_LS_KEY, date);
  } catch (e) {}
  try {
    if ('caches' in window) {
      await (await caches.open(META_CACHE)).put(
        LAST_SENT_URL,
        new Response(JSON.stringify(date), { headers: { 'Content-Type': 'application/json' } })
      );
    }
  } catch (e) {}
}

/* ------------------------------------------------------------------ */

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.warn('This browser does not support notifications.');
    return false;
  }
  if (Notification.permission === 'granted') return true;
  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  return false;
}

/**
 * Shows a notification with sound + vibration. Goes through the service worker (required in
 * the installed app on Android), falling back to the page API on desktop browsers.
 * Resolves false when it could not be shown.
 */
export async function sendLocalNotification(title: string, options: NotificationOptions = {}): Promise<boolean> {
  if (!('Notification' in window) || Notification.permission !== 'granted') return false;

  const full: NotificationOptions & { vibrate?: number[]; renotify?: boolean } = {
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    tag: '75hard-reminder',
    renotify: true,
    silent: false,
    vibrate: [200, 100, 200],
    data: { url: '/' },
    ...options,
  };

  // The app is on screen: phones usually don't play the notification sound for the app
  // you're looking at, so play our own chime + buzz too.
  if (document.visibilityState === 'visible') {
    sound.playReminder();
    haptics.play('warning');
  }

  try {
    const reg = await Promise.race([
      registerServiceWorker(),
      new Promise<null>(resolve => setTimeout(() => resolve(null), 4000)),
    ]);
    if (reg) {
      await reg.showNotification(title, full);
      return true;
    }
  } catch (e) {
    console.warn('Service worker notification failed, trying page notification:', e);
  }

  try {
    new Notification(title, full);
    return true;
  } catch (e) {
    console.error('Notification error:', e);
    return false;
  }
}

let reminderInterval: ReturnType<typeof setInterval> | null = null;
let reminderVisibilityHandler: (() => void) | null = null;

export function setupDailyReminder(reminderTime: string = '21:00', isEnabled: boolean = true): void {
  if (reminderInterval) {
    clearInterval(reminderInterval);
    reminderInterval = null;
  }
  if (reminderVisibilityHandler) {
    document.removeEventListener('visibilitychange', reminderVisibilityHandler);
    reminderVisibilityHandler = null;
  }

  // Tell the service worker, so it can remind while the installed app is closed
  registerServiceWorker().then(reg => {
    reg?.active?.postMessage({ type: 'SET_REMINDER_PREFS', prefs: { enabled: isEnabled, time: reminderTime } });
    if (isEnabled) registerPeriodicReminder(reg);
  });

  if (!isEnabled) return;

  let checking = false;
  const checkAndNotify = async () => {
    if (checking) return;
    checking = true;
    try {
      const now = new Date();
      const current = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      // Any time from the reminder time until midnight – phones pause timers in the
      // background, so an exact-minute match was usually missed.
      if (current < reminderTime) return;
      const today = localDateStr(now);
      if ((await getLastSent()) === today) return;
      if (Notification?.permission !== 'granted') return;
      await setLastSent(today);
      await sendLocalNotification('75 HARD – Daily Accountability Check!', {
        body: 'Have you logged every habit, your workout and your photo? Finish before midnight to keep your streak.',
        requireInteraction: true,
      });
    } finally {
      checking = false;
    }
  };

  reminderInterval = setInterval(checkAndNotify, 30000);
  reminderVisibilityHandler = () => {
    if (document.visibilityState === 'visible') checkAndNotify();
  };
  document.addEventListener('visibilitychange', reminderVisibilityHandler);
  checkAndNotify();
}

/* ------------------------------------------------------------------ */
/* Per-device reminder preferences                                     */
/* Reminders are personal, so they live on this device instead of in  */
/* the shared challenge config (which would change it for everyone).   */
/* ------------------------------------------------------------------ */

const REMINDER_PREFS_KEY = '75hard_reminder_prefs';

export interface ReminderPrefs {
  enabled: boolean;
  time: string;
}

export function notificationPermission(): NotificationPermission | 'unsupported' {
  return typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported';
}

export function getReminderPrefs(fallback: ReminderPrefs = { enabled: true, time: '21:00' }): ReminderPrefs {
  try {
    const raw = localStorage.getItem(REMINDER_PREFS_KEY);
    if (raw) return { ...fallback, ...JSON.parse(raw) };
  } catch (e) {}
  // Never show the reminder as "on" before the phone has actually allowed notifications
  return { ...fallback, enabled: fallback.enabled && notificationPermission() === 'granted' };
}

export function saveReminderPrefs(prefs: ReminderPrefs): void {
  try {
    localStorage.setItem(REMINDER_PREFS_KEY, JSON.stringify(prefs));
  } catch (e) {}
  setupDailyReminder(prefs.time, prefs.enabled);
}
