export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.warn('This browser does not support notifications.');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
}

export function sendLocalNotification(title: string, options?: NotificationOptions): void {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  try {
    new Notification(title, {
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      tag: '75hard-reminder',
      ...options,
    });
  } catch (e) {
    console.error('Notification error:', e);
  }
}

let reminderInterval: any = null;

export function setupDailyReminder(reminderTime: string = '21:00', isEnabled: boolean = true): void {
  if (reminderInterval) {
    clearInterval(reminderInterval);
    reminderInterval = null;
  }

  if (!isEnabled) return;

  const checkAndNotify = () => {
    const now = new Date();
    const currentHours = String(now.getHours()).padStart(2, '0');
    const currentMinutes = String(now.getMinutes()).padStart(2, '0');
    const currentTimeStr = `${currentHours}:${currentMinutes}`;

    if (currentTimeStr === reminderTime) {
      const lastSentDate = localStorage.getItem('75hard_last_reminder_date');
      // local date (toISOString would use UTC and could skip/duplicate a day in IST)
      const todayDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      if (lastSentDate !== todayDateStr) {
        localStorage.setItem('75hard_last_reminder_date', todayDateStr);
        sendLocalNotification('75 HARD – Daily Accountability Check!', {
          body: 'Have you logged every habit, your workout and your photo? Finish before midnight to keep your streak.',
          requireInteraction: true,
        });
      }
    }
  };

  // Check every 30 seconds
  reminderInterval = setInterval(checkAndNotify, 30000);
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
