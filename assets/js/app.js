/**
 * app.js — David Tay for LPCSG Campaign Site
 */

const SUPABASE_URL      = 'https://zmcmttvfigrbfmopehsy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptY210dHZmaWdyYmZtb3BlaHN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NTU1NTAsImV4cCI6MjA4OTUzMTU1MH0.uRUFXySs5UHxUT0HDzS5EqcgEnDXbc6dh9R0u4ib3pg';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Candidates config ─────────────────────────────────────────
const CANDIDATES = [
  { market_id: 'david_tay',     name: 'David Tay',       isDavid: true  },
  { market_id: 'manav_r',       name: 'Manav Raghuram',  isDavid: false },
  { market_id: 'audrey_a',      name: 'Audrey Arabelo',  isDavid: false },
  { market_id: 'preston_l',     name: 'Preston Lim',     isDavid: false },
  { market_id: 'bryant_l',      name: 'Bryant Liu',      isDavid: false },
  { market_id: 'yasin_q',       name: 'Yasin Qureshi',   isDavid: false },
  { market_id: 'armaan_s',      name: 'Armaan Shah',     isDavid: false },
  { market_id: 'anthony_v',     name: 'Anthony Vuong',   isDavid: false },
  { market_id: 'yina_y',        name: 'Yina Yoon',       isDavid: false },
];

// Chart colors — top 5 get distinct colors, rest get grey
const CHART_COLORS = [
  '#d4a017', // gold — David
  '#2563eb', // blue
  '#16a34a', // green
  '#dc2626', // red
  '#7c3aed', // purple
];
const CHART_GREY = 'rgba(150,160,175,0.5)';

// ── Profanity filter — uses leo-profanity library ────────────
// Loads English list + extra bypass patterns on init
function initProfanityFilter() {
  if (window.leoProfanity) {
    window.leoProfanity.loadDictionary(); // loads full English list
    // Add common bypass patterns
    window.leoProfanity.add([
      'fck','fuk','fuq','sh1t','b1tch','b!tch','d1ck','a55','n1gga',
      'f u c k','s h i t','wtaf','stfu'
    ]);
  }
}
function isProfane(text) {
  if (window.leoProfanity) return window.leoProfanity.check(text);
  // Fallback if library fails to load
  return /\b(fuck|shit|ass|bitch|cunt|dick|nigger|nigga|faggot)\b/i.test(text);
}

// ── Email validation ─────────────────────────────────────────
const VALID_DOMAIN = '@zonemail.clpccd.edu';
function isValidEmail(e) { return e.trim().toLowerCase().endsWith(VALID_DOMAIN); }

// ── Toast ────────────────────────────────────────────────────
function showToast(msg, duration = 3000) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
}

// ── LocalStorage ─────────────────────────────────────────────
const LS_KEY = 'david_tay_user_v2';
function getUser()   { try { return JSON.parse(localStorage.getItem(LS_KEY)); } catch { return null; } }
function saveUser(u) { localStorage.setItem(LS_KEY, JSON.stringify(u)); }

// ══════════════════════════════════════════════════════════════
//  TAB NAVIGATION
// ══════════════════════════════════════════════════════════════

function switchTab(tab) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + tab).classList.add('active');
  document.querySelector('[data-tab="' + tab + '"]').classList.add('active');
  window.scrollTo(0, 0);
}

// ══════════════════════════════════════════════════════════════
//  PREDICTION MARKET — MULTI-CANDIDATE
// ══════════════════════════════════════════════════════════════

// ── Market state ──────────────────────────────────────────────
// marketData[market_id] = { yes: n, no: n, yesCount: n, noCount: n }
const marketData = {};
let cmcCurrentSlide = 0; // track carousel position across re-renders

// ── Market status ─────────────────────────────────────────────
let marketClosed = false;

async function initMarket() {
  const user = getUser();
  if (user && user.registered) {
    showBetUI(user);
    showReferralNotif(user);
  }

  // Check if market is still open
  const { data: setting } = await sb
    .from('app_settings')
    .select('value')
    .eq('key', 'market_status')
    .single();

  if (setting?.value === 'closed') {
    marketClosed = true;
    showMarketClosed();
    await loadAllMarketData();
    subscribeMarket();
    subscribeMarketStatus();
    return;
  }

  await loadAllMarketData();
  subscribeMarket();
  subscribeMarketStatus();
}

