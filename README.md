# 75 HARD – Elite Habit & Mental Toughness Tracker

A mobile-first web application designed for the **75 HARD** challenge, featuring configurable rules, travel/sickness condition adaptations, daily progress photo captures, deposit accountability (₹2,000), strict streak reset logic, and Supabase cloud sync.

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
