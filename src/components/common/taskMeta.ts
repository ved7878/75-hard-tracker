import {
  AlarmClock,
  Ban,
  WineOff,
  BookOpen,
  Dumbbell,
  Footprints,
  Salad,
  Camera,
  GraduationCap,
  HeartPulse,
  Users,
} from 'lucide-react';
import type { TaskState } from '../../types';

export const TASK_ICONS: Record<keyof TaskState, React.ElementType> = {
  wakeUp: AlarmClock,
  noMasturbation: Ban,
  noSmokingAlcohol: WineOff,
  reading: BookOpen,
  gym: Dumbbell,
  physicalActivity: Footprints,
  diet: Salad,
  progressPhoto: Camera,
  learning: GraduationCap,
  health: HeartPulse,
  family: Users,
};

export const TASK_ORDER: Array<keyof TaskState> = [
  'wakeUp',
  'noMasturbation',
  'noSmokingAlcohol',
  'reading',
  'gym',
  'physicalActivity',
  'diet',
  'progressPhoto',
  'learning',
  'health',
  'family',
];
