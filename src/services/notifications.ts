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
      icon: '/icon-192.png',
      badge: '/icon-192.png',
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
      const todayDateStr = now.toISOString().slice(0, 10);

      if (lastSentDate !== todayDateStr) {
        localStorage.setItem('75hard_last_reminder_date', todayDateStr);
        sendLocalNotification('75 HARD – Daily Accountability Check!', {
          body: 'It is 9:00 PM. Have you logged your daily habits, workouts, reading, and photo? Do not let your streak reset to 0!',
          requireInteraction: true,
        });
      }
    }
  };

  // Check every 30 seconds
  reminderInterval = setInterval(checkAndNotify, 30000);
  checkAndNotify();
}

