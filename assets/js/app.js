/**
 * app.js — David Tay for LPCSG Campaign Site
 */

const SUPABASE_URL      = 'https://zmcmttvfigrbfmopehsy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptY210dHZmaWdyYmZtb3BlaHN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NTU1NTAsImV4cCI6MjA4OTUzMTU1MH0.uRUFXySs5UHxUT0HDzS5EqcgEnDXbc6dh9R0u4ib3pg';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Profanity filter (extended with common bypasses) ─────────
const BLOCKED = [
  'fuck','fck','f u c k','f*ck','sh1t','shit','ass','bitch','cunt','dick',
  'cock','pussy','nigger','nigga','faggot','fag','retard','whore','slut',
  'bastard','crap','piss','asshole','motherfucker','bullshit','jackass',
  'fuk','fuq','b1tch','a55','d1ck','b!tch','n1gga','wtf'
];
const profRE = new RegExp(
  '(' + BLOCKED.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')',
  'i'
);

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
const LS_KEY = 'david_tay_user';
function getUser()    { try { return JSON.parse(localStorage.getItem(LS_KEY)); } catch { return null; } }
function saveUser(u)  { localStorage.setItem(LS_KEY, JSON.stringify(u)); }

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
//  PREDICTION MARKET
// ══════════════════════════════════════════════════════════════

let selectedSide = null;

async function initMarket() {
  const user = getUser();
  if (user && user.registered) showBetUI(user);
  await loadMarketData();
  subscribeMarket();
}

async function loadMarketData() {
  const { data, error } = await sb.from('predictions').select('side, tokens');
  if (error || !data) return;
  const yes = data.filter(r => r.side === 'yes');
  const no  = data.filter(r => r.side === 'no');
  const yesTotal = yes.reduce((s, r) => s + r.tokens, 0);
  const noTotal  = no.reduce((s, r) => s + r.tokens, 0);
  const total    = yesTotal + noTotal || 1;
  const yesPct   = Math.round(yesTotal / total * 100);
  document.getElementById('odds-yes').textContent  = yesPct + '%';
  document.getElementById('odds-no').textContent   = (100 - yesPct) + '%';
  document.getElementById('count-yes').textContent = yes.length + ' bet' + (yes.length !== 1 ? 's' : '');
  document.getElementById('count-no').textContent  = no.length  + ' bet' + (no.length  !== 1 ? 's' : '');
  document.getElementById('market-bar-fill').style.width = yesPct + '%';
}

function subscribeMarket() {
  sb.channel('predictions_ch')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'predictions' }, loadMarketData)
    .subscribe();
}

function showBetUI(user) {
  document.getElementById('market-register').style.display = 'none';
  document.getElementById('market-bet').style.display      = 'block';
  document.getElementById('user-tokens').textContent       = user.tokens;

  if (user.bet) {
    // Has existing bet — show add-more interface locked to same side
    document.getElementById('bet-placed').style.display    = 'block';
    document.getElementById('user-bet-info').textContent   =
      'Bet: ' + user.bet.tokens + ' tokens on ' + user.bet.side.toUpperCase();

    if (user.tokens > 0) {
      // Allow adding more tokens to same side
      document.getElementById('bet-interface').style.display = 'block';
      document.getElementById('bet-add-note').style.display  = 'block';
      // Lock to original side
      selectSide(user.bet.side);
      document.getElementById('bet-yes').style.pointerEvents = user.bet.side === 'yes' ? 'auto' : 'none';
      document.getElementById('bet-no').style.pointerEvents  = user.bet.side === 'no'  ? 'auto' : 'none';
      document.getElementById('bet-yes').style.opacity = user.bet.side === 'yes' ? '1' : '0.3';
      document.getElementById('bet-no').style.opacity  = user.bet.side === 'no'  ? '1' : '0.3';
    } else {
      document.getElementById('bet-interface').style.display = 'none';
    }
  }

  // Slider — step of 1
  const slider = document.getElementById('token-slider');
  slider.max   = user.tokens;
  slider.min   = 1;
  slider.step  = 1;
  slider.value = Math.min(50, user.tokens);
  document.getElementById('slider-val').textContent = slider.value;
  slider.addEventListener('input', () => {
    document.getElementById('slider-val').textContent = slider.value;
  });
}

