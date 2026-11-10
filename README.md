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
│ • public.profiles          - User accounts, PINs & passwords│
│ • public.challenge_config  - System rules & habit targets   │
│ • public.daily_logs        - 75-Day task records & journals │
│ • public.password_resets   - Recovery tokens                │
│ • storage: progress-photos - High-res daily body photos     │
│ • storage: medical-proofs  - Medical prescriptions & slips  │
└─────────────────────────────────────────────────────────────┘
```

### Key Architectural Strengths:
1. **Serverless & Scalable**: Pure JAMstack SPA deployed to Vercel with zero background server processes to crash or manage.
2. **Hybrid Offline / Cloud Mode**: If Supabase credentials are not yet entered, the app gracefully runs in Local Cache mode and syncs to Supabase the moment credentials are provided.
3. **Strict Today-Only Enforcement**: Challengers can only check off today's habits. Zero retro-filling.
4. **Referee "Time-Machine" Access**: The Admin has master permissions to override past and future days for any challenger.
5. **Dynamic Travel & Sickness Adaptation**:
   - Travel $\le$4 hours: Standard rules.
   - Travel >4 hours: Wake-up extended to 8:00 AM; gym unavailable substituted with 15k steps OR 5.0 km run.
   - Genuine illness: Upload prescription $\rightarrow$ held in Admin Exception Queue $\rightarrow$ Admin approval marks day exempt and preserves streak.

---

## 🔑 Challenger & Admin Credentials

| Account | Display Name | Username | Password | 4-Digit PIN | Avatar | Deposit Pledge |
|---|---|---|---|:---:|:---:|:---:|
| **Challenger 1** | **Vedant** | `vedant` | `vedant123` | `1111` | 🦁 | ₹2,000 |
| **Challenger 2** | **Vedansh** | `vedansh` | `vedansh123` | `2222` | 🐺 | ₹2,000 |
| **Challenger 3** | **Aryaman** | `aryaman` | `aryaman123` | `3333` | 🦅 | ₹2,000 |
| **Referee / Admin** | **Admin Portal** | `admin` | `admin7575` | `7575` | ⚖️ | — |

---

## 🔐 Password Management & Forgot Password Flow

1. **Self-Service Password Reset**:
   - On the login screen, click **"Forgot Password?"**.
   - Enter your Username (e.g. `vedant`) and the Squad Recovery Key or Admin PIN (`7575`).
   - Enter and confirm your new password.
2. **Admin One-Click Password Reset**:
   - The Admin can open **Admin Panel > Challenger Accounts**, tap the key icon 🔑 next to any challenger, and assign a new password immediately.
3. **In-App Password Update**:
   - Any logged-in user can change their password directly in **Settings > Account Security > Change Password**.

---

## 🚀 Supabase Database Setup (1-Click SQL)

1. Create a free project at [Supabase](https://supabase.com).
2. Go to **SQL Editor** in your Supabase dashboard.
3. Open `supabase/schema.sql` (or click **Copy SQL Schema** in the Admin Panel) and paste it into the SQL editor.
4. Click **Run**.
5. Copy your **Project URL** and **anon public API Key** from **Project Settings > API**.

---

## 🌐 Deploying to Vercel

1. Push this repository to **GitHub**.
2. Go to [Vercel](https://vercel.com) and click **"Add New Project"**.
3. Import your GitHub repository.
4. In **Project Settings > Environment Variables**, add:
   - `VITE_SUPABASE_URL` = `https://your-project.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `your-anon-public-key`
   - `VITE_ADMIN_PIN` = `7575` (optional)
   - `VITE_RECOVERY_KEY` = `HARD75_RECOVERY_SQUAD` (optional)
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
