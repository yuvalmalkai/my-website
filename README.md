# Quit Buddy

A daily dice-roll smoking-reduction game for a small group of friends, built with
React + Vite + Supabase.

## How it works

- A "smoking day" runs **7am to 7am** (Israel time), not midnight to midnight.
- Each night, after **7pm**, the group rolls dice for tomorrow:
  1. Someone picks how many dice to use tonight (1-5, shared by everyone).
  2. Each person taps "I'm ready to roll" before the roll happens.
  3. Once it's past 7pm, anyone can hit "Roll the dice" - everyone who was ready
     gets their own set of dice rolled (server-side, so nobody can fake it), and
     everyone watching sees the dice actually spin and land, one person at a time.
  4. Each person's dice total becomes **their own** cigarette allowance for the
     next smoking-day.
- During the day, people log cigarettes one at a time (with a little animated
  "shame" popup), and can undo the last one.
- Anyone can also set their own allowance by hand, for a given day.
- A "redo roll" button lets the group reroll a night - blocked automatically once
  anyone has already logged a cigarette against the result.
- A streak (👑) counts consecutive successful days, and a history tab shows the
  day-by-day record for anyone in the group.
- Push notifications alert everyone the moment someone crosses half their limit
  for the day - works even if their browser/app is fully closed.
- A reminder push at 8pm nudges everyone to roll, and a midnight push
  congratulates everyone still under their limit for the night.
- The group roll is a slow, dramatic round-robin - one die per person per
  round, scoreboard filling in live, with extra commentary if someone rolls a 1.

## One-time setup (do this once, on your computer)

1. **Install dependencies**

   Open a terminal in this folder and run:

   ```
   npm install
   ```

2. **Connect it to your Supabase project**

   - Copy `.env.example` to a new file called `.env.local` (same folder)
   - Open `.env.local` and fill in:

     ```
     VITE_SUPABASE_URL=...
     VITE_SUPABASE_ANON_KEY=...
     VITE_VAPID_PUBLIC_KEY=...
     ```

     The first two come from Supabase: Settings → API.
     The VAPID one is the public push-notification key - see step 5 below.

   - `.env.local` is already in `.gitignore` - it will never get pushed to GitHub.

3. **Make sure the database is set up**

   In the Supabase dashboard → SQL Editor, run these in order (if you haven't already):
   - `supabase/schema.sql` (tables, security rules, roll/cigarette functions)
   - the history & streaks script (the `day_results` view and `get_current_streak` function)
   - `supabase/push_and_manual.sql` (manual allowance override + push subscriptions table)

4. **Run it locally to check it works**

   ```
   npm run dev
   ```

   Open the link it prints (usually `http://localhost:5173`) and try signing up.

5. **Set up push notifications (the "alerts" feature)**

   These VAPID keys were generated for this project - use them directly, no need
   to generate your own:

   ```
   VAPID public key:  BKzkCMdYhDoDRYPEgH3quWSAtOMQkYeDHBxPQxVIIK1uasl6iE_8dArI_c625jsktfTVe5PWPIoe75JsJW_-9AQ
   VAPID private key: T4-2fG5HyfgHbjauq8geuFw1-U_piZ_KLVCsbSGYbFQ
   ```

   - Put the **public** key into `VITE_VAPID_PUBLIC_KEY` in `.env.local` (and later, in Vercel's
     environment variables).
   - In the Supabase dashboard: **Edge Functions** → **Deploy a new function** → **Via Editor**.
     Name it `notify-half-limit`, paste in the contents of
     `supabase/functions/notify-half-limit/index.ts`, and click Deploy.
   - Still in Edge Functions, find **Secrets** and add:
     - `VAPID_PUBLIC_KEY` = the public key above
     - `VAPID_PRIVATE_KEY` = the private key above
     - `VAPID_SUBJECT` = `mailto:youremail@example.com` (any email of yours)
   - Go to **Database** → **Webhooks** → **Create a new hook**:
     - Table: `cigarette_logs`, Event: **Insert**
     - Type: **Supabase Edge Functions**
     - Function: `notify-half-limit`
     - HTTP Headers: click "Add auth header with service key"
     - Create the webhook.
   - In the app, each person taps the **"🔔 Enable alerts"** button once (this asks
     for notification permission and registers their device).

   **iPhone note:** push notifications on iOS only work if the site has been added
   to the Home Screen first (Safari → Share → Add to Home Screen) - open it from
   that home screen icon, *then* tap "Enable alerts."

## Putting it online (Vercel)

1. Push this project to the GitHub repo you created:

   ```
   git init
   git add .
   git commit -m "Quit Buddy"
   git branch -M main
   git remote add origin <your-repo-url>
   git push -u origin main
   ```

2. In Vercel: **New Project → Import** your GitHub repo.
3. Before deploying, open **Environment Variables** and add all three values
   from your `.env.local`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_VAPID_PUBLIC_KEY`
4. Click **Deploy**. You'll get a live URL like `quit-buddy.vercel.app` -
   that's the link to send your friends.
5. From now on: every `git push` to `main` auto-redeploys the live site.

## Project structure

```
src/
  supabaseClient.js       - connects to your Supabase project
  lib/time.js               - the 7am/7pm Israel-time logic (UI-side mirror of the DB logic)
  hooks/
    useAppData.js            - loads everything + keeps it live-updating
    usePushNotifications.js    - registers the service worker + subscribes to push
  components/
    Auth.jsx                   - sign up / sign in
    Dashboard.jsx                - tab layout (Today / Friends / History) + alerts button
    TonightRoll.jsx                - dice count, ready-up, roll, redo
    TodayCard.jsx                   - allowance, cigarette counter, undo, exceeded flag, manual override
    ManualAllowance.jsx              - the "set by hand" control
    SmokedAnimation.jsx               - the popup shown after logging a cigarette
    RollRevealOverlay.jsx              - the live, animated group dice reveal
    FriendsList.jsx                     - everyone's status, online dot, streak
    HistoryView.jsx                      - per-person day-by-day history
public/
  sw.js                     - service worker that displays push notifications
  manifest.json              - PWA manifest (needed for "Add to Home Screen" + iOS push)
supabase/
  schema.sql                  - core database setup
  push_and_manual.sql           - manual allowance + push subscriptions table
  functions/notify-half-limit/   - the Edge Function that sends the actual push
```
