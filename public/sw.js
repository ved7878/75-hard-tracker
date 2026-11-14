/* 75 HARD service worker
 *
 * Needed for notifications in the installed app: Android Chrome does not allow
 * `new Notification()` from a page – only `registration.showNotification()`.
 * It deliberately does NOT cache the app (no fetch handler), so a new deploy is always
 * picked up straight away.
 */

const META_CACHE = '75hard-meta';
const PREFS_URL = '/__75hard/reminder-prefs';
const LAST_SENT_URL = '/__75hard/reminder-last-sent';
const MIDDAY_LAST_SENT_URL = '/__75hard/midday-last-sent';
const CONTENT_URL = '/__75hard/reminder-content';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const nowHHMM = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

async function readMeta(url) {
  try {
    const cache = await caches.open(META_CACHE);
    const res = await cache.match(url);
    return res ? await res.json() : null;
  } catch (e) {
    return null;
  }
}

async function writeMeta(url, value) {
  try {
    const cache = await caches.open(META_CACHE);
    await cache.put(url, new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } }));
  } catch (e) {}
}

// Used when the app hasn't told us today's progress yet (the app builds the real text –
// "6/11 done, 5 to go" – and sends it here via SET_REMINDER_CONTENT).
const FALLBACK = {
  midday: {
    title: '75 HARD · Midday check-in',
    body: 'Half the day is gone. How many habits are ticked? Open the app and keep the streak alive.',
  },
  evening: {
    title: '75 HARD – Log it before bed',
    body: 'Have you logged every habit, your workout and your photo? Finish before midnight to keep your streak.',
  },
};

const LAST_SENT = { evening: LAST_SENT_URL, midday: MIDDAY_LAST_SENT_URL };

const addMinutes = (hhmm, mins) => {
  const [h, m] = hhmm.split(':').map(Number);
  const t = Math.min(h * 60 + m + mins, 23 * 60 + 59);
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

/** Same windows as the app: bedtime until midnight, midday for up to 3 h (and not past bedtime) */
function reminderWindow(slot, prefs) {
  if (slot === 'evening') return prefs.enabled && prefs.time ? { from: prefs.time, until: '23:59' } : null;
  if (!prefs.middayEnabled || !prefs.middayTime) return null;
  let until = addMinutes(prefs.middayTime, 180);
  if (prefs.enabled && prefs.time > prefs.middayTime && prefs.time < until) until = prefs.time;
  return { from: prefs.middayTime, until };
}

function show(title, options = {}) {
  return self.registration.showNotification(title, {
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    tag: '75hard-reminder',
    renotify: true,
    silent: false, // play the phone's notification sound
    vibrate: [200, 100, 200],
    data: { url: '/' },
    ...options,
  });
}

/** Background fallback: Chrome wakes installed apps now and then via Periodic Background Sync */
async function maybeSendReminder() {
  const prefs = await readMeta(PREFS_URL);
  if (!prefs) return;
  const today = todayStr();
  const now = nowHHMM();
  const content = await readMeta(CONTENT_URL);
  const fresh = content && content.date === today ? content : null;
  if (fresh && fresh.active === false) return; // challenge not running today

  for (const slot of ['evening', 'midday']) {
    const win = reminderWindow(slot, prefs);
    if (!win || now < win.from || now > win.until) continue;
    if ((await readMeta(LAST_SENT[slot])) === today) continue;
    await writeMeta(LAST_SENT[slot], today);
    const msg = (fresh && fresh[slot]) || FALLBACK[slot];
    const allDone = Boolean(fresh && fresh.allDone);
    await show(msg.title, {
      body: msg.body,
      tag: slot === 'midday' ? '75hard-midday' : '75hard-reminder',
      requireInteraction: slot === 'evening' && !allDone,
    });
    return;
  }
}

self.addEventListener('periodicsync', event => {
  if (event.tag === 'daily-reminder') event.waitUntil(maybeSendReminder());
});

self.addEventListener('message', event => {
  const msg = event.data || {};
  if (msg.type === 'SET_REMINDER_PREFS') event.waitUntil(writeMeta(PREFS_URL, msg.prefs));
  if (msg.type === 'SET_REMINDER_CONTENT') event.waitUntil(writeMeta(CONTENT_URL, msg.content));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if ('focus' in client) return client.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
