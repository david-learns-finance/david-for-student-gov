# Supabase Setup Guide
## For: David's LPCSG Campaign — Student Voice Board

This guide takes ~10 minutes and requires no coding.

---

## Step 1 — Create a free Supabase account

1. Go to **https://supabase.com** and click **Start your project**
2. Sign up with GitHub (easiest) or email
3. Click **New project**
   - Name it something like `lpcsg-campaign`
   - Set a database password (save it somewhere safe — you won't need it for this, but keep it)
   - Choose region: **US West (North California)** — closest to Livermore
4. Wait ~2 minutes for the project to spin up

---

## Step 2 — Create the messages table

1. In your Supabase dashboard, click **Table Editor** in the left sidebar
2. Click **New table**
3. Fill in:
   - **Name:** `voice_messages`
   - **Enable Row Level Security (RLS):** ✅ YES (leave it checked)
4. Add the following columns (besides `id` and `created_at` which are auto-added):

| Column name | Type    | Default | Nullable |
|-------------|---------|---------|----------|
| `text`      | text    | —       | No       |
| `category`  | text    | other   | No       |

5. Click **Save**

---

## Step 3 — Set Row Level Security policies

This controls who can read and write. We want:
- **Anyone** can INSERT (submit a message)
- **Anyone** can SELECT (read messages)
- Nobody can UPDATE or DELETE

In the **Table Editor**, click on `voice_messages`, then click the **RLS** tab (or go to **Authentication → Policies**).

Create two policies:

### Policy 1: Allow anonymous reads
- Click **New Policy** → **Create a policy from scratch**
- Name: `Allow public read`
- Command: `SELECT`
- Using expression: `true`
- Click **Save**

### Policy 2: Allow anonymous inserts
- Click **New Policy** → **Create a policy from scratch**
- Name: `Allow public insert`
- Command: `INSERT`
- With check expression: `true`
- Click **Save**

---

## Step 4 — Get your API credentials

1. In the left sidebar, click **Project Settings** (gear icon) → **API**
2. Copy two values:
   - **Project URL** — looks like `https://abcdefghijkl.supabase.co`
   - **anon public** key — a long string starting with `eyJ...`

---

## Step 5 — Add credentials to the site

Open `assets/js/voice-wall.js` in a text editor and replace the two placeholder values near the top:

```js
const SUPABASE_URL     = 'https://YOUR_PROJECT_ID.supabase.co';   // ← replace
const SUPABASE_ANON_KEY = 'YOUR_ANON_PUBLIC_KEY';                 // ← replace
```

With your actual values, e.g.:

```js
const SUPABASE_URL     = 'https://abcdefghijkl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

Save the file.

---

## Step 6 — Enable Realtime on the table

So that new messages appear live without refreshing:

1. In Supabase, go to **Database → Replication**
2. Find `voice_messages` in the list
3. Toggle **INSERT** to ON

---

## Step 7 — Deploy to GitHub Pages

1. Push your entire `david-site/` folder contents to the **root** of a GitHub repository
2. Go to the repo → **Settings** → **Pages**
3. Set Source: `Deploy from a branch` → `main` → `/ (root)`
4. Click **Save** — your site will be live at `https://YOUR_USERNAME.github.io/YOUR_REPO/`

---

## Optional — Seed demo messages

To pre-populate the board before launch, go to Supabase **Table Editor → voice_messages** and click **Insert row** to add a few starter messages manually.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Board shows "Could not load messages" | Check `SUPABASE_URL` and `SUPABASE_ANON_KEY` are correct |
| Messages submit but don't appear | Make sure the SELECT policy is set to `true` |
| Inserts fail silently | Make sure the INSERT policy check expression is `true` |
| Real-time not working | Check Replication is enabled for INSERT on `voice_messages` |

---

## Security notes

- The `anon` key is safe to expose publicly — it's designed for browser use
- RLS policies ensure no one can delete or modify messages
- The profanity filter runs client-side before submission; it is not a server-side guarantee, but it covers common cases
- Your Supabase database password (from Step 1) should never go in any file

---

*Questions? Find David on campus.*
