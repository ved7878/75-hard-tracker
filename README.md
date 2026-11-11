# 75 HARD – Elite Habit & Mental Toughness Tracker (Vercel & Supabase Architecture)

A modern, mobile-first web application designed for the **75 HARD** challenge, specifically engineered for **3 simultaneous challengers** (Vedant, Vedansh, and Aryaman) and an **Admin / Referee**, deployed seamlessly to **Vercel** with a **Supabase PostgreSQL** cloud backend.

---

## 🏛️ System Design Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       CLIENT TIER                           │
│  React 18 + TypeScript + Vite + Tailwind CSS (Hosted on Vercel)│
│  - Mobile-First responsive viewport with PWA support        │
│  - Web Audio API tactile athletic haptic sound engine       │
│  - Client-side today-only edit enforcement                  │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTPS / REST / Realtime
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                      SUPABASE BAAS TIER                     │
│  PostgreSQL Database + Row-Level Security + Cloud Storage   │
├─────────────────────────────────────────────────────────────┤
│ • public.profiles          - Accounts (bcrypt-hashed creds) │
│ • public.app_sessions      - Hashed login session tokens    │
│ • public.challenge_config  - System rules & habit targets   │
│ • public.daily_logs        - 75-Day task records & journals │
│ • storage: progress-photos - High-res daily body photos     │
│ • storage: medical-proofs  - Medical prescriptions & slips  │
└─────────────────────────────────────────────────────────────┘
```

### Key Architectural Strengths:
1. **Serverless & Scalable**: Pure JAMstack SPA deployed to Vercel with zero background server processes to crash or manage.
2. **Hybrid Offline / Cloud Mode**: If Supabase credentials are not yet entered, the app gracefully runs in Local Cache mode and syncs to Supabase the moment credentials are provided.
3. **Strict Today-Only Enforcement**: Challengers can only check off today's habits. Zero retro-filling.
4. **Peer Penalty & Bounty Redistribution Engine**:
   - 1 challenger misses on a day: -₹200 deducted, +₹100 credited to each of the 2 survivors.
   - 2 challengers miss on a day: -₹200 deducted each (-₹400 total), +₹400 credited to the 1 survivor.
   - All 3 miss or all 3 succeed: ₹0 transferred (mutual neutral).
   - Squad pool is strictly conserved at ₹6,000 ($3 \times ₹2,000$) at all times.
   - Admin referee deposit is strictly ₹0 (excluded from pool and penalties).
5. **Referee "Time-Machine" Access**: The Admin has master permissions to override past and future days for any challenger.
6. **Dynamic Travel & Sickness Adaptation**:
   - Travel $\le$4 hours: Standard rules.
   - Travel >4 hours: Wake-up extended to 8:00 AM; gym unavailable substituted with 15k steps OR 5.0 km run.
   - Genuine illness: Upload prescription $\rightarrow$ held in Admin Exception Queue $\rightarrow$ Admin approval marks day exempt and preserves streak.
7. **Client-Side Image Optimization**: High-resolution mobile camera photos (5–15 MB) are automatically compressed to ~150 KB before saving or uploading, eliminating localStorage quota limits and saving bandwidth.

---

## 🔑 Accounts

| Account | Username | Avatar | Deposit Pledge |
|---|---|:---:|:---:|
| **Challenger 1** — Vedant | `vedant` | 🦁 | ₹2,000 |
| **Challenger 2** — Vedansh | `vedansh` | 🐺 | ₹2,000 |
| **Challenger 3** — Aryaman | `aryaman` | 🦅 | ₹2,000 |
| **Referee / Admin** | `admin` | ⚖️ | — |

Passwords and PINs are **not** listed here. The seed script creates starter credentials; the
referee must change all of them right after the first sign-in (see below).

---

## 🔐 Login Security & Password Management

- **Passwords and PINs never leave the database.** They are stored as bcrypt hashes and checked
  inside Postgres (`app_login`). The app receives a random session token (valid 60 days) that the
  database's Row Level Security checks on every request.
- **Brute-force protection:** 5 wrong attempts in 15 minutes (or 20 in a day) temporarily locks
  that username.
- **Who can change what:** challengers write only their own logs; only the referee can change the
  rules, add/remove challengers, and approve or reject sick days.
- **Forgot password:** ask the referee — **Admin → Squad → 🔑** sets a new password (and signs that
  person out on their other devices).
- **Change your own password:** **More → Change password** (minimum 6 characters).
- **Referee locked out?** Run the snippet at the top of `supabase/migration_004_secure_login.sql`
  in the Supabase SQL editor.

---

## 🚀 Supabase Database Setup (1-Click SQL)

1. Create a free project at [Supabase](https://supabase.com).
2. Go to **SQL Editor** in your Supabase dashboard.
3. **New project:** click **Copy SQL Schema** in the Admin Panel (it contains `supabase/schema.sql`
   followed by `supabase/migration_004_secure_login.sql`), paste it into the SQL editor and click **Run**.
4. **Existing project:** run the files in `supabase/` in order: `migration_001` → `002` → `003` → `004`.
   Re-running `schema.sql` re-opens access, so always run `migration_004_secure_login.sql` after it.
5. Sign in as the referee and **change every password and PIN** (Admin → Squad → 🔑, and More → Change password).
6. Copy your **Project URL** and **anon public API Key** from **Project Settings > API**.

---

## 🌐 Deploying to Vercel

1. Push this repository to **GitHub**.
2. Go to [Vercel](https://vercel.com) and click **"Add New Project"**.
3. Import your GitHub repository.
4. In **Project Settings > Environment Variables**, add:
   - `VITE_SUPABASE_URL` = `https://your-project.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `your-anon-public-key`
   - (Never put secrets in `VITE_*` variables — they are compiled into the public JavaScript.)
5. Click **Deploy**. Vercel will build and launch your production app!

---

## 💻 Local Development

```powershell
# Install dependencies
npm install

# Start Vite client
npm run dev:client

# Or run both client and local node backend
npm run dev
```

Visit **`http://localhost:3000`** in your browser.