// ── Registration ─────────────────────────────────────────────
document.getElementById('reg-btn').addEventListener('click', async () => {
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
    const user = {
      registered: true, email,
      name: existing.display_name || name || null,
      tokens: existing.tokens,
      bet: existing.bet_side ? { side: existing.bet_side, tokens: existing.bet_tokens } : null
    };
    saveUser(user);
    showBetUI(user);
    showToast('Welcome back! 🎉');
    btn.disabled = false; btn.textContent = 'Claim My Tokens →';
    return;
  }

  // New user — show referral popup before inserting
  btn.disabled = false; btn.textContent = 'Claim My Tokens →';
  showReferralPopup(email, name);
});

// ── Bet side selection ────────────────────────────────────────
document.addEventListener('click', function(e) {
  const user = getUser();
  if (e.target.closest('#bet-yes') && (!user?.bet || user.bet.side === 'yes')) selectSide('yes');
  if (e.target.closest('#bet-no')  && (!user?.bet || user.bet.side === 'no'))  selectSide('no');
});

function selectSide(side) {
  selectedSide = side;
  ['yes','no'].forEach(s => {
    const el = document.getElementById('bet-' + s);
    el.classList.toggle('selected', s === side);
    el.classList.toggle(s, s === side);
  });
  const btn = document.getElementById('place-bet-btn');
  btn.disabled    = false;
  btn.textContent = 'Place Bet on ' + side.toUpperCase() + ' →';
}

// ── Place bet ─────────────────────────────────────────────────
document.addEventListener('click', async function(e) {
  if (!e.target.closest('#place-bet-btn')) return;

  const user = getUser();
  if (!user || !selectedSide) return;

  const tokens    = parseInt(document.getElementById('token-slider').value);
  const errEl     = document.getElementById('bet-err');
  const btn       = document.getElementById('place-bet-btn');

  btn.disabled = true; btn.textContent = 'Placing bet...';

  const newTokens     = user.tokens - tokens;
  const newBetTokens  = (user.bet?.tokens || 0) + tokens;

  const { error: updateErr } = await sb
    .from('market_users')
    .update({ tokens: newTokens, bet_side: selectedSide, bet_tokens: newBetTokens })
    .eq('email', user.email);

  if (updateErr) {
    errEl.textContent = 'Something went wrong. Try again.';
    errEl.classList.add('show');
    btn.disabled = false; btn.textContent = 'Place Bet →';
    return;
  }

  await sb.from('predictions').insert([{ side: selectedSide, tokens, email: user.email }]);

  user.tokens   = newTokens;
  user.bet      = { side: selectedSide, tokens: newBetTokens };
  saveUser(user);

  document.getElementById('user-tokens').textContent   = newTokens;
  document.getElementById('user-bet-info').textContent =
    'Bet: ' + newBetTokens + ' tokens on ' + selectedSide.toUpperCase();

  // Hide bet interface if out of tokens
  if (newTokens <= 0) {
    document.getElementById('bet-interface').style.display = 'none';
    document.getElementById('bet-add-note').style.display  = 'none';
  } else {
    const slider = document.getElementById('token-slider');
    slider.max   = newTokens;
    slider.value = Math.min(slider.value, newTokens);
    document.getElementById('slider-val').textContent = slider.value;
  }

  showToast('Bet placed! Good luck 🎯');
  errEl.classList.remove('show');
  btn.disabled = false; btn.textContent = 'Add More →';
});

// ══════════════════════════════════════════════════════════════
//  REFERRAL SYSTEM
// ══════════════════════════════════════════════════════════════

const REFERRAL_BONUS = 20; // tokens awarded to both referrer and new user

function showReferralPopup(email, name) {
  document.getElementById('referral-popup').style.display = 'flex';
  document.getElementById('referral-popup').dataset.email = email;
  document.getElementById('referral-popup').dataset.name  = name;
}

