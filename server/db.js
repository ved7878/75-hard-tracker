import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
const STORE_FILE = path.join(DATA_DIR, 'store.json');

// Initial Default Configuration
export const DEFAULT_CONFIG = {
  startDate: '2026-11-11',
  durationDays: 75,
  endDate: '2027-01-24',
  depositAmount: 2000,
  currencySymbol: '₹',
  wakeUpTarget: '06:00',
  wakeUpTravelTarget: '08:00',
  travelThresholdHours: 4,
  readingMinPages: 5,
  readingMaxPages: 10,
  stepsTarget: 10000,
  runTargetKm: 3.0,
  floorsTarget: 20,
  travelSubstituteSteps: 15000,
  travelSubstituteRunKm: 5.0,
  familyTargetMinutes: 10,
  reminderTime: '21:00',
  reminderEnabled: true,
  strictResetOnMiss: true,
  lockPastDays: true,
  adminPin: '7575',
};

// Initial Default 3 Challengers + 1 Admin
export const DEFAULT_USERS = [
  {
    id: 'user_1',
    username: 'vedant',
    name: 'Vedant',
    password: 'vedant123',
    pin: '1111',
    avatar: '🦁',
    color: 'from-rose-600 to-rose-700',
    role: 'challenger',
    depositAmount: 2000,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'user_2',
    username: 'vedansh',
    name: 'Vedansh',
    password: 'vedansh123',
    pin: '2222',
    avatar: '🐺',
    color: 'from-blue-600 to-indigo-700',
    role: 'challenger',
    depositAmount: 2000,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'user_3',
    username: 'aryaman',
    name: 'Aryaman',
    password: 'aryaman123',
    pin: '3333',
    avatar: '🦅',
    color: 'from-amber-500 to-orange-600',
    role: 'challenger',
    depositAmount: 2000,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'admin',
    username: 'admin',
    name: 'Referee / Admin',
    password: 'admin7575',
    pin: '7575',
    avatar: '⚖️',
    color: 'from-purple-600 to-indigo-800',
    role: 'admin',
    depositAmount: 0,
    createdAt: new Date().toISOString(),
  },
];

class DatabaseManager {
  constructor() {
    this.store = {
      config: { ...DEFAULT_CONFIG },
      users: [...DEFAULT_USERS],
      logs: {
        user_1: {},
        user_2: {},
        user_3: {},
      },
      dbSettings: {
        supabaseUrl: process.env.SUPABASE_URL || '',
        supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
      },
    };
    this.supabaseClient = null;
    this.init();
  }

