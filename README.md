# 75 HARD – Elite Habit & Mental Toughness Tracker (Squad & Admin Edition)

A mobile-first web application designed for the **75 HARD** challenge, supporting **3 simultaneous challengers**, an **Admin / Referee Panel** with exception approvals and past/future day override capabilities, strict **today-only checklist editing for challengers**, travel/sickness condition adaptations, daily progress photo captures, individual & squad deposit accountability (₹2,000 per person / ₹6,000 total pool), strict streak reset logic, and multi-user Supabase cloud sync.

---

## 🔑 Login, Profiles & Admin Portal

- **Profile & Login Switcher:** Tap the key icon 🔑 in the top right header at any time to switch active challengers or log in to the **Admin Portal**.
- **Challenger Access:** 1-tap fast switching between the 3 challengers (`Challenger 1`, `Challenger 2`, `Challenger 3`).
- **Referee / Admin Login:**
  - **Default Admin PIN:** `7575` (fully customizable in the Admin Panel).
  - Unlocks the **Admin Panel** tab on the navigation bar and enables **Master Override Mode**.

---

## ⚖️ Admin / Referee Panel Features

1. **Pending Medical Exception Approval Queue:**
   - When any challenger requests an exception due to illness, it is held in `⏳ Pending Admin Approval`.
   - The Admin can inspect the uploaded medical certificate / doctor prescription in high resolution.
   - **1-Click Approve:** Grants exemption, marks day as exempt, and safely preserves their 75-day streak!
   - **1-Click Reject:** Denies exemption with notes, keeping tasks mandatory.

2. **Time-Machine Editor (Make Changes in Past & Future Days):**
   - While standard challengers can only edit **TODAY'S** checklist, the Admin has master authority to select **any challenger** and **any date** (past, present, or future) to:
     - Toggle any of the 11 daily habits.
     - Retroactively fix mistakes or missed inputs.
     - Grant or revoke medical exemptions.
     - Plan future schedules or adjust travel details.

3. **Squad Deposit & Penalty Ledger:**
   - Tracks the total **₹6,000 squad pool** (₹2,000 &times; 3).
   - Monitors who forfeited their deposit due to unexcused missed days and allows the Admin to pardon or enforce penalties.

4. **Admin PIN Security:**
   - Update the master Admin PIN at any time.

---

## 👥 The 3 Challengers (Squad Mode)
- Built specifically for 3 friends doing the challenge together.
- **1-Tap Challenger Switcher:** Switch between challengers instantly from the top bar on any screen.
- **Independent Tracking:** Each challenger maintains their own daily checklist, progress photos, streaks, resets, and journal.
- **Squad Accountability Widget:** Live overview showing all 3 challengers' completion status for today (e.g. 11/11, 8/11, 4/11), current streaks, and the shared ₹6,000 deposit pool.
- **Customizable Profiles:** Rename challengers (e.g. your actual names) and pick custom avatar emojis in **Settings > The 3 Challengers**.

---

## 🔒 Strict "Today-Only" Editing Rule
- **Zero Backfilling:** You can **only make changes to TODAY'S checklist**.
- Historical days are sealed in read-only mode so you cannot retroactively complete missed days.
- Future days cannot be checked in advance.
- If you miss a task on an active day, that day becomes a failed day and **your streak resets to 0**!
- *(Configurable in Settings under "Lock Checklist to TODAY Only")*.

---

## 📅 Challenge Specifications
- **Start Date:** 11 November 2026
- **Duration:** 75 Consecutive Days
- **End Date:** 24 January 2027
- **Accountability Deposit:** ₹2,000
- **Strict Rule:** If ANY required habit is missed on an active non-exempt day, **your streak count resets to 0**, and your ₹2,000 deposit is forfeited.

---

## 📋 The 11 Daily Habits & Dynamic Rules