function showMarketClosed() {
  document.getElementById('market-card').innerHTML = `
    <p class="card-title">🎯 Prediction Market</p>
    <div style="text-align:center;padding:1.5rem 0;">
      <p style="font-size:1.5rem;margin-bottom:0.5rem;">🏁</p>
      <p style="font-weight:700;color:var(--navy);margin-bottom:0.25rem;">Market Closed</p>
      <p style="font-size:0.82rem;color:var(--text3);">The election has concluded. Results have been sent to all winners.</p>
    </div>
  `;
}

async function loadAllMarketData() {
  const { data, error } = await sb.from('predictions').select('market_id, side, tokens');
  if (error || !data) return;

  // Reset
  CANDIDATES.forEach(c => { marketData[c.market_id] = { yes: 0, no: 0, yesCount: 0, noCount: 0 }; });

  data.forEach(r => {
    if (!marketData[r.market_id]) return;
    if (r.side === 'yes') { marketData[r.market_id].yes += r.tokens; marketData[r.market_id].yesCount++; }
    else                  { marketData[r.market_id].no  += r.tokens; marketData[r.market_id].noCount++;  }
  });

  renderAllMarkets();
}

function subscribeMarket() {
  sb.channel('predictions_ch')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'predictions' }, payload => {
      const r = payload.new;
      if (!marketData[r.market_id]) marketData[r.market_id] = { yes: 0, no: 0, yesCount: 0, noCount: 0 };
      if (r.side === 'yes') { marketData[r.market_id].yes += r.tokens; marketData[r.market_id].yesCount++; }
      else                  { marketData[r.market_id].no  += r.tokens; marketData[r.market_id].noCount++;  }
      renderAllMarkets();
      // Full chart reload on any new bet so all candidate lines update live
      loadPriceChart();
    })
    .subscribe();
}

function subscribeMarketStatus() {
  sb.channel('market_status_ch')
    .on('postgres_changes', {
      event: 'UPDATE', schema: 'public', table: 'app_settings',
      filter: 'key=eq.market_status'
    }, payload => {
      if (payload.new.value === 'closed') {
        marketClosed = true;
        showMarketClosed();
      }
    })
    .subscribe();
}

function renderAllMarkets() {
  const container = document.getElementById('candidate-markets');
  if (!container) return;
  const user = getUser();

  // Group candidates into slides of 3
  const slides = [];
  for (let i = 0; i < CANDIDATES.length; i += 3) {
    slides.push(CANDIDATES.slice(i, i + 3));
  }

  container.innerHTML = `
    <div class="cmc-carousel" id="cmc-carousel">
      ${slides.map((group, si) => `
        <div class="cmc-slide" data-slide="${si}">
          ${group.map(c => {
            const d       = marketData[c.market_id] || { yes: 0, no: 0, yesCount: 0, noCount: 0 };
            const total   = d.yes + d.no || 1;
            const yesPct  = Math.round(d.yes / total * 100);
            const noPct   = 100 - yesPct;
            const userBet = user?.bets?.[c.market_id];
            const tokens  = user?.tokens || 0;

            return `
            <div class="candidate-market-card${c.isDavid ? ' is-david' : ''}" data-market="${c.market_id}">
              <p class="cmc-name">${c.name}${c.isDavid ? ' 🌟' : ''}</p>
              <p class="cmc-role">Director of Finances</p>
              <div class="cmc-odds">
                <div class="cmc-odds-pill yes">YES ${yesPct}%</div>
                <div class="cmc-odds-pill no">NO ${noPct}%</div>
              </div>
              <div class="cmc-bar"><div class="cmc-bar-fill" style="width:${yesPct}%"></div></div>
              <p style="font-size:0.67rem;color:var(--text3);margin-bottom:0.5rem;">${d.yesCount + d.noCount} bet${d.yesCount + d.noCount !== 1 ? 's' : ''}</p>

              ${userBet ? `<p class="cmc-existing-bet">✓ ${userBet.tokens} tokens on ${userBet.side.toUpperCase()}</p>` : ''}

              ${user && tokens > 0 ? `
                <div class="cmc-bet-row">
                  <div class="cmc-side-btn ${userBet?.side === 'yes' ? 'selected yes' : ''}"
                       data-market="${c.market_id}" data-side="yes"
                       style="${userBet?.side === 'no' ? 'opacity:0.3;pointer-events:none;' : ''}">
                    👍 YES
                  </div>
                  <div class="cmc-side-btn ${userBet?.side === 'no' ? 'selected no' : ''}"
                       data-market="${c.market_id}" data-side="no"
                       style="${userBet?.side === 'yes' ? 'opacity:0.3;pointer-events:none;' : ''}">
                    👎 NO
                  </div>
                </div>
                <div class="cmc-wager-row">
                  <input type="range" class="cmc-slider" data-market="${c.market_id}"
                         min="1" max="${tokens}" step="1" value="${Math.min(10, tokens)}" />
                  <span class="cmc-wager-val" id="wager-val-${c.market_id}">${Math.min(10, tokens)}</span>
                </div>
                <button class="cmc-bet-btn" data-market="${c.market_id}"
                  ${userBet ? '' : 'disabled'}>
                  ${userBet ? `Add more on ${userBet.side.toUpperCase()} →` : 'Select YES or NO'}
                </button>
                <p class="err-text" id="bet-err-${c.market_id}"></p>
              ` : user && tokens === 0 ? `<p style="font-size:0.72rem;color:var(--text3);margin-top:0.4rem;">No tokens remaining.</p>` : ''}
            </div>`;
          }).join('')}
        </div>
      `).join('')}
    </div>
    <div class="cmc-dots" id="cmc-dots"></div>
  `;

  // Init carousel
  initCandidateCarousel(slides.length);

  // Slider listeners
  container.querySelectorAll('.cmc-slider').forEach(slider => {
    const valEl = document.getElementById('wager-val-' + slider.dataset.market);
    slider.addEventListener('input', () => { if (valEl) valEl.textContent = slider.value; });
  });
}

