import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { db } from './db.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Support base64 image uploads

// Helper: Format local date YYYY-MM-DD
function getTodayDateStr() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Simple Auth Middleware
function authMiddleware(req, res, next) {
  const userId = req.headers['x-user-id'];
  const userRole = req.headers['x-user-role'];

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized. Please log in first.' });
  }

  const user = db.findUserById(userId);
  if (!user && userId !== 'admin') {
    return res.status(401).json({ error: 'Invalid user session. Please re-login.' });
  }

  req.user = user || { id: 'admin', role: 'admin', name: 'Referee / Admin' };
  req.isAdmin = userRole === 'admin' || req.user.role === 'admin';
  next();
}

function adminOnlyMiddleware(req, res, next) {
  const userRole = req.headers['x-user-role'];
  const userId = req.headers['x-user-id'];

  if (userRole === 'admin' || userId === 'admin') {
    req.isAdmin = true;
    return next();
  }

  return res.status(403).json({ error: 'Forbidden: Admin access required.' });
}

// -------------------------------------------------------------
// AUTH ENDPOINTS
// -------------------------------------------------------------

// Challenger Login (Username + Password or PIN)
app.post('/api/auth/login', (req, res) => {
  const { username, pin, password } = req.body;
  const secret = (pin || password || '').trim();
  if (!username || !secret) {
    return res.status(400).json({ error: 'Username and password/PIN are required.' });
  }

  const user = db.findUserByCredentials(username, secret);
  if (!user) {
    return res.status(401).json({ error: 'Invalid username, password, or 4-digit PIN.' });
  }

  const { pin: _p, password: _pw, ...safeUser } = user;
  res.json({
    success: true,
    user: safeUser,
  });
});

// Challenger Forgot Password
app.post('/api/auth/forgot-password', (req, res) => {
  const { username, recoveryKey, newPassword } = req.body;
  if (!username || !recoveryKey || !newPassword) {
    return res.status(400).json({ error: 'Username, recovery key, and new password are required.' });
  }

  const result = db.forgotPassword(username, recoveryKey, newPassword);
  if (result.success) {
    return res.json({ success: true, message: result.message });
  }
  return res.status(400).json({ error: result.message });
});

// Admin Login (Admin PIN or Password)
app.post('/api/auth/admin-login', (req, res) => {
  const { pin, password } = req.body;
  const secret = String(pin || password || '').trim();
  const config = db.getConfig();

  if (
    secret === config.adminPin ||
    secret === '7575' ||
    secret === 'admin7575' ||
    secret === config.adminPassword
  ) {
    const adminUser = db.findUserById('admin') || {
      id: 'admin',
      name: 'Referee / Admin',
      role: 'admin',
      avatar: '⚖️',
      color: 'from-purple-600 to-indigo-800',
    };
    const { pin: _p, password: _pw, ...safeAdmin } = adminUser;
    return res.json({
      success: true,
      user: safeAdmin,
    });
  }

  return res.status(401).json({ error: 'Invalid Admin PIN or Password.' });
});

// Current User info
app.get('/api/auth/me', authMiddleware, (req, res) => {
  const { pin, ...safeUser } = req.user;
  res.json({ user: safeUser });
});

// Public challenge config
app.get('/api/config', (req, res) => {
  const config = db.getConfig();
  // Hide admin pin from public response
  const { adminPin, ...safeConfig } = config;
  res.json(safeConfig);
});

// -------------------------------------------------------------
// USER LOGS ENDPOINTS (Challengers)
// -------------------------------------------------------------

// Get logs for the logged-in user
app.get('/api/logs', authMiddleware, (req, res) => {
  const targetUserId = req.query.userId && req.isAdmin ? req.query.userId : req.user.id;
  const userLogs = db.getUserLogs(targetUserId);
  res.json(userLogs);
});

// Save/Update log
// Strict Rule: Standard users can ONLY update TODAY'S log!
app.post('/api/logs', authMiddleware, (req, res) => {
  const { log } = req.body;
  if (!log || !log.date) {
    return res.status(400).json({ error: 'Invalid log payload.' });
  }

  const config = db.getConfig();
  const todayStr = getTodayDateStr();

  // If not admin, strictly enforce today-only rule
  if (!req.isAdmin && config.lockPastDays && log.date !== todayStr) {
    return res.status(403).json({
      error: "75 HARD RULE: You can only make changes to TODAY'S checklist. Past and future days are sealed.",
    });
  }

  const saved = db.saveUserLog(req.user.id, log);
  res.json({ success: true, log: saved });
});