document.addEventListener('click', async function(e) {
  // "Yes, I was referred" — show input
  if (e.target.closest('#ref-yes-btn')) {
    document.getElementById('ref-no-step').style.display  = 'none';
    document.getElementById('ref-yes-step').style.display = 'block';
  }

  // "No thanks" — register without referral
  if (e.target.closest('#ref-no-btn')) {
    const popup = document.getElementById('referral-popup');
    await completeRegistration(popup.dataset.email, popup.dataset.name, null);
    popup.style.display = 'none';
  }

  // Submit referral
  if (e.target.closest('#ref-submit-btn')) {
    const popup       = document.getElementById('referral-popup');
    const referrerRaw = document.getElementById('ref-input').value.trim().toLowerCase();
    const errEl       = document.getElementById('ref-err');
    const btn         = document.getElementById('ref-submit-btn');

    if (!referrerRaw) {
      errEl.textContent = 'Please enter the referrer\'s email.';
      errEl.classList.add('show'); return;
    }
    if (!isValidEmail(referrerRaw)) {
      errEl.textContent = 'Must be a @zonemail.clpccd.edu email.';
      errEl.classList.add('show'); return;
    }
    if (referrerRaw === popup.dataset.email) {
      errEl.textContent = 'You can\'t refer yourself!';
      errEl.classList.add('show'); return;
    }
    errEl.classList.remove('show');
    btn.disabled = true; btn.textContent = 'Submitting...';

    // Check referrer exists
    const { data: referrer } = await sb
      .from('market_users')
      .select('id, tokens, email')
      .eq('email', referrerRaw)
      .single();

    if (!referrer) {
      errEl.textContent = 'Referrer email not found. Ask them to register first.';
      errEl.classList.add('show');
      btn.disabled = false; btn.textContent = 'Submit →';
      return;
    }

    // Give referrer bonus tokens
    await sb.from('market_users')
      .update({ tokens: referrer.tokens + REFERRAL_BONUS })
      .eq('email', referrerRaw);

    // Register new user with bonus + referral note
    await completeRegistration(popup.dataset.email, popup.dataset.name, referrerRaw, 100 + REFERRAL_BONUS);
    popup.style.display = 'none';
    showToast('Registered! You and ' + referrerRaw.split('@')[0] + ' each got +' + REFERRAL_BONUS + ' tokens 🎁');
  }
});

async function completeRegistration(email, name, referredBy, tokens = 100) {
  const { error } = await sb.from('market_users').insert([{
    email,
    display_name: name || null,
    tokens,
    referred_by: referredBy || null
  }]);

  if (error && error.code !== '23505') {
    showToast('Something went wrong. Try again.');
    return;
  }

  const user = { registered: true, email, name: name || null, tokens, bet: null };
  saveUser(user);
  showBetUI(user);
  if (!referredBy) showToast('100 tokens claimed! Place your bet 🪙');
}

// ══════════════════════════════════════════════════════════════
//  PRICE PATH CHART
// ══════════════════════════════════════════════════════════════

let priceChart = null;

async function loadPriceChart() {
  const { data, error } = await sb
    .from('predictions')
    .select('side, tokens, created_at')
    .order('created_at', { ascending: true });

  const canvas = document.getElementById('price-chart');
  if (!canvas) return;
  if (error || !data || data.length < 2) { renderPriceChart([50], ['Now']); return; }

  let yesTotal = 0, noTotal = 0;
  const points = [], labels = [];
  data.forEach((bet, i) => {
    if (bet.side === 'yes') yesTotal += bet.tokens;
    else noTotal += bet.tokens;
    points.push(Math.round(yesTotal / (yesTotal + noTotal) * 100));
    const showLabel = i === 0 || i === data.length - 1 ||
      i % Math.max(1, Math.floor(data.length / 5)) === 0;
    labels.push(showLabel ? shortTime(bet.created_at) : '');
  });
  renderPriceChart(points, labels);
}

function renderPriceChart(points, labels) {
  const canvas = document.getElementById('price-chart');
  if (!canvas) return;
  const lastVal   = points[points.length - 1];
  const color     = lastVal >= 50 ? '#2ecc71' : '#ff6666';
  const fillColor = lastVal >= 50 ? 'rgba(46,204,113,0.08)' : 'rgba(255,102,102,0.08)';
  if (priceChart) priceChart.destroy();
  priceChart = new Chart(canvas, {
    type: 'line',
    data: { labels, datasets: [{ data: points, borderColor: color, backgroundColor: fillColor,
      borderWidth: 2, pointRadius: 0, pointHoverRadius: 5,
      pointHoverBackgroundColor: color, tension: 0.35, fill: true }]},
    options: {
      responsive: true, animation: { duration: 400 },
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: { grid: { display: false }, ticks: { color: 'rgba(255,255,255,0.25)', font: { size: 9 }, maxRotation: 0 }},
        y: { min: 0, max: 100, grid: { color: 'rgba(255,255,255,0.06)' },
          ticks: { color: 'rgba(255,255,255,0.3)', font: { size: 9 }, callback: v => v + '%', stepSize: 25 }}
      },
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: '#1a1a1a', borderColor: 'rgba(212,160,23,0.3)', borderWidth: 1,
          titleColor: 'rgba(255,255,255,0.5)', bodyColor: '#fff', bodyFont: { weight: 'bold', size: 13 },
          callbacks: { title: () => 'YES probability', label: ctx => ' ' + ctx.parsed.y + '%' }}
      }
    }
  });
}

