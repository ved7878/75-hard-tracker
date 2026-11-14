import { sound } from './audio';
import { haptics } from './haptics';

/**
 * One place for "something happened" feedback, so every screen gives the same sound +
 * vibration (and the Settings switches control all of it).
 */
export const feedback = {
  /** A habit was ticked */
  tick() {
    sound.playTaskCheck();
    haptics.play('light');
  },
  /** Every required habit for the day is done */
  dayComplete() {
    sound.playDayComplete();
    haptics.play('success');
  },
  /** Something was blocked or failed (e.g. a save that didn't reach the cloud) */
  warn() {
    haptics.play('warning');
  },
  /** Plain tap feedback (toggles, buttons) */
  tap() {
    haptics.play('light');
  },
};
