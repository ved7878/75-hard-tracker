import { sound } from './audio';
import { haptics } from './haptics';

/* ------------------------------------------------------------------ */
/* Service worker                                                      */
/* Android Chrome (and so the installed app) refuses `new Notification`*/
/* from a page – notifications must go through a service worker.       */
/* ------------------------------------------------------------------ */

const META_CACHE = '75hard-meta';
// "Already sent today" per reminder – shared with the service worker so the two never double-send
const SLOT_META = {
  evening: { url: '/__75hard/reminder-last-sent', lsKey: '75hard_last_reminder_date' },
  midday: { url: '/__75hard/midday-last-sent', lsKey: '75hard_last_midday_date' },
} as const;
const CONTENT_URL = '/__75hard/reminder-content';
const CONTENT_LS_KEY = '75hard_reminder_content';

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

/** Ask Chrome to wake the installed app now and then, so reminders can fire while it's closed. */
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

/* Small JSON values shared with the service worker (it can't read localStorage) */
async function readMeta<T>(url: string, lsKey: string): Promise<T | null> {
  try {
    if ('caches' in window) {
      const res = await (await caches.open(META_CACHE)).match(url);
      if (res) return (await res.json()) as T;
    }
  } catch (e) {}
  try {
    const raw = localStorage.getItem(lsKey);
    if (raw == null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch (e) {
      return raw as unknown as T; // older builds stored the bare date string
    }
  } catch (e) {
    return null;
  }
}

async function writeMeta(url: string, lsKey: string, value: unknown): Promise<void> {
  try {
    localStorage.setItem(lsKey, JSON.stringify(value));
  } catch (e) {}
  try {
    if ('caches' in window) {
      await (await caches.open(META_CACHE)).put(
        url,
        new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } })
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

/* ------------------------------------------------------------------ */
/* Daily reminders                                                     */
/*  • Midday push (default 2:30 PM): "6/11 done – 5 to go" motivation  */
/*  • Bedtime (default 10 PM): log everything before you sleep         */
/* The text is built here from today's real progress and handed to the */
/* service worker too, so a background reminder says the same thing.   */
/* ------------------------------------------------------------------ */

export type ReminderSlot = 'midday' | 'evening';

export interface ReminderProgress {
  date: string; // YYYY-MM-DD
  dayNumber: number;
  /** false before the challenge starts / after it ends – no reminders then */
  active: boolean;
  done: number;
  total: number;
  allDone: boolean;
  /** Required habits not done yet */
  pending: string[];
}

export interface ReminderMessage {
  title: string;
  body: string;
}

/** What the service worker needs to send today's reminders on its own */
interface ReminderContent {
  date: string;
  active: boolean;
  allDone: boolean;
  midday: ReminderMessage;
  evening: ReminderMessage;
}

const MIDDAY_LINES = [
  'Strong start – now finish stronger.',
  'Momentum is on your side. Keep stacking wins.',
  'Discipline beats motivation. Knock out the next one.',
  'Every tick is a vote for who you are becoming.',
  'Half the day left, plenty of time. Go get it.',
  "You didn't come this far to only come this far.",
  'Small wins, every day. That is the whole game.',
];

const listNames = (names: string[], max = 3) =>
  names.length <= max ? names.join(', ') : `${names.slice(0, max).join(', ')} +${names.length - max} more`;

export function buildReminderMessage(slot: ReminderSlot, p: ReminderProgress | null): ReminderMessage {
  if (slot === 'midday') {
    if (!p) {
      return {
        title: '75 HARD · Midday check-in',
        body: 'Half the day is gone. How many habits are ticked? Open the app and keep the streak alive.',
      };
    }
    const day = `Day ${p.dayNumber}`;
    const left = p.pending.length;
    if (p.allDone) {
      return {
        title: `${day} · ${p.done}/${p.total} done 🔥`,
        body: 'Everything is already logged. Beast mode – enjoy the rest of your day.',
      };
    }
    if (left === 0) {
      return {
        title: `${day} · ${p.done}/${p.total} done`,
        body: 'Everything you can still log today is done. Stay clean till midnight.',
      };
    }
    if (p.done === 0) {
      return {
        title: `${day} · 0/${p.total} done – let's go`,
        body: `Clean slate, still plenty of time. Start with ${p.pending[0] || 'one habit'} and build momentum.`,
      };
    }
    const line = MIDDAY_LINES[Math.abs(p.dayNumber) % MIDDAY_LINES.length];
    return {
      title: `${day} · ${p.done}/${p.total} done 💪 ${left} to go`,
      body: `${line} Still pending: ${listNames(p.pending)}.`,
    };
  }

  // Bedtime
  if (!p) {
    return {
      title: '75 HARD – Log it before bed',
      body: 'Have you logged every habit, your workout and your photo? Finish before midnight to keep your streak.',
    };
  }
  if (p.allDone) {
    return {
      title: `Day ${p.dayNumber} complete ✅`,
      body: `All ${p.total} habits logged. Sleep well – you earned it.`,
    };
  }
  const left = p.pending.length;
  if (left === 0) {
    return {
      title: `Day ${p.dayNumber} · nothing left to log`,
      body: 'Everything you could log today is in. Sleep well and go again tomorrow.',
    };
  }
  return {
    title: `Before bed: ${left} habit${left === 1 ? '' : 's'} left to log`,
    body: `Log ${listNames(p.pending)} before you sleep. Midnight ends Day ${p.dayNumber} – don't break the streak.`,
  };
}

let currentProgress: ReminderProgress | null = null;
let lastContentJson = '';

/** Called by the app whenever today's habits change, so reminders show real numbers. */
export function setReminderProgress(p: ReminderProgress | null): void {
  currentProgress = p;
  const content: ReminderContent | null = p
    ? {
        date: p.date,
        active: p.active,
        allDone: p.allDone,
        midday: buildReminderMessage('midday', p),
        evening: buildReminderMessage('evening', p),
      }
    : null;
  const json = JSON.stringify(content);
  if (json === lastContentJson) return;
  lastContentJson = json;
  writeMeta(CONTENT_URL, CONTENT_LS_KEY, content);
  registerServiceWorker().then(reg => reg?.active?.postMessage({ type: 'SET_REMINDER_CONTENT', content }));
}

/** The reminder that would go out right now for this slot (used by "Send test notification") */
export function previewReminder(slot: ReminderSlot): ReminderMessage {
  const p = currentProgress && currentProgress.date === localDateStr() ? currentProgress : null;
  return buildReminderMessage(slot, p);
}

const addMinutes = (hhmm: string, mins: number) => {
  const [h, m] = hhmm.split(':').map(Number);
  const t = Math.min(h * 60 + m + mins, 23 * 60 + 59);
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

/**
 * When each reminder may go out. Phones pause timers in the background, so instead of an
 * exact minute we allow a window: bedtime until midnight, midday for up to 3 hours (and
 * never once the bedtime reminder is due – no point sending both at once).
 */
export function reminderWindow(slot: ReminderSlot, prefs: ReminderPrefs): { from: string; until: string } | null {
  if (slot === 'evening') return prefs.enabled ? { from: prefs.time, until: '23:59' } : null;
  if (!prefs.middayEnabled) return null;
  let until = addMinutes(prefs.middayTime, 180);
  if (prefs.enabled && prefs.time > prefs.middayTime && prefs.time < until) until = prefs.time;
  return { from: prefs.middayTime, until };
}

let reminderInterval: ReturnType<typeof setInterval> | null = null;
let reminderVisibilityHandler: (() => void) | null = null;

export function setupReminders(prefs: ReminderPrefs): void {
  if (reminderInterval) {
    clearInterval(reminderInterval);
    reminderInterval = null;
  }
  if (reminderVisibilityHandler) {
    document.removeEventListener('visibilitychange', reminderVisibilityHandler);
    reminderVisibilityHandler = null;
  }

  const anyOn = prefs.enabled || prefs.middayEnabled;

  // Tell the service worker, so it can remind while the installed app is closed
  registerServiceWorker().then(reg => {
    reg?.active?.postMessage({ type: 'SET_REMINDER_PREFS', prefs });
    if (anyOn) registerPeriodicReminder(reg);
  });

  if (!anyOn) return;

  let checking = false;
  const checkAndNotify = async () => {
    if (checking) return;
    checking = true;
    try {
      if (!('Notification' in window) || Notification.permission !== 'granted') return;
      const now = new Date();
      const current = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const today = localDateStr(now);
      const progress = currentProgress && currentProgress.date === today ? currentProgress : null;
      if (progress && !progress.active) return; // challenge not running today

      for (const slot of ['evening', 'midday'] as const) {
        const win = reminderWindow(slot, prefs);
        if (!win || current < win.from || current > win.until) continue;
        const meta = SLOT_META[slot];
        if ((await readMeta<string>(meta.url, meta.lsKey)) === today) continue;
        await writeMeta(meta.url, meta.lsKey, today);
        const msg = buildReminderMessage(slot, progress);
        await sendLocalNotification(msg.title, {
          body: msg.body,
          tag: slot === 'midday' ? '75hard-midday' : '75hard-reminder',
          requireInteraction: slot === 'evening' && !(progress && progress.allDone),
        });
        break; // at most one reminder per check
      }
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
const OLD_DEFAULT_TIME = '21:00';
export const DEFAULT_BEDTIME = '22:00';
export const DEFAULT_MIDDAY_TIME = '14:30';

export interface ReminderPrefs {
  /** Bedtime reminder */
  enabled: boolean;
  time: string;
  /** Midday progress push */
  middayEnabled: boolean;
  middayTime: string;
}

export function notificationPermission(): NotificationPermission | 'unsupported' {
  return typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported';
}

const bedtimeOrDefault = (t?: string) => (!t || t === OLD_DEFAULT_TIME ? DEFAULT_BEDTIME : t);

export function getReminderPrefs(fallback: Partial<ReminderPrefs> = {}): ReminderPrefs {
  const baseEnabled = fallback.enabled ?? true;
  const base: ReminderPrefs = {
    enabled: baseEnabled,
    time: bedtimeOrDefault(fallback.time),
    middayEnabled: fallback.middayEnabled ?? baseEnabled,
    middayTime: fallback.middayTime || DEFAULT_MIDDAY_TIME,
  };
  try {
    const raw = localStorage.getItem(REMINDER_PREFS_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<ReminderPrefs>;
      // Saved before the midday push existed: move the old 9 PM default to bedtime (10 PM)
      // and switch the new midday push on together with the bedtime reminder.
      if (saved.middayTime === undefined) {
        const enabled = saved.enabled ?? base.enabled;
        return { enabled, time: bedtimeOrDefault(saved.time), middayEnabled: enabled, middayTime: DEFAULT_MIDDAY_TIME };
      }
      return { ...base, ...saved };
    }
  } catch (e) {}
  // Never show a reminder as "on" before the phone has actually allowed notifications
  const granted = notificationPermission() === 'granted';
  return { ...base, enabled: base.enabled && granted, middayEnabled: base.middayEnabled && granted };
}

export function saveReminderPrefs(prefs: ReminderPrefs): void {
  try {
    localStorage.setItem(REMINDER_PREFS_KEY, JSON.stringify(prefs));
  } catch (e) {}
  setupReminders(prefs);
}