// Side selection (event delegation)
document.addEventListener('click', function(e) {
  const sideBtn = e.target.closest('.cmc-side-btn');
  if (!sideBtn) return;
  const mid  = sideBtn.dataset.market;
  const side = sideBtn.dataset.side;
  const card = document.querySelector(`.candidate-market-card[data-market="${mid}"]`);
  if (!card) return;

  card.querySelectorAll('.cmc-side-btn').forEach(b => b.classList.remove('selected','yes','no'));
  sideBtn.classList.add('selected', side);

  const btn = card.querySelector('.cmc-bet-btn');
  if (btn) { btn.disabled = false; btn.textContent = `Bet ${side.toUpperCase()} →`; }
});

// Place bet (event delegation)
document.addEventListener('click', async function(e) {
  const betBtn = e.target.closest('.cmc-bet-btn');
  if (!betBtn || betBtn.disabled) return;
  if (marketClosed) { showMarketClosed(); return; }

  // Re-check market status from Supabase before processing
  const { data: setting } = await sb
    .from('app_settings')
    .select('value')
    .eq('key', 'market_status')
    .single();

  if (setting?.value === 'closed') {
    marketClosed = true;
    showMarketClosed();
    return;
  }

  const mid    = betBtn.dataset.market;
  const card   = document.querySelector(`.candidate-market-card[data-market="${mid}"]`);
  const user   = getUser();
  if (!user || !card) return;

  const selectedBtn = card.querySelector('.cmc-side-btn.selected');
  if (!selectedBtn) return;
  const side   = selectedBtn.dataset.side;
  const slider = card.querySelector('.cmc-slider');
  const tokens = parseInt(slider?.value || 10);
  const errEl  = document.getElementById('bet-err-' + mid);

  betBtn.disabled = true; betBtn.textContent = 'Placing...';

  const prevBet    = user.bets?.[mid];
  const newTokens  = user.tokens - tokens;
  const newBetToks = (prevBet?.tokens || 0) + tokens;

  // Single UPDATE — always include bet_side/bet_tokens for David's market
  const updatePayload = mid === 'david_tay'
    ? { tokens: newTokens, bet_side: side, bet_tokens: newBetToks }
    : { tokens: newTokens };

  const { error: updateErr } = await sb
    .from('market_users')
    .update(updatePayload)
    .eq('email', user.email);

  if (updateErr) {
    if (errEl) { errEl.textContent = 'Something went wrong.'; errEl.classList.add('show'); }
    betBtn.disabled = false; betBtn.textContent = 'Try Again';
    return;
  }

  await sb.from('predictions').insert([{ market_id: mid, side, tokens, email: user.email }]);

  if (!user.bets) user.bets = {};
  user.bets[mid] = { side, tokens: newBetToks };
  user.tokens    = newTokens;
  saveUser(user);

  document.getElementById('user-tokens').textContent = newTokens;
  showToast('Bet placed on ' + side.toUpperCase() + '! 🎯');
  if (errEl) errEl.classList.remove('show');

  renderAllMarkets();
});

