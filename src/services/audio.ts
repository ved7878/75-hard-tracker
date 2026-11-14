// Zero-dependency Web Audio API sound effects for athletic haptic feedback

class SoundEffects {
  private ctx: AudioContext | null = null;
  private isEnabled: boolean = true;
  private unlockInstalled = false;

  constructor() {
    try {
      this.isEnabled = localStorage.getItem('75hard_sound_enabled') !== 'false';
    } catch (e) {}
  }

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    return this.ctx;
  }

  /**
   * Installed apps (Chrome "Install app", iOS home screen) start the audio engine suspended
   * and suspend it again whenever the app goes to the background. A sound scheduled on a
   * suspended engine is silently dropped – so wait for it to be running, then play.
   */
  private withRunningContext(play: (ctx: AudioContext) => void): void {
    const ctx = this.getContext();
    if (!ctx) return;
    if (ctx.state === 'running') {
      play(ctx);
      return;
    }
    if (ctx.state === 'closed') return;
    ctx
      .resume()
      .then(() => {
        if (ctx.state === 'running') play(ctx);
      })
      .catch(() => {});
  }

  /**
   * Call once at startup: unlocks audio on the first tap (browsers only allow it inside a
   * user gesture) and wakes it again when the app comes back to the foreground.
   */
  installUnlock(): void {
    if (typeof window === 'undefined' || this.unlockInstalled) return;
    this.unlockInstalled = true;
    const unlock = () => {
      const ctx = this.getContext();
      if (!ctx) return;
      if (ctx.state !== 'running') ctx.resume().catch(() => {});
      // A silent one-sample buffer fully unlocks iOS / Android WebAudio
      try {
        const buf = ctx.createBuffer(1, 1, 22050);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(ctx.destination);
        src.start(0);
      } catch (e) {}
    };
    ['pointerdown', 'touchend', 'keydown'].forEach(ev => window.addEventListener(ev, unlock, { capture: true, passive: true }));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.ctx && this.ctx.state !== 'running') {
        this.ctx.resume().catch(() => {});
      }
    });
  }

  setSoundEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    try {
      localStorage.setItem('75hard_sound_enabled', enabled ? 'true' : 'false');
    } catch (e) {}
  }

  getSoundEnabled(): boolean {
    return this.isEnabled;
  }

  // Crisp athletic task tick
  playTaskCheck(): void {
    if (!this.isEnabled) return;
    try {
      this.withRunningContext(ctx => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.08); // A5

        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 0.08);
      });
    } catch (e) {
      // Audio autoplay policy fallback
    }
  }

  // Day complete fanfare
  playDayComplete(): void {
    if (!this.isEnabled) return;
    try {
      this.withRunningContext(ctx => {
        const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          const startTime = ctx.currentTime + idx * 0.1;
          const duration = 0.25;

          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, startTime);

          gain.gain.setValueAtTime(0.18, startTime);
          gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(startTime);
          osc.stop(startTime + duration);
        });
      });
    } catch (e) {}
  }

  // Two soft notes for the daily reminder when the app is open
  playReminder(): void {
    if (!this.isEnabled) return;
    try {
      this.withRunningContext(ctx => {
        [880, 1174.66].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const t = ctx.currentTime + idx * 0.18;
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, t);
          gain.gain.setValueAtTime(0.0001, t);
          gain.gain.exponentialRampToValueAtTime(0.2, t + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t);
          osc.stop(t + 0.36);
        });
      });
    } catch (e) {}
  }

  // Streak reset warning sound
  playResetAlert(): void {
    if (!this.isEnabled) return;
    try {
      this.withRunningContext(ctx => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.3);

        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      });
    } catch (e) {}
  }
}

export const sound = new SoundEffects();

