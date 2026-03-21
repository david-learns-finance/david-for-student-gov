# Supabase Setup — New Campaign Site
## Tables needed for prediction market + leaderboard + voice wall

---

## New tables to create

### Table 1: `market_users`
Go to Table Editor → New Table → name it `market_users`, enable RLS.

| Column | Type | Default | Notes |
|---|---|---|---|
| id | uuid | gen_random_uuid() | auto |
| created_at | timestamptz | now() | auto |
| email | text | — | unique |
| display_name | text | null | optional |
| tokens | int4 | 100 | starting balance |
| bet_side | text | null | 'yes' or 'no' |
| bet_tokens | int4 | null | amount wagered |

Add a unique constraint on `email`.

**RLS Policies:**
- SELECT: `true` (public read for leaderboard)
- INSERT: `true` (anyone can register)
- UPDATE: `true` (to place bets and deduct tokens)

---

### Table 2: `predictions`
Go to Table Editor → New Table → name it `predictions`, enable RLS.

| Column | Type | Default | Notes |
|---|---|---|---|
| id | uuid | gen_random_uuid() | auto |
| created_at | timestamptz | now() | auto |
| side | text | — | 'yes' or 'no' |
| tokens | int4 | — | amount bet |
| email | text | — | reference to market_users |

**RLS Policies:**
- SELECT: `true` (public read for live odds)
- INSERT: `true` (anyone can place a bet)

---

### Table 3: `voice_messages` (already exists from previous setup)
No changes needed — same table as before.

---

## Enable Realtime on all tables

Go to Database → Replication and toggle INSERT (and UPDATE for market_users) on:
- `predictions`
- `market_users`
- `voice_messages`

---

## Supabase Edge Function — Winner Emails

This sends congratulation emails to winners after the election.

### Step 1: Install Supabase CLI
```
npm install -g supabase
supabase login
```

### Step 2: Create the edge function
```
supabase functions new send-winner-email
```

### Step 3: Paste this code into `supabase/functions/send-winner-email/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  // Only allow POST with a secret header to prevent abuse
  const authHeader = req.headers.get('x-admin-secret')
  if (authHeader !== Deno.env.get('ADMIN_SECRET')) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { winning_side } = await req.json() // 'yes' or 'no'
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // Fetch all winners
  const { data: winners } = await sb
    .from('market_users')
    .select('email, display_name, tokens, bet_side, bet_tokens')
    .eq('bet_side', winning_side)

  if (!winners || winners.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), { status: 200 })
  }

  // Give winners a 50-token bonus
  for (const winner of winners) {
    await sb.from('market_users')
      .update({ tokens: winner.tokens + 50 })
      .eq('email', winner.email)

  // Fetch leaderboard (top 10 by tokens, opted-in only)
  const { data: leaderboard } = await sb
    .from('market_users')
    .select('display_name, tokens, bet_side')
    .not('display_name', 'is', null)
    .order('tokens', { ascending: false })
    .limit(10)

  const leaderboardHtml = leaderboard && leaderboard.length > 0
    ? `<h3>🏆 Final Leaderboard</h3>
       <table style="width:100%;border-collapse:collapse;font-size:14px;">
         <tr style="color:#888;"><th style="text-align:left;padding:4px 8px;">#</th><th style="text-align:left;padding:4px 8px;">Name</th><th style="text-align:left;padding:4px 8px;">Bet</th><th style="text-align:right;padding:4px 8px;">Tokens</th></tr>
         ${leaderboard.map((r, i) => `
           <tr style="border-top:1px solid #222;">
             <td style="padding:6px 8px;color:#888;">${['🥇','🥈','🥉'][i] || (i+1)}</td>
             <td style="padding:6px 8px;font-weight:bold;">${r.display_name}</td>
             <td style="padding:6px 8px;color:${r.bet_side === winning_side ? '#2ecc71' : '#ff6666'}">${r.bet_side?.toUpperCase() || '—'}</td>
             <td style="padding:6px 8px;text-align:right;color:#d4a017;">🪙 ${r.tokens}</td>
           </tr>`).join('')}
       </table>`
    : ''

    // Send email via Resend
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'David Tay Campaign <noreply@yourdomain.com>',
        to: winner.email,
        subject: '🎉 You called it! Prediction Market Results',
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0a0a0a;color:#fff;padding:24px;border-radius:12px;">
            <h2 style="color:#d4a017;">🎉 You called it!</h2>
            <p>Hi ${winner.display_name || 'there'},</p>
            <p>The LPCSG election results are in — and your prediction was correct.</p>
            <p>You've been awarded <strong style="color:#d4a017;">50 bonus tokens</strong>. Your new balance: <strong style="color:#f0c040;">${winner.tokens + 50} tokens 🪙</strong>.</p>
            ${leaderboardHtml}
            <p style="margin-top:24px;color:#888;font-size:12px;">David Tay for LPCSG Director of Finances — Spring 2026</p>
          </div>
        `
      })
    })
  }

  return new Response(JSON.stringify({ sent: winners.length }), { status: 200 })
})
```

### Step 4: Set environment variables in Supabase dashboard
Go to Project Settings → Edge Functions → Add these secrets:
- `RESEND_API_KEY` — get a free key at resend.com
- `ADMIN_SECRET` — any long random string you choose (keep it private)

### Step 5: Deploy the function
```
supabase functions deploy send-winner-email
```

### Step 6: After the election, trigger it
```
curl -X POST https://YOUR_PROJECT_ID.supabase.co/functions/v1/send-winner-email \
  -H "x-admin-secret: YOUR_ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"winning_side": "yes"}'
```
Replace `"yes"` with `"no"` if David loses (lol).

---

## Add credentials to app.js

Open `assets/js/app.js` and fill in:
```js
const SUPABASE_URL     = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_PUBLIC_KEY';
```