// ── Show bet UI ───────────────────────────────────────────────
function showBetUI(user) {
  document.getElementById('market-register').style.display = 'none';
  document.getElementById('market-bet').style.display      = 'block';
  document.getElementById('user-tokens').textContent       = user.tokens;
  renderAllMarkets();
}

// ── Referral notification ─────────────────────────────────────
async function showReferralNotif(user) {
  const notif = document.getElementById('referral-notif');
  if (!notif) return;

  const { data } = await sb
    .from('market_users')
    .select('email')
    .eq('referred_by', user.email);

  if (!data || data.length === 0) return;

  const referralCount  = data.length;
  const totalEarned    = referralCount * 20;
  // Base tokens = 100 + referral bonus earned. If user has spent below base 100, they've used referral tokens.
  const baseTokens     = 100 + totalEarned;
  const spentReferral  = user.tokens < baseTokens;

  notif.style.display = 'block';
  if (spentReferral) {
    notif.innerHTML = `✅ You've referred <strong>${referralCount} student${referralCount !== 1 ? 's' : ''}</strong> and earned <strong>+${totalEarned} tokens</strong>. All spent — good luck! 🎯`;
    // Fade out after 5s
    setTimeout(() => { notif.style.opacity = '0'; setTimeout(() => { notif.style.display = 'none'; }, 600); }, 5000);
  } else {
    notif.innerHTML = `🎁 You've referred <strong>${referralCount} student${referralCount !== 1 ? 's' : ''}</strong> and earned <strong>+${totalEarned} bonus tokens</strong>. Use them wisely!`;
  }
}

// ── Registration ─────────────────────────────────────────────
document.getElementById('reg-btn').addEventListener('click', async () => {
  if (marketClosed) { showMarketClosed(); return; }

  // Re-check market status from Supabase before processing
  const { data: setting } = await sb
    .from('app_settings')
    .select('value')
    .eq('key', 'market_status')
    .single();

  if (setting?.value === 'closed') {
    marketClosed = true;
    showMarketClosed();
    return;
  }

  const email = document.getElementById('reg-email').value.trim().toLowerCase();
  const name  = document.getElementById('reg-name').value.trim();
  const errEl = document.getElementById('reg-err');
  const btn   = document.getElementById('reg-btn');

  if (!isValidEmail(email)) { errEl.classList.add('show'); return; }
  errEl.classList.remove('show');
  btn.disabled = true; btn.textContent = 'Registering...';

  const { data: existing } = await sb
    .from('market_users')
    .select('id, tokens, bet_side, bet_tokens, display_name, referred_by')
    .eq('email', email)
    .single();

  if (existing) {
    // Also fetch all predictions for this user to rebuild bets map
    const { data: preds } = await sb
      .from('predictions')
      .select('market_id, side, tokens')
      .eq('email', email);

    const bets = {};
    if (preds) {
      // Aggregate total tokens per market
      preds.forEach(p => {
        if (!bets[p.market_id]) bets[p.market_id] = { side: p.side, tokens: 0 };
        bets[p.market_id].tokens += p.tokens;
      });
    }

    const user = {
      registered: true, email,
      name: existing.display_name || name || null,
      tokens: existing.tokens,
      bets
    };
    saveUser(user);
    showBetUI(user);
    showReferralNotif(user);
    showToast('Welcome back! 🎉');
    btn.disabled = false; btn.textContent = 'Claim My Tokens →';
    return;
  }

  btn.disabled = false; btn.textContent = 'Claim My Tokens →';
  showReferralPopup(email, name);
});

// ── Referral popup ────────────────────────────────────────────
const REFERRAL_BONUS = 20;

function showReferralPopup(email, name) {
  const popup = document.getElementById('referral-popup');
  popup.style.display = 'flex';
  popup.dataset.email = email;
  popup.dataset.name  = name;
  // Reset popup to initial state
  document.getElementById('ref-no-step').style.display  = 'block';
  document.getElementById('ref-yes-step').style.display = 'none';
  document.getElementById('ref-input').value = '';
  const errEl = document.getElementById('ref-err');
  if (errEl) errEl.classList.remove('show');
}