  init() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(STORE_FILE)) {
      try {
        const raw = fs.readFileSync(STORE_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        let loadedUsers = Array.isArray(parsed.users) && parsed.users.length > 0 ? parsed.users : [...DEFAULT_USERS];
        
        // Auto-merge with DEFAULT_USERS to populate missing password, pin, username fields
        loadedUsers = loadedUsers.map(u => {
          const def = DEFAULT_USERS.find(d => d.id === u.id || d.username?.toLowerCase() === u.username?.toLowerCase() || d.name?.toLowerCase() === u.name?.toLowerCase());
          if (def) {
            return {
              ...def,
              ...u,
              username: u.username || def.username,
              password: u.password || def.password,
              pin: u.pin || def.pin,
            };
          }
          return u;
        });

        if (!loadedUsers.some(u => u.role === 'admin' || u.id === 'admin')) {
          loadedUsers.push(DEFAULT_USERS[3]);
        }

        this.store = {
          config: { ...DEFAULT_CONFIG, ...(parsed.config || {}) },
          users: loadedUsers,
          logs: parsed.logs || { user_1: {}, user_2: {}, user_3: {} },
          dbSettings: {
            supabaseUrl: process.env.SUPABASE_URL || parsed.dbSettings?.supabaseUrl || '',
            supabaseAnonKey: process.env.SUPABASE_ANON_KEY || parsed.dbSettings?.supabaseAnonKey || '',
          },
        };
        this.save();
      } catch (e) {
        console.error('Failed to load store.json, using defaults', e);
        this.save();
      }
    } else {
      this.save();
    }

    this.initSupabase();
  }

  save() {
    try {
      fs.writeFileSync(STORE_FILE, JSON.stringify(this.store, null, 2), 'utf-8');
    } catch (e) {
      console.error('Failed to save store.json', e);
    }
  }

  initSupabase() {
    const { supabaseUrl, supabaseAnonKey } = this.store.dbSettings;
    if (supabaseUrl && supabaseAnonKey) {
      try {
        this.supabaseClient = createClient(supabaseUrl.trim(), supabaseAnonKey.trim());
        console.log('✓ Connected to Supabase backend client!');
      } catch (e) {
        console.error('Failed to init Supabase client:', e);
        this.supabaseClient = null;
      }
    } else {
      this.supabaseClient = null;
    }
  }

  // --- CONFIG METHODS (Admin Only) ---
  getConfig() {
    return this.store.config;
  }

  updateConfig(patch) {
    this.store.config = { ...this.store.config, ...patch };
    this.save();
    return this.store.config;
  }

  // --- USER METHODS (Admin Only & Auth) ---
  getUsers(includeSecrets = false) {
    if (includeSecrets) {
      return this.store.users;
    }
    return this.store.users.map(({ pin, password, recoveryAnswer, ...safeUser }) => safeUser);
  }

  findUserByCredentials(username, secret) {
    const cleanUsername = String(username).trim().toLowerCase();
    const cleanSecret = String(secret).trim();
    return this.store.users.find(
      u =>
        (u.username?.toLowerCase() === cleanUsername ||
          u.name?.toLowerCase() === cleanUsername ||
          u.id?.toLowerCase() === cleanUsername ||
          u.email?.toLowerCase() === cleanUsername) &&
        (u.pin === cleanSecret || u.password === cleanSecret)
    );
  }

  forgotPassword(usernameOrEmail, recoveryKey, newPassword) {
    const cleanU = String(usernameOrEmail).trim().toLowerCase();
    const cleanKey = String(recoveryKey).trim();
    const isMaster = cleanKey === '7575' || cleanKey.toLowerCase() === '75hard';

    const user = this.store.users.find(
      u =>
        u.username?.toLowerCase() === cleanU ||
        u.email?.toLowerCase() === cleanU ||
        u.name?.toLowerCase() === cleanU
    );

    if (!user) {
      return { success: false, message: 'Challenger account not found.' };
    }

    if (isMaster) {
      user.password = newPassword;
      this.save();
      return { success: true, message: `Password for ${user.name} has been reset successfully!` };
    }

    return { success: false, message: 'Invalid Recovery Key or Admin PIN.' };
  }

  findUserById(id) {
    return this.store.users.find(u => u.id === id);
  }

  addUser(userData) {
    const newId = `user_${Date.now()}`;
    const newUser = {
      id: newId,
      username: userData.username.trim().toLowerCase(),
      name: userData.name.trim(),
      pin: String(userData.pin || '1234').trim(),
      avatar: userData.avatar || '⚡',
      color: userData.color || 'from-rose-600 to-rose-700',
      role: 'challenger',
      depositAmount: Number(userData.depositAmount) || 2000,
      createdAt: new Date().toISOString(),
    };

    // check duplicate username
    if (this.store.users.some(u => u.username === newUser.username)) {
      throw new Error(`Username "${newUser.username}" is already taken.`);
    }

    this.store.users.push(newUser);
    if (!this.store.logs[newId]) {
      this.store.logs[newId] = {};
    }
    this.save();
    return newUser;
  }

  updateUser(id, patch) {
    const index = this.store.users.findIndex(u => u.id === id);
    if (index === -1) throw new Error('User not found');

    const existing = this.store.users[index];
    this.store.users[index] = { ...existing, ...patch, id: existing.id };
    this.save();
    return this.store.users[index];
  }

  deleteUser(id) {
    if (id === 'admin') throw new Error('Cannot delete admin account');
    const index = this.store.users.findIndex(u => u.id === id);
    if (index === -1) throw new Error('User not found');

    this.store.users.splice(index, 1);
    delete this.store.logs[id];
    this.save();
    return true;
  }

  // --- LOG METHODS ---
  getUserLogs(userId) {
    return this.store.logs[userId] || {};
  }

  saveUserLog(userId, log) {
    if (!this.store.logs[userId]) {
      this.store.logs[userId] = {};
    }
    this.store.logs[userId][log.date] = {
      ...log,
      userId,
      updatedAt: new Date().toISOString(),
    };
    this.save();

    // Async sync to Supabase if configured
    if (this.supabaseClient) {
      this.syncLogToSupabase(this.store.logs[userId][log.date]);
    }

    return this.store.logs[userId][log.date];
  }

  async syncLogToSupabase(log) {
    if (!this.supabaseClient) return;
    try {
      await this.supabaseClient.from('daily_logs').upsert({
        id: `${log.userId}_${log.date}`,
        user_id: log.userId,
        date: log.date,
        day_number: log.dayNumber,
        travel: log.travel,
        sickness: log.sickness,
        tasks: log.tasks,
        sport: log.sport,
        journal_notes: log.journalNotes,
        status: log.status,
        failed_tasks: log.failedTasks,
        is_locked: log.isLocked,
        completed_at: log.completedAt,
        updated_at: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('Supabase log sync warning:', e.message);
    }
  }

  // --- DB SETTINGS (Admin Only) ---
  getDbSettings() {
    return {
      supabaseUrl: this.store.dbSettings.supabaseUrl || '',
      hasKey: Boolean(this.store.dbSettings.supabaseAnonKey),
      isConnected: Boolean(this.supabaseClient),
    };
  }

  async updateDbSettings(settings) {
    this.store.dbSettings = {
      ...this.store.dbSettings,
      supabaseUrl: settings.supabaseUrl || '',
      supabaseAnonKey: settings.supabaseAnonKey || this.store.dbSettings.supabaseAnonKey,
    };
    this.save();
    this.initSupabase();

    if (this.supabaseClient) {
      try {
        const { error } = await this.supabaseClient.from('daily_logs').select('count', { count: 'exact', head: true });
        if (error && error.code !== 'PGRST116') {
          return { success: false, message: error.message };
        }
        return { success: true, message: 'Backend connected to Supabase PostgreSQL successfully!' };
      } catch (err) {
        return { success: false, message: err.message };
      }
    }
    return { success: true, message: 'DB settings saved locally.' };
  }
}

export const db = new DatabaseManager();

