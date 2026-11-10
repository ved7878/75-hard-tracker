export type DayStatus = 'completed' | 'incomplete' | 'exempt' | 'future';

export type ActivityType = 'steps' | 'run' | 'floors';

export type UserRole = 'challenger' | 'admin';

export type ExemptionStatus = 'none' | 'pending' | 'approved' | 'rejected';

export interface UserProfile {
  id: string; // 'user_1', 'user_2', 'user_3', 'admin'
  name: string; // e.g. 'Vedant', 'Challenger 2', 'Challenger 3', 'Admin'
  avatar: string; // emoji or initials
  color: string; // accent color class
  role: UserRole;
  pin?: string; // 4-digit PIN
}

export interface HabitConfig {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  required: boolean;
}

export interface ChallengeConfig {
  startDate: string; // YYYY-MM-DD (e.g. '2026-11-11')
  durationDays: number; // 75
  endDate: string; // YYYY-MM-DD (e.g. '2027-01-24')
  depositAmount: number; // 2000 per user
  currencySymbol: string; // '₹'
  wakeUpTarget: string; // '06:00'
  wakeUpTravelTarget: string; // '08:00'
  travelThresholdHours: number; // 4
  readingMinPages: number; // 5
  readingMaxPages: number; // 10
  stepsTarget: number; // 10000
  runTargetKm: number; // 3.0
  floorsTarget: number; // 20
  travelSubstituteSteps: number; // 15000
  travelSubstituteRunKm: number; // 5.0
  familyTargetMinutes: number; // 10
  reminderTime: string; // '21:00'
  reminderEnabled: boolean;
  strictResetOnMiss: boolean; // true - reset streak count to 0 if any task missed
  lockPastDays: boolean; // true - only today is editable for standard users
  adminPin: string; // default '7575'
  requireLogin: boolean; // false by default for quick access, can be toggled
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  autoSyncSupabase: boolean;
}

export interface TravelInfo {
  isTravelling: boolean;
  hours: number;
  gymAvailable: boolean;
  destination?: string;
  notes?: string;
}

export interface SicknessInfo {
  isSick: boolean;
  hasMedicalProof: boolean;
  medicalProofUrl?: string; // base64 or storage url
  medicalProofName?: string;
  doctorNotes?: string;
  isExempt: boolean; // true ONLY when approved by admin
  status: ExemptionStatus; // 'none' | 'pending' | 'approved' | 'rejected'
  reviewedBy?: string;
  reviewedAt?: string;
  adminComment?: string;
}

export interface TaskState {
  wakeUp: {
    completed: boolean;
    actualTime?: string;
    effectiveTarget: string; // '06:00' or '08:00'
  };
  noMasturbation: {
    completed: boolean;
  };
  noSmokingAlcohol: {
    completed: boolean;
  };
  reading: {
    completed: boolean;
    pagesRead: number;
    bookTitle?: string;
    keyTakeaway?: string;
  };
  gym: {
    completed: boolean;
    isSubstituted?: boolean; // if gym was unavailable on travel > 4h
    substituteType?: 'steps' | 'run';
    substituteValue?: number;
    workoutNotes?: string;
  };
  physicalActivity: {
    completed: boolean;
    type: ActivityType;
    value: number; // steps (e.g. 10000), km (e.g. 3.0), or floors (e.g. 20)
  };
  diet: {
    completed: boolean;
    cleanDietChecked: boolean; // no added sugar, low oil, no junk
    notes?: string;
  };
  progressPhoto: {
    completed: boolean;
    photoUrl?: string; // base64 or storage url
    takenAt?: string;
  };
  learning: {
    completed: boolean;
    topic?: string;
    notes?: string;
  };
  health: {
    completed: boolean;
    waterLiters: number;
    mentalHealthMaintained: boolean;
    notes?: string;
  };
  family: {
    completed: boolean;
    minutes: number;
    notes?: string;
  };
}

export interface SportInfo {
  participated: boolean;
  sportName: string;
  durationMinutes: number;
  improvementNotes: string;
}

export interface DailyLog {
  id: string; // e.g. user_1_2026-11-11
  date: string; // YYYY-MM-DD
  userId: string; // 'user_1', 'user_2', or 'user_3'
  dayNumber: number; // 1 to 75
  travel: TravelInfo;
  sickness: SicknessInfo;
  tasks: TaskState;
  sport: SportInfo;
  journalNotes: string;
  status: DayStatus;
  failedTasks: string[]; // list of tasks that were missed if day passed
  isLocked: boolean; // locked once day has passed and finalized
  completedAt?: string;
  updatedAt: string;
}

export interface StreakStats {
  currentStreak: number;
  longestStreak: number;
  resetsCount: number;
  depositStatus: 'safe' | 'forfeited' | 'at_risk';
  depositForfeitedAmount: number;
  depositProtectedAmount: number;
  lastResetDate?: string;
  totalCompletedDays: number;
  totalExemptDays: number;
  totalFailedDays: number;
  completionRate: number; // 0 to 100
  currentDayNumber: number; // day index based on start date
}

export interface SquadMemberStatus {
  user: UserProfile;
  todayCompletedCount: number;
  todayTotalCount: number;
  todayAllCompleted: boolean;
  currentStreak: number;
  depositStatus: 'safe' | 'forfeited' | 'at_risk';
  hasPendingException: boolean;
}

export interface PendingExceptionItem {
  userId: string;
  userName: string;
  userAvatar: string;
  date: string;
  dayNumber: number;
  doctorNotes?: string;
  medicalProofUrl?: string;
  medicalProofName?: string;
  submittedAt?: string;
}