document.addEventListener('click', async function(e) {
  if (e.target.closest('#ref-yes-btn')) {
    document.getElementById('ref-no-step').style.display  = 'none';
    document.getElementById('ref-yes-step').style.display = 'block';
  }

  if (e.target.closest('#ref-no-btn')) {
    const popup = document.getElementById('referral-popup');
    await completeRegistration(popup.dataset.email, popup.dataset.name, null);
    popup.style.display = 'none';
  }

  if (e.target.closest('#ref-submit-btn')) {
    const popup       = document.getElementById('referral-popup');
    const referrer    = document.getElementById('ref-input').value.trim().toLowerCase();
    const errEl       = document.getElementById('ref-err');
    const btn         = document.getElementById('ref-submit-btn');

    if (!referrer) { errEl.textContent = 'Please enter the referrer\'s email.'; errEl.classList.add('show'); return; }
    if (!isValidEmail(referrer)) { errEl.textContent = 'Must be a @zonemail.clpccd.edu email.'; errEl.classList.add('show'); return; }
    if (referrer === popup.dataset.email) { errEl.textContent = 'You can\'t refer yourself!'; errEl.classList.add('show'); return; }
    errEl.classList.remove('show');
    btn.disabled = true; btn.textContent = 'Submitting...';

    const { data: referrerData } = await sb
      .from('market_users')
      .select('id, tokens')
      .eq('email', referrer)
      .single();

    if (!referrerData) {
      errEl.textContent = 'That email isn\'t registered yet. Ask them to register first.';
      errEl.classList.add('show');
      btn.disabled = false; btn.textContent = 'Submit →';
      return;
    }

    await sb.from('market_users')
      .update({ tokens: referrerData.tokens + REFERRAL_BONUS })
      .eq('email', referrer);

    // If referrer is the current session user, update their localStorage too
    const currentUser = getUser();
    if (currentUser && currentUser.email === referrer) {
      currentUser.tokens = referrerData.tokens + REFERRAL_BONUS;
      saveUser(currentUser);
      document.getElementById('user-tokens').textContent = currentUser.tokens;
    }

    await completeRegistration(popup.dataset.email, popup.dataset.name, referrer, 100 + REFERRAL_BONUS);
    popup.style.display = 'none';
    showToast('Registered! You and ' + referrer.split('@')[0] + ' each got +' + REFERRAL_BONUS + ' tokens 🎁');
    btn.disabled = false; btn.textContent = 'Submit →';
  }
});

async function completeRegistration(email, name, referredBy, tokens = 100) {
  const { error } = await sb.from('market_users').insert([{
    email, display_name: name || null, tokens, referred_by: referredBy || null
  }]);
  if (error && error.code !== '23505') { showToast('Something went wrong. Try again.'); return; }
  const user = { registered: true, email, name: name || null, tokens, bets: {} };
  saveUser(user);
  showBetUI(user);
  if (!referredBy) showToast('100 tokens claimed! Place your bets 🪙');
}

// ══════════════════════════════════════════════════════════════
//  CANDIDATE CAROUSEL
// ══════════════════════════════════════════════════════════════

function initCandidateCarousel(totalSlides) {
  const carousel = document.getElementById('cmc-carousel');
  const dotsWrap = document.getElementById('cmc-dots');
  if (!carousel || totalSlides <= 1) return;

  // Restore position from before re-render
  let current = Math.min(cmcCurrentSlide, totalSlides - 1);

  dotsWrap.innerHTML = '';
  for (let i = 0; i < totalSlides; i++) {
    const dot = document.createElement('button');
    dot.className = 'cmc-dot' + (i === current ? ' active' : '');
    dot.setAttribute('aria-label', 'Slide ' + (i + 1));
    dot.addEventListener('click', () => goTo(i));
    dotsWrap.appendChild(dot);
  }

  // Apply restored position immediately without animation
  carousel.style.transition = 'none';
  carousel.style.transform = `translateX(-${current * 100}%)`;
  setTimeout(() => { carousel.style.transition = ''; }, 50);

  function goTo(n) {
    current = (n + totalSlides) % totalSlides;
    cmcCurrentSlide = current; // sync global tracker
    carousel.style.transition = 'transform 0.38s ease';
    carousel.style.transform = `translateX(-${current * 100}%)`;
    dotsWrap.querySelectorAll('.cmc-dot').forEach((d, i) => d.classList.toggle('active', i === current));
  }

  let tx = 0, ty = 0;
  carousel.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - tx;
    const dy = e.changedTouches[0].clientY - ty;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 35) dx < 0 ? goTo(current + 1) : goTo(current - 1);
  }, { passive: true });

  let mx = 0, dragging = false;
  carousel.addEventListener('mousedown', e => {
    if (e.target.closest('.cmc-slider')) return; // ignore slider interactions
    mx = e.clientX; dragging = true;
  });
  carousel.addEventListener('mouseup', e => {
    if (!dragging) return; dragging = false;
    const dx = e.clientX - mx;
    if (Math.abs(dx) > 35) dx < 0 ? goTo(current + 1) : goTo(current - 1);
  });
  carousel.addEventListener('mouseleave', () => { dragging = false; });

  // Also block touch swipe when touch starts on a slider
  carousel.addEventListener('touchstart', e => {
    if (e.target.closest('.cmc-slider')) { tx = -9999; ty = -9999; return; }
    tx = e.touches[0].clientX; ty = e.touches[0].clientY;
  }, { passive: true });
}