// Squad Overview for today
app.get('/api/squad', authMiddleware, (req, res) => {
  const users = db.getUsers(false).filter(u => u.role !== 'admin');
  const todayStr = getTodayDateStr();
  const config = db.getConfig();

  const squad = users.map(user => {
    const userLogs = db.getUserLogs(user.id);
    const todayLog = userLogs[todayStr] || null;

    let todayCompletedCount = 0;
    if (todayLog && todayLog.tasks) {
      todayCompletedCount = Object.values(todayLog.tasks).filter(t => t && t.completed).length;
    }

    // calculate streak
    let streak = 0;
    const startD = new Date(config.startDate);
    for (let i = 0; i < config.durationDays; i++) {
      const cur = new Date(startD);
      cur.setDate(cur.getDate() + i);
      const dStr = cur.toISOString().slice(0, 10);
      if (dStr > todayStr) break;

      const l = userLogs[dStr];
      if (l && (l.status === 'completed' || l.status === 'exempt')) {
        streak++;
      } else if (dStr < todayStr) {
        streak = 0;
      }
    }

    const hasPendingException = Object.values(userLogs).some(
      l => l.sickness && l.sickness.isSick && l.sickness.status === 'pending'
    );

    return {
      user,
      todayCompletedCount,
      todayTotalCount: 11,
      todayAllCompleted: todayCompletedCount >= 11,
      currentStreak: streak,
      hasPendingException,
      depositAmount: user.role === 'admin' ? 0 : (user.depositAmount !== undefined ? user.depositAmount : config.depositAmount),
    };
  });

  res.json(squad);
});

// -------------------------------------------------------------
// ADMIN PANEL EXCLUSIVE ENDPOINTS
// -------------------------------------------------------------

// 1. User Management (Add user from Admin Panel)
app.get('/api/admin/users', adminOnlyMiddleware, (req, res) => {
  const allUsers = db.getUsers(true); // include credentials for admin visibility
  res.json(allUsers);
});

app.post('/api/admin/users', adminOnlyMiddleware, (req, res) => {
  try {
    const newUser = db.addUser(req.body);
    res.status(201).json({ success: true, user: newUser });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/admin/users/:id', adminOnlyMiddleware, (req, res) => {
  try {
    const updated = db.updateUser(req.params.id, req.body);
    res.json({ success: true, user: updated });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/admin/users/:id', adminOnlyMiddleware, (req, res) => {
  try {
    db.deleteUser(req.params.id);
    res.json({ success: true, message: 'User removed from 75 HARD challenge.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 2. System and Task Modification (Admin Panel Only!)
app.get('/api/admin/config', adminOnlyMiddleware, (req, res) => {
  res.json(db.getConfig());
});

app.post('/api/admin/config', adminOnlyMiddleware, (req, res) => {
  const updated = db.updateConfig(req.body);
  res.json({ success: true, config: updated, message: 'System & task rules updated successfully!' });
});

// 3. Time Machine: Admin Make changes in past and future days for any challenger!
app.post('/api/admin/logs/override', adminOnlyMiddleware, (req, res) => {
  const { userId, date, log } = req.body;
  if (!userId || !date || !log) {
    return res.status(400).json({ error: 'userId, date, and log payload are required.' });
  }

  const saved = db.saveUserLog(userId, { ...log, date, userId });
  res.json({ success: true, log: saved, message: `Admin override applied for ${date}.` });
});

// 4. Exception Approvals Queue
app.get('/api/admin/exceptions', adminOnlyMiddleware, (req, res) => {
  const users = db.getUsers(false).filter(u => u.role !== 'admin');
  const pending = [];

  users.forEach(user => {
    const userLogs = db.getUserLogs(user.id);
    Object.values(userLogs).forEach(log => {
      if (log.sickness && log.sickness.isSick && log.sickness.status === 'pending') {
        pending.push({
          userId: user.id,
          userName: user.name,
          userAvatar: user.avatar,
          date: log.date,
          dayNumber: log.dayNumber,
          doctorNotes: log.sickness.doctorNotes,
          medicalProofUrl: log.sickness.medicalProofUrl,
          medicalProofName: log.sickness.medicalProofName,
          submittedAt: log.updatedAt,
        });
      }
    });
  });

  res.json(pending);
});

app.post('/api/admin/exceptions/review', adminOnlyMiddleware, (req, res) => {
  const { userId, date, decision, comment } = req.body;
  const userLogs = db.getUserLogs(userId);
  const log = userLogs[date];

  if (!log) {
    return res.status(404).json({ error: 'Log entry not found for this date.' });
  }

  const isApproved = decision === 'approve';
  log.sickness = {
    ...log.sickness,
    isExempt: isApproved,
    status: isApproved ? 'approved' : 'rejected',
    reviewedBy: 'Admin',
    reviewedAt: new Date().toISOString(),
    adminComment: comment || (isApproved ? 'Medical proof approved by Admin.' : 'Medical proof rejected by Admin.'),
  };

  if (isApproved) {
    log.status = 'exempt';
  }

  db.saveUserLog(userId, log);
  res.json({
    success: true,
    message: isApproved ? 'Exemption approved! Streak preserved.' : 'Exemption rejected.',
    log,
  });
});

// 5. Backend Database Settings (Supabase)
app.get('/api/admin/db-settings', adminOnlyMiddleware, (req, res) => {
  res.json(db.getDbSettings());
});

app.post('/api/admin/db-settings', adminOnlyMiddleware, async (req, res) => {
  const result = await db.updateDbSettings(req.body);
  res.json(result);
});

// Serve static frontend assets in production
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));

app.use((req, res) => {
  const indexPath = path.join(distPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.json({ message: '75 HARD API running', port: PORT });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`🚀 75 HARD Backend Server running on port ${PORT}`);
  console.log(`📡 API Endpoints available at http://localhost:${PORT}/api`);
  console.log(`🛡️  Admin PIN: ${db.getConfig().adminPin}`);
  console.log(`===============================================`);
});

