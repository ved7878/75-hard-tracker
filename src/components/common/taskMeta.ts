import React from 'react';
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
  Sparkles,
  Flame,
  Target,
  Droplets,
  Brain,
  Zap,
  Coffee,
  CheckCircle2,
} from 'lucide-react';
import type { TaskState } from '../../types';

export const TASK_ICONS: Record<string, React.ElementType> = {
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
  Sparkles,
  Flame,
  Target,
  Droplets,
  Brain,
  Zap,
  Coffee,
  CheckCircle2,
};

export const AVAILABLE_HABIT_ICONS = [
  { id: 'Sparkles', icon: Sparkles, label: 'Star / Glow' },
  { id: 'Target', icon: Target, label: 'Target / Focus' },
  { id: 'Flame', icon: Flame, label: 'Flame / Discipline' },
  { id: 'Droplets', icon: Droplets, label: 'Water / Cold Shower' },
  { id: 'Brain', icon: Brain, label: 'Mind / Meditation' },
  { id: 'Zap', icon: Zap, label: 'Energy / Speed' },
  { id: 'Dumbbell', icon: Dumbbell, label: 'Workout' },
  { id: 'BookOpen', icon: BookOpen, label: 'Study / Journal' },
  { id: 'Footprints', icon: Footprints, label: 'Steps / Walking' },
  { id: 'Coffee', icon: Coffee, label: 'Routine' },
];

export function getTaskIcon(id: string, iconName?: string): React.ElementType {
  if (iconName && TASK_ICONS[iconName]) return TASK_ICONS[iconName];
  if (TASK_ICONS[id]) return TASK_ICONS[id];
  return Sparkles;
}

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