// ══════════════════════════════════════════════════════════════
//  PRICE PATH CHART — all candidates
// ══════════════════════════════════════════════════════════════

let priceChart = null;

async function loadPriceChart() {
  const { data, error } = await sb
    .from('predictions')
    .select('market_id, side, tokens, created_at')
    .order('created_at', { ascending: true });

  const canvas = document.getElementById('price-chart');
  if (!canvas) return;

  if (error || !data || data.length === 0) { renderPriceChart([], []); return; }

  const allTimes = [...new Set(data.map(d => d.created_at))].sort();

  const datasets = CANDIDATES.map((c) => {
    const candBets = data.filter(d => d.market_id === c.market_id);
    if (candBets.length === 0) return null;

    let yesTotal = 0, noTotal = 0;
    const betMap = {};
    candBets.forEach(b => {
      if (b.side === 'yes') yesTotal += b.tokens;
      else noTotal += b.tokens;
      // Probability = yesTokens / totalTokens in this market
      // This is correct: it reflects what fraction of all bettors back YES
      betMap[b.created_at] = Math.round(yesTotal / (yesTotal + noTotal) * 100);
    });

    let lastPct = 50;
    const points = allTimes.map(t => {
      if (betMap[t] !== undefined) lastPct = betMap[t];
      return lastPct;
    });

    const totalVolume = candBets.reduce((s, b) => s + b.tokens, 0);
    return { candidate: c, points, totalVolume };
  }).filter(Boolean);

  // Assign colors — David always gets gold, top 4 others get distinct colors, rest grey
  const sorted = [...datasets].sort((a, b) => b.totalVolume - a.totalVolume);
  let colorIdx = 1;
  sorted.forEach(d => {
    if (d.candidate.isDavid) { d.color = CHART_COLORS[0]; }
    else {
      d.color = colorIdx < CHART_COLORS.length ? CHART_COLORS[colorIdx++] : CHART_GREY;
    }
  });

  const labels = allTimes.map((t, i) => {
    const show = i === 0 || i === allTimes.length - 1 || i % Math.max(1, Math.floor(allTimes.length / 5)) === 0;
    return show ? shortTime(t) : '';
  });

  renderPriceChart(datasets, labels);
}

function renderPriceChart(datasets, labels) {
  const canvas = document.getElementById('price-chart');
  if (!canvas) return;
  if (priceChart) priceChart.destroy();

  if (!datasets || datasets.length === 0) {
    priceChart = new Chart(canvas, {
      type: 'line',
      data: { labels: ['Now'], datasets: [{ data: [50], borderColor: CHART_GREY, borderWidth: 1.5, pointRadius: 0, tension: 0.3 }] },
      options: { responsive: true, plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#8896a8', font: { size: 9 } } },
          y: { min: 0, max: 100, ticks: { color: '#8896a8', font: { size: 9 }, callback: v => v + '%', stepSize: 25 }, grid: { color: 'rgba(15,31,61,0.06)' } }
        }}
    });
    return;
  }

  priceChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: datasets.map(d => ({
        label: d.candidate.name,
        data: d.points,
        borderColor: d.color,
        backgroundColor: 'transparent',
        borderWidth: d.candidate.isDavid ? 2.5 : 1.5,
        pointRadius: 0, pointHoverRadius: 4,
        tension: 0.35,
        borderDash: d.color === CHART_GREY ? [3, 3] : [],
      }))
    },
    options: {
      responsive: true, animation: { duration: 350 },
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#8896a8', font: { size: 9 }, maxRotation: 0 } },
        y: { min: 0, max: 100, grid: { color: 'rgba(15,31,61,0.06)' },
          ticks: { color: '#8896a8', font: { size: 9 }, callback: v => v + '%', stepSize: 25 } }
      },
      plugins: {
        legend: { display: true, position: 'bottom',
          labels: { color: '#4a5568', font: { size: 9 }, boxWidth: 12, padding: 8,
            filter: (item) => {
              const ds = datasets[item.datasetIndex];
              return ds && ds.color !== CHART_GREY;
            }
          }
        },
        tooltip: { backgroundColor: '#0f1f3d', borderColor: 'rgba(212,160,23,0.3)', borderWidth: 1,
          titleColor: 'rgba(255,255,255,0.55)', bodyColor: '#fff', bodyFont: { size: 11 },
          callbacks: { label: ctx => ' ' + ctx.dataset.label + ': ' + ctx.parsed.y + '%' }
        }
      }
    }
  });
}

function shortTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ══════════════════════════════════════════════════════════════
//  VOICE WALL
// ══════════════════════════════════════════════════════════════

const CATEGORY_LABELS = {
  budget: '💰 Budget', clubs: '🎓 Clubs',
  events: '🎉 Events', campus: '🏫 Campus', other: '💬 Other'
};

async function loadVoiceWall() {
  const { data, error } = await sb
    .from('voice_messages')
    .select('text, category, created_at')
    .order('created_at', { ascending: true })
    .limit(50);

  const wall  = document.getElementById('msg-wall');
  const empty = document.getElementById('wall-empty');
  if (error || !data || data.length === 0) { empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  wall.innerHTML = data.map(m => `
    <div class="msg-item">
      <div class="msg-meta">
        <span class="msg-cat">${CATEGORY_LABELS[m.category] || '💬 Other'}</span>
        <span>${timeAgo(m.created_at)}</span>
      </div>
      <div class="msg-text">${escapeHtml(m.text)}</div>
    </div>
  `).join('');
  const scroll = wall.closest('.msg-scroll');
  if (scroll) scroll.scrollTop = scroll.scrollHeight;
}

function subscribeVoiceWall() {
  sb.channel('voice_ch')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'voice_messages' }, payload => {
      const m     = payload.new;
      const empty = document.getElementById('wall-empty');
      const wall  = document.getElementById('msg-wall');
      if (empty) empty.style.display = 'none';
      const div = document.createElement('div');
      div.className = 'msg-item';
      div.style.animation = 'fadeIn 0.28s ease';
      div.innerHTML = `
        <div class="msg-meta">
          <span class="msg-cat">${CATEGORY_LABELS[m.category] || '💬 Other'}</span>
          <span>just now</span>
        </div>
        <div class="msg-text">${escapeHtml(m.text)}</div>
      `;
      wall.appendChild(div);
      const scroll = wall.closest('.msg-scroll');
      if (scroll) scroll.scrollTop = scroll.scrollHeight;
    }).subscribe();
}

const voiceTextarea = document.getElementById('voice-msg');
const charLeft      = document.getElementById('char-left');
voiceTextarea.addEventListener('input', () => { charLeft.textContent = 280 - voiceTextarea.value.length; });
voiceTextarea.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submitVoice(); } });
document.getElementById('voice-submit').addEventListener('click', submitVoice);

async function submitVoice() {
  const text  = voiceTextarea.value.trim();
  const errEl = document.getElementById('voice-err');
  const btn   = document.getElementById('voice-submit');
  const cat   = document.getElementById('voice-cat').value;
  if (!text) { voiceTextarea.focus(); return; }
  if (isProfane(text)) { errEl.textContent = '⚠ Please keep messages respectful.'; errEl.classList.add('show'); return; }
  errEl.classList.remove('show');
  btn.disabled = true; btn.textContent = 'Submitting...';
  const { error } = await sb.from('voice_messages').insert([{ text, category: cat }]);
  if (error) { errEl.textContent = '⚠ Something went wrong.'; errEl.classList.add('show'); }
  else { voiceTextarea.value = ''; charLeft.textContent = '280'; showToast('Message posted! 📣'); }
  btn.disabled = false; btn.textContent = 'Submit Anonymously';
}

// ══════════════════════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════════════════════

function escapeHtml(str) { const d = document.createElement('div'); d.appendChild(document.createTextNode(str)); return d.innerHTML; }
function timeAgo(iso) {
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  return Math.floor(diff / 86400) + 'd ago';
}

// ══════════════════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', async () => {
  initProfanityFilter();
  await initMarket();
  await loadPriceChart();
  await loadVoiceWall();
  subscribeVoiceWall();
  setInterval(loadVoiceWall, 60000);
});

