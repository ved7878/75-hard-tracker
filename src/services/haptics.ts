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

export type HapticPattern = 'selection' | 'light' | 'medium' | 'success' | 'warning';
type Pattern = HapticPattern;

const PATTERNS: Record<Pattern, number | number[]> = {
  selection: 8,
  light: 12,
  medium: 22,
  success: [18, 60, 18, 60, 40],
  warning: [40, 50, 40],
};

/** Taps that count as "pressing something" – buttons, links, switches, tabs, chips… */
const TAPPABLE = [
  'button',
  'a[href]',
  'summary',
  'select',
  'label',
  'input[type="checkbox"]',
  'input[type="radio"]',
  'input[type="range"]',
  'input[type="file"]',
  'input[type="submit"]',
  'input[type="button"]',
  '[role="button"]',
  '[role="switch"]',
  '[role="tab"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="menuitem"]',
  '[role="option"]',
  '[data-haptic]',
].join(',');

/** A stronger pattern feels wrong if a light tap buzz lands right on top of it (and vice versa) */
const DEDUPE_MS = 90;
/** A tap already buzzed: a follow-up light buzz from the same action (e.g. the habit save) is skipped */
const TAP_FOLLOWUP_MS = 600;

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
  private lastPlay = 0;
  private lastPattern: Pattern = 'light';
  private lastTap = 0;
  private globalInstalled = false;

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

  /** `fromTap` is set only by the app-wide tap listener */
  play(pattern: Pattern = 'light', fromTap = false): void {
    if (!this.enabled || typeof navigator === 'undefined') return;
    // One tap often triggers both the global tap buzz and a specific one (e.g. "habit ticked").
    // Within a few ms keep only one: a stronger pattern replaces a light one, a light one is dropped.
    const now = Date.now();
    const weak = pattern === 'selection' || pattern === 'light';
    if (fromTap) this.lastTap = now;
    else if (weak && now - this.lastTap < TAP_FOLLOWUP_MS) return;
    if (now - this.lastPlay < DEDUPE_MS && (weak || pattern === this.lastPattern)) return;
    this.lastPlay = now;
    this.lastPattern = pattern;
    try {
      if (typeof navigator.vibrate === 'function') {
        navigator.vibrate(PATTERNS[pattern]);
        return;
      }
      if (isIOS()) {
        const sw = getIosSwitch();
        if (!sw) return;
        const taps = pattern === 'success' ? 2 : pattern === 'warning' ? 3 : 1;
        for (let i = 0; i < taps; i++) setTimeout(() => sw.click(), i * 90);
      }
    } catch (e) {}
  }

  /**
   * App-wide tap feedback: one listener buzzes lightly for every button, link, switch, tab,
   * checkbox or chip the user presses, so no component has to remember to call it.
   * Mark an element with `data-haptic="medium"` (or success / warning / selection) for a
   * different feel, or `data-haptic="off"` to keep it silent.
   */
  installGlobal(): void {
    if (typeof document === 'undefined' || this.globalInstalled) return;
    this.globalInstalled = true;
    document.addEventListener(
      'click',
      e => {
        if (!e.isTrusted) return; // ignore our own iOS switch clicks and programmatic clicks
        const target = e.target as Element | null;
        if (!target || !(target instanceof Element)) return;
        if (iosSwitch && iosSwitch.contains(target)) return;
        const el = target.closest(TAPPABLE) as HTMLElement | null;
        if (!el) return;
        if ((el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true') return;
        // (A click on a <label> is re-dispatched to its input – the dedupe in play() keeps it to one buzz.)
        const hint = el.closest('[data-haptic]')?.getAttribute('data-haptic');
        if (hint === 'off') return;
        const pattern: Pattern = hint && hint in PATTERNS ? (hint as Pattern) : 'light';
        this.play(pattern, true);
      },
      { capture: true, passive: true }
    );
    // Sliders: a soft tick while dragging
    let lastRange = 0;
    document.addEventListener(
      'input',
      e => {
        const t = e.target as HTMLInputElement | null;
        if (!t || t.type !== 'range') return;
        const now = Date.now();
        if (now - lastRange < 70) return;
        lastRange = now;
        this.play('selection', true);
      },
      { capture: true, passive: true }
    );
  }
}

export const haptics = new Haptics();
