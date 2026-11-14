/**
 * Haptic feedback for the installed app.
 *
 * - Android Chrome / installed PWA: the Vibration API (navigator.vibrate).
 * - iOS Safari / home-screen app (iOS 18+): there is no Vibration API, but tapping a native
 *   `<input type="checkbox" switch>` produces the system haptic, so we toggle a hidden one.
 * - Desktop: no-op.
 *
 * Both only work while handling a tap (browser user-activation rules), which is exactly when
 * we call them.
 */

const HAPTICS_KEY = '75hard_haptics_enabled';

type Pattern = 'light' | 'success' | 'warning';

const PATTERNS: Record<Pattern, number | number[]> = {
  light: 12,
  success: [18, 60, 18, 60, 40],
  warning: [40, 50, 40],
};

let iosSwitch: HTMLLabelElement | null = null;

function getIosSwitch(): HTMLLabelElement | null {
  if (typeof document === 'undefined') return null;
  if (iosSwitch && document.body.contains(iosSwitch)) return iosSwitch;
  const label = document.createElement('label');
  label.setAttribute('aria-hidden', 'true');
  label.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('switch', '');
  input.tabIndex = -1;
  label.appendChild(input);
  document.body.appendChild(label);
  iosSwitch = label;
  return label;
}

const isIOS = () =>
  typeof navigator !== 'undefined' &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

class Haptics {
  private enabled = true;

  constructor() {
    try {
      this.enabled = localStorage.getItem(HAPTICS_KEY) !== 'false';
    } catch (e) {}
  }

  /** Vibration (Android) or the iOS switch trick is available on this device */
  isSupported(): boolean {
    if (typeof navigator === 'undefined') return false;
    return typeof navigator.vibrate === 'function' || isIOS();
  }

  getEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    try {
      localStorage.setItem(HAPTICS_KEY, enabled ? 'true' : 'false');
    } catch (e) {}
  }

  play(pattern: Pattern = 'light'): void {
    if (!this.enabled || typeof navigator === 'undefined') return;
    try {
      if (typeof navigator.vibrate === 'function') {
        navigator.vibrate(PATTERNS[pattern]);
        return;
      }
      if (isIOS()) {
        const sw = getIosSwitch();
        if (!sw) return;
        const taps = pattern === 'light' ? 1 : pattern === 'success' ? 2 : 3;
        for (let i = 0; i < taps; i++) setTimeout(() => sw.click(), i * 90);
      }
    } catch (e) {}
  }
}

export const haptics = new Haptics();