// ══════════════════════════════════════════════════════════════
//  BIO SLIDESHOW
// ══════════════════════════════════════════════════════════════

function initBioSlideshow() {
  const slides   = Array.from(document.querySelectorAll('.bio-slide'));
  const dotsWrap = document.getElementById('bio-dots');
  const prevBtn  = document.getElementById('bio-prev');
  const nextBtn  = document.getElementById('bio-next');
  if (!slides.length) return;

  let current = 0, timer = null;
  const DELAY = 4000;

  slides.forEach((_, i) => {
    const dot = document.createElement('button');
    dot.className = 'bio-dot' + (i === 0 ? ' active' : '');
    dot.setAttribute('aria-label', 'Slide ' + (i + 1));
    dot.addEventListener('click', () => goTo(i));
    dotsWrap.appendChild(dot);
  });

  function dots() { return Array.from(dotsWrap.querySelectorAll('.bio-dot')); }
  function goTo(n) {
    slides[current].classList.remove('active'); dots()[current]?.classList.remove('active');
    current = (n + slides.length) % slides.length;
    slides[current].classList.add('active'); dots()[current]?.classList.add('active');
    resetTimer();
  }
  function resetTimer() { clearInterval(timer); timer = setInterval(() => goTo(current + 1), DELAY); }

  prevBtn?.addEventListener('click', () => goTo(current - 1));
  nextBtn?.addEventListener('click', () => goTo(current + 1));

  const wrap = document.querySelector('.bio-slideshow');
  let tx = 0;
  wrap.addEventListener('touchstart', e => { tx = e.touches[0].clientX; }, { passive: true });
  wrap.addEventListener('touchend',   e => {
    const dx = e.changedTouches[0].clientX - tx;
    if (Math.abs(dx) > 40) dx < 0 ? goTo(current + 1) : goTo(current - 1);
  }, { passive: true });

  resetTimer();
}

document.addEventListener('DOMContentLoaded', initBioSlideshow);

// ══════════════════════════════════════════════════════════════
//  INSTAGRAM REEL CAROUSEL
// ══════════════════════════════════════════════════════════════

function initReelCarousel() {
  const carousel = document.getElementById('reel-carousel');
  const dotsWrap = document.getElementById('reel-dots');
  if (!carousel) return;

  const slides = Array.from(carousel.querySelectorAll('.reel-slide'));
  if (slides.length <= 1) return;

  let current = 0;

  slides.forEach((_, i) => {
    const dot = document.createElement('button');
    dot.className = 'reel-dot' + (i === 0 ? ' active' : '');
    dot.setAttribute('aria-label', 'Reel ' + (i + 1));
    dot.addEventListener('click', () => goTo(i));
    dotsWrap.appendChild(dot);
  });

  function dots() { return Array.from(dotsWrap.querySelectorAll('.reel-dot')); }
  function goTo(n) {
    current = (n + slides.length) % slides.length;
    carousel.style.transform = `translateX(-${current * 100}%)`;
    dots().forEach((d, i) => d.classList.toggle('active', i === current));
  }

  // Swipe zones (left/right edge overlays that capture touch over the iframe)
  const leftZone  = document.getElementById('reel-swipe-left');
  const rightZone = document.getElementById('reel-swipe-right');
  leftZone?.addEventListener('click',  () => goTo(current - 1));
  rightZone?.addEventListener('click', () => goTo(current + 1));

  // Touch swipe on the whole wrap — only horizontal
  const wrap = document.getElementById('reel-carousel-wrap');
  let tx = 0, ty = 0;
  wrap.addEventListener('touchstart', e => {
    tx = e.touches[0].clientX;
    ty = e.touches[0].clientY;
  }, { passive: true });
  wrap.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - tx;
    const dy = e.changedTouches[0].clientY - ty;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 35) {
      dx < 0 ? goTo(current + 1) : goTo(current - 1);
    }
  }, { passive: true });

  // Mouse drag
  let mx = 0, dragging = false;
  wrap.addEventListener('mousedown', e => { mx = e.clientX; dragging = true; });
  wrap.addEventListener('mouseup', e => {
    if (!dragging) return; dragging = false;
    const dx = e.clientX - mx;
    if (Math.abs(dx) > 35) dx < 0 ? goTo(current + 1) : goTo(current - 1);
  });
  wrap.addEventListener('mouseleave', () => { dragging = false; });
}

document.addEventListener('DOMContentLoaded', initReelCarousel);
