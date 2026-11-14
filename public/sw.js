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

const REMINDER = {
  title: '75 HARD – Daily Accountability Check!',
  body: 'Have you logged every habit, your workout and your photo? Finish before midnight to keep your streak.',
};

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
  if (!prefs || !prefs.enabled || !prefs.time) return;
  const last = await readMeta(LAST_SENT_URL);
  if (last === todayStr() || nowHHMM() < prefs.time) return;
  await writeMeta(LAST_SENT_URL, todayStr());
  await show(REMINDER.title, { body: REMINDER.body, requireInteraction: true });
}

self.addEventListener('periodicsync', event => {
  if (event.tag === 'daily-reminder') event.waitUntil(maybeSendReminder());
});

self.addEventListener('message', event => {
  const msg = event.data || {};
  if (msg.type === 'SET_REMINDER_PREFS') event.waitUntil(writeMeta(PREFS_URL, msg.prefs));
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