function subscribePriceChart() {
  sb.channel('price_chart_ch')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'predictions' }, loadPriceChart)
    .subscribe();
}

function shortTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ══════════════════════════════════════════════════════════════
//  VOICE WALL
// ══════════════════════════════════════════════════════════════

const CATEGORY_LABELS = {
  budget: '💰 Budget & Spending', clubs: '🎓 Clubs',
  events: '🎉 Events', campus: '🏫 Campus Life', other: '💬 Other'
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
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'voice_messages' },
      payload => {
        const m     = payload.new;
        const empty = document.getElementById('wall-empty');
        const wall  = document.getElementById('msg-wall');
        if (empty) empty.style.display = 'none';
        const div = document.createElement('div');
        div.className = 'msg-item';
        div.style.animation = 'fadeIn 0.3s ease';
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
      }
    ).subscribe();
}

const voiceTextarea = document.getElementById('voice-msg');
const charLeft      = document.getElementById('char-left');
voiceTextarea.addEventListener('input', () => {
  charLeft.textContent = 280 - voiceTextarea.value.length;
});
// Enter submits, no Shift+Enter new line
voiceTextarea.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); submitVoice(); }
});
document.getElementById('voice-submit').addEventListener('click', submitVoice);

async function submitVoice() {
  const text  = voiceTextarea.value.trim();
  const errEl = document.getElementById('voice-err');
  const btn   = document.getElementById('voice-submit');
  const cat   = document.getElementById('voice-cat').value;
  if (!text) { voiceTextarea.focus(); return; }
  if (profRE.test(text)) {
    errEl.textContent = '⚠ Please keep messages respectful.';
    errEl.classList.add('show'); return;
  }
  errEl.classList.remove('show');
  btn.disabled = true; btn.textContent = 'Submitting...';
  const { error } = await sb.from('voice_messages').insert([{ text, category: cat }]);
  if (error) {
    errEl.textContent = '⚠ Something went wrong. Try again.';
    errEl.classList.add('show');
  } else {
    voiceTextarea.value = ''; charLeft.textContent = '280';
    showToast('Message posted! 📣');
  }
  btn.disabled = false; btn.textContent = 'Submit Anonymously';
}

// ══════════════════════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════════════════════

function escapeHtml(str) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(str));
  return d.innerHTML;
}

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
  await initMarket();
  await loadPriceChart();
  await loadVoiceWall();
  subscribePriceChart();
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
    slides[current].classList.remove('active');
    dots()[current] && dots()[current].classList.remove('active');
    current = (n + slides.length) % slides.length;
    slides[current].classList.add('active');
    dots()[current] && dots()[current].classList.add('active');
    resetTimer();
  }
  function resetTimer() { clearInterval(timer); timer = setInterval(() => goTo(current + 1), DELAY); }

  if (prevBtn) prevBtn.addEventListener('click', () => goTo(current - 1));
  if (nextBtn) nextBtn.addEventListener('click', () => goTo(current + 1));

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

  // Touch swipe — use the wrapper, not the carousel itself (avoids Instagram iframe conflict)
  const wrap = carousel.closest('.reel-carousel-wrap');
  let tx = 0, ty = 0;
  wrap.addEventListener('touchstart', e => {
    tx = e.touches[0].clientX;
    ty = e.touches[0].clientY;
  }, { passive: true });
  wrap.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - tx;
    const dy = e.changedTouches[0].clientY - ty;
    // Only trigger if horizontal swipe is dominant
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
      dx < 0 ? goTo(current + 1) : goTo(current - 1);
    }
  }, { passive: true });

  // Mouse drag
  let mx = 0, dragging = false;
  wrap.addEventListener('mousedown', e => { mx = e.clientX; dragging = true; });
  wrap.addEventListener('mouseup', e => {
    if (!dragging) return; dragging = false;
    const dx = e.clientX - mx;
    if (Math.abs(dx) > 40) dx < 0 ? goTo(current + 1) : goTo(current - 1);
  });
  wrap.addEventListener('mouseleave', () => { dragging = false; });
}

document.addEventListener('DOMContentLoaded', initReelCarousel);
