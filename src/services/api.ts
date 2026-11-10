import { ChallengeConfig, DailyLog, UserProfile, SquadMemberStatus, PendingExceptionItem } from '../types';

const BASE_URL = '/api';

class ApiService {
  private currentUserId: string | null = null;
  private currentUserRole: 'challenger' | 'admin' | null = null;

  constructor() {
    this.currentUserId = localStorage.getItem('75hard_session_user_id');
    this.currentUserRole = (localStorage.getItem('75hard_session_role') as any) || null;
  }

  setSession(user: UserProfile | null) {
    if (user) {
      this.currentUserId = user.id;
      this.currentUserRole = user.role;
      localStorage.setItem('75hard_session_user_id', user.id);
      localStorage.setItem('75hard_session_role', user.role);
    } else {
      this.currentUserId = null;
      this.currentUserRole = null;
      localStorage.removeItem('75hard_session_user_id');
      localStorage.removeItem('75hard_session_role');
    }
  }

  getSession() {
    return {
      userId: this.currentUserId,
      role: this.currentUserRole,
    };
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.currentUserId) {
      headers['x-user-id'] = this.currentUserId;
    }
    if (this.currentUserRole) {
      headers['x-user-role'] = this.currentUserRole;
    }
    return headers;
  }

  // --- AUTH ---
  async loginChallenger(username: string, pin: string): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, pin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');

      this.setSession(data.user);
      return { success: true, user: data.user };
    } catch (err: any) {
      return { success: false, error: err.message || 'Login error' };
    }
  }

  async loginAdmin(pin: string): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/auth/admin-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Invalid Admin PIN');

      this.setSession(data.user);
      return { success: true, user: data.user };
    } catch (err: any) {
      return { success: false, error: err.message || 'Admin login error' };
    }
  }

  logout() {
    this.setSession(null);
  }

  // --- CONFIG ---
  async getConfig(): Promise<ChallengeConfig> {
    try {
      const res = await fetch(`${BASE_URL}/config`, { headers: this.getHeaders() });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('API getConfig failed', e);
    }
    return {} as ChallengeConfig;
  }

  // --- LOGS ---
  async getLogs(userId?: string): Promise<Record<string, DailyLog>> {
    try {
      const url = userId ? `${BASE_URL}/logs?userId=${userId}` : `${BASE_URL}/logs`;
      const res = await fetch(url, { headers: this.getHeaders() });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('API getLogs failed', e);
    }
    return {};
  }

  async saveLog(log: DailyLog): Promise<{ success: boolean; log?: DailyLog; error?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/logs`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ log }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save log');
      return { success: true, log: data.log };
    } catch (err: any) {
      return { success: false, error: err.message || 'Save error' };
    }
  }

  // --- SQUAD ---
  async getSquad(): Promise<SquadMemberStatus[]> {
    try {
      const res = await fetch(`${BASE_URL}/squad`, { headers: this.getHeaders() });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('API getSquad failed', e);
    }
    return [];
  }

  // --- ADMIN EXCLUSIVES ---
  async adminGetUsers(): Promise<UserProfile[]> {
    const res = await fetch(`${BASE_URL}/admin/users`, { headers: this.getHeaders() });
    if (!res.ok) throw new Error('Failed to load users');
    return await res.json();
  }

  async adminAddUser(userData: {
    name: string;
    username: string;
    pin: string;
    avatar: string;
    depositAmount: number;
  }): Promise<UserProfile> {
    const res = await fetch(`${BASE_URL}/admin/users`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(userData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to add user');
    return data.user;
  }

  async adminUpdateUser(id: string, patch: Partial<UserProfile>): Promise<UserProfile> {
    const res = await fetch(`${BASE_URL}/admin/users/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update user');
    return data.user;
  }

  async adminDeleteUser(id: string): Promise<boolean> {
    const res = await fetch(`${BASE_URL}/admin/users/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete user');
    return true;
  }

  async adminGetConfig(): Promise<ChallengeConfig> {
    const res = await fetch(`${BASE_URL}/admin/config`, { headers: this.getHeaders() });
    if (!res.ok) throw new Error('Failed to load admin config');
    return await res.json();
  }

  async adminUpdateConfig(patch: Partial<ChallengeConfig>): Promise<ChallengeConfig> {
    const res = await fetch(`${BASE_URL}/admin/config`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update system config');
    return data.config;
  }

  async adminOverrideLog(userId: string, date: string, log: DailyLog): Promise<DailyLog> {
    const res = await fetch(`${BASE_URL}/admin/logs/override`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ userId, date, log }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to override log');
    return data.log;
  }

  async adminGetExceptions(): Promise<PendingExceptionItem[]> {
    const res = await fetch(`${BASE_URL}/admin/exceptions`, { headers: this.getHeaders() });
    if (!res.ok) return [];
    return await res.json();
  }

  async adminReviewException(userId: string, date: string, decision: 'approve' | 'reject', comment?: string): Promise<boolean> {
    const res = await fetch(`${BASE_URL}/admin/exceptions/review`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ userId, date, decision, comment }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to review exception');
    return true;
  }

  async adminGetDbSettings(): Promise<{ supabaseUrl: string; hasKey: boolean; isConnected: boolean }> {
    const res = await fetch(`${BASE_URL}/admin/db-settings`, { headers: this.getHeaders() });
    if (!res.ok) return { supabaseUrl: '', hasKey: false, isConnected: false };
    return await res.json();
  }

  async adminUpdateDbSettings(settings: { supabaseUrl: string; supabaseAnonKey?: string }): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${BASE_URL}/admin/db-settings`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(settings),
    });
    return await res.json();
  }
}

export const api = new ApiService();