| # | Habit | Requirement & Dynamic Conditions |
|---|---|---|
| 1 | **Wake Up** | Target: **6:00 AM**. *Dynamic:* If Travel &gt; 4 hours, allowed up to **8:00 AM**. |
| 2 | **No Masturbation** | Absolute discipline & dopamine control. |
| 3 | **No Smoking / Alcohol** | Zero tolerance. |
| 4 | **Reading** | **5–10 pages** of non-fiction / personal growth + book title and key takeaway log. |
| 5 | **Gym Workout** | Dedicated daily workout. *Dynamic:* If travelling &gt; 4 hours and gym is unavailable, substitute with **15,000 steps OR 5 KM run**. |
| 6 | **Physical Activity** | **10,000 steps** OR **3 KM run/walk** OR **20 floors** stairs climbing. |
| 7 | **Clean Diet** | No added sugar, low oil, no junk food + daily meal log. |
| 8 | **Daily Progress Photo** | 1 full-body physique photo (camera / gallery upload with instant preview). |
| 9 | **Learn Something New** | Acquire 1 key concept, skill, or intellectual insight. |
| 10 | **Health (Physical & Mental)**| Daily water hydration tracking (liters) + mental clarity check-in. |
| 11 | **Family Connection** | At least **10 minutes** of meaningful conversation. |
| * | **Sport (Optional)** | Non-mandatory daily tracker to log skills and improvement in any sport. |

---

## ✈️ Travel & Sickness Engine

### Travel Conditions:
- **Travel &le; 4 Hours:** Standard 75 Hard rules apply (wake up by 6:00 AM, normal gym).
- **Travel &gt; 4 Hours:**
  - Wake-up target automatically extends to **8:00 AM**.
  - If gym is unavailable at destination, dynamic substitute activates: **15,000 steps OR 5 KM run**.

### Sickness Conditions:
- **At home excuses:** Zero exceptions (fatigue, laziness, or minor aches do not count).
- **Genuine sickness:** Exception allowed **ONLY with valid doctor prescription / medical proof document**.
- Health and safety always take priority. Verified medical exemptions safely preserve your 75-day streak without resetting to 0!

---

## 📱 Mobile-First Features & Navigation

1. **Dashboard (Today):**
   - Circular progress ring showing Day X/75 and today's execution percentage.
   - Streak flame with current consecutive days and record streak.
   - ₹2,000 Deposit tracker badge (Protected vs Forfeited).
   - Quick one-tap checklist for the 11 habits.
   - 9:00 PM Accountability reminder toggle.

2. **Daily Tracker (Checklist):**
   - Detailed interactive cards for each habit with steppers, time pickers, and notes.
   - Camera & file photo capture with high-res preview.
   - Dynamic indicators when travel or sickness rules apply.
   - Daily reflections journal.
   - Confetti celebration upon completing all 11 habits.

3. **75-Day Matrix Calendar:**
   - Full 75-day grid (Nov 11, 2026 – Jan 24, 2027).
   - Color-coded: Completed (Emerald Green), Missed / Reset (Crimson Red), Medical Exempt (Blue), Today (Glowing White/Rose), Pending (Muted).
   - Click any day to view its complete audit modal.

4. **Travel & Exceptions Screen:**
   - Travel duration slider (0–18 hrs) and gym availability toggle.
   - Doctor prescription / hospital proof uploader for genuine medical exemptions.

5. **Analytics & Milestones:**
   - Cumulative volume: Total pages read, gym workouts logged, steps walked, and photos taken.
   - Habit-by-habit consistency percentages.
   - 7 Unlockable Milestones: Day 1 (First Blood), Day 7 (Iron Week), Day 14, Day 21, Day 30, Day 50, and Day 75 (Champion).

6. **Settings & Configurability:**
   - **Fully configurable rules:** Change start/end dates, deposit amount, wake up targets, reading targets, step targets, or travel substitute values without modifying code.
   - **Daily 9:00 PM Alert:** Built-in Browser Web Notification API integration.
   - **Supabase Cloud Sync:** Setup instructions, 1-click SQL schema generator, test connection, manual push/pull, and auto-sync on change.
   - **Data Portability:** Export / Import JSON backups and full challenge reset.

---

## 🚀 Running the App

### Start Development Server:
\`\`\`bash
npm run dev
\`\`\`
Visit \`http://localhost:3000\` on your desktop or mobile browser.

### Production Build & Preview:
\`\`\`bash
npm run build
npm run preview
\`\`\`

---

## 🗄️ Supabase PostgreSQL Setup (Optional Cloud Sync)

The app works **100% offline-first out of the box** using LocalStorage and browser media storage. To enable cloud synchronization across multiple devices:

1. Create a free project at [supabase.com](https://supabase.com).
2. In the app, go to **Settings &gt; SQL Schema** and click **Copy SQL**.
3. In your Supabase Dashboard, open **SQL Editor &gt; New Query**, paste the script, and click **Run**.
4. In **Project Settings &gt; API**, copy your **Project URL** and **anon public key**.
5. Paste them into the app's **Settings &gt; Supabase Cloud Sync** and click **Test Link** followed by **Push to Cloud**.

