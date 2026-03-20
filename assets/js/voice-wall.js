/**
 * voice-wall.js
 * Anonymous student input — shared public board powered by Supabase.
 *
 * ╔══════════════════════════════════════════════════════════╗
 * ║  SETUP: replace the two constants below with your own   ║
 * ║  Supabase project values before deploying.              ║
 * ║  See SUPABASE_SETUP.md in this repo for full steps.     ║
 * ╚══════════════════════════════════════════════════════════╝
 */

// ── ⚙️  CONFIG — fill these in after creating your Supabase project ──────────
const SUPABASE_URL    = 'https://zmcmttvfigrbfmopehsy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptY210dHZmaWdyYmZtb3BlaHN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NTU1NTAsImV4cCI6MjA4OTUzMTU1MH0.uRUFXySs5UHxUT0HDzS5EqcgEnDXbc6dh9R0u4ib3pg';
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  'use strict';

  // ── Profanity filter ────────────────────────────────────────────────────────
  // Add / remove words as needed. Stored client-side; not a security boundary —
  // the Supabase Row Level Security policy is the real gate.
  const BLOCKED_WORDS = [
    'fuck','shit','ass','bitch','cunt','dick','cock','pussy','nigger','nigga',
    'faggot','fag','retard','whore','slut','bastard','damn','crap','piss',
    'asshole','motherfucker','bullshit','jackass'
  ];

  // Build a single regex: whole-word, case-insensitive
  const profanityRE = new RegExp(
    '\\b(' + BLOCKED_WORDS.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\b',
    'i'
  );

  function containsProfanity(str) {
    return profanityRE.test(str);
  }

  // ── Category labels ─────────────────────────────────────────────────────────
  const categoryLabels = {
    budget:       '💰 Budget & Spending',
    clubs:        '🎓 Club Funding',
    transparency: '📋 Transparency',
    campus:       '🏫 Campus Life',
    other:        '💬 Other'
  };

  // ── Supabase client (CDN version loaded in index.html) ──────────────────────
  let sb = null;

  function getClient() {
    if (sb) return sb;
    // supabase-js v2 loaded via CDN exposes window.supabase
    if (window.supabase && window.supabase.createClient) {
      sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return sb;
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function timeAgo(isoString) {
    const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
    if (diff < 60)     return 'just now';
    if (diff < 3600)   return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400)  return Math.floor(diff / 3600) + 'h ago';
    if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
    return new Date(isoString).toLocaleDateString();
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.appendChild(document.createTextNode(str));
    return d.innerHTML;
  }

  function setWallState(state) {
    // state: 'loading' | 'empty' | 'error' | 'messages'
    const wall  = document.getElementById('message-wall');
    const empty = document.getElementById('wall-empty');
    if (!wall || !empty) return;

    empty.style.display = 'none';
    wall.innerHTML = '';

    if (state === 'loading') {
      wall.innerHTML = '<p class="wall-empty-state">Loading messages…</p>';
    } else if (state === 'empty') {
      empty.style.display = 'block';
    } else if (state === 'error') {
      wall.innerHTML = '<p class="wall-empty-state" style="color:#f09040;">Could not load messages. Check your Supabase config.</p>';
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  function renderMessages(rows) {
    const wall  = document.getElementById('message-wall');
    const empty = document.getElementById('wall-empty');
    if (!wall) return;

    if (!rows || rows.length === 0) {
      wall.innerHTML = '';
      empty.style.display = 'block';
      return;
    }

    empty.style.display = 'none';
    wall.innerHTML = rows.map((m, i) => `
      <div class="msg-bubble" data-id="${escapeHtml(String(m.id))}">
        <div class="msg-meta">
          <span class="msg-category">${escapeHtml(categoryLabels[m.category] || '💬 Other')}</span>
          <span class="msg-time">${timeAgo(m.created_at)}</span>
        </div>
        <div class="msg-text">${escapeHtml(m.text)}</div>
      </div>
    `).join('');
  }

  // ── Fetch from Supabase ─────────────────────────────────────────────────────

  async function fetchMessages() {
    const client = getClient();
    if (!client) { setWallState('error'); return; }

    setWallState('loading');

    const { data, error } = await client
      .from('voice_messages')
      .select('id, text, category, created_at')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) { console.error('Supabase fetch error:', error); setWallState('error'); return; }
    renderMessages(data);
  }

  // ── Real-time subscription ──────────────────────────────────────────────────

  function subscribeRealtime() {
    const client = getClient();
    if (!client) return;

    client
      .channel('voice_messages_channel')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'voice_messages' },
        () => fetchMessages()   // re-fetch on any new insert
      )
      .subscribe();
  }

  // ── Submit to Supabase ──────────────────────────────────────────────────────

  async function submitMessage(text, category) {
    const client = getClient();
    if (!client) throw new Error('Supabase client not initialised');

    const { error } = await client
      .from('voice_messages')
      .insert([{ text, category }]);

    if (error) throw error;
  }

  // ── Form setup ──────────────────────────────────────────────────────────────

  function setupForm() {
    const textarea   = document.getElementById('voice-message');
    const charSpan   = document.getElementById('char-remaining');
    const submitBtn  = document.getElementById('voice-submit');
    const categoryEl = document.getElementById('voice-category');
    if (!textarea || !submitBtn) return;

    // Character counter
    textarea.addEventListener('input', function () {
      const rem = 280 - this.value.length;
      charSpan.textContent = rem;
      charSpan.style.color = rem < 30 ? '#f09040' : '';
    });

    // Submit handler
    submitBtn.addEventListener('click', async function () {
      const text = textarea.value.trim();

      // Validation
      if (!text) {
        textarea.focus();
        textarea.style.borderColor = '#f06060';
        setTimeout(() => { textarea.style.borderColor = ''; }, 1500);
        return;
      }

      // Profanity check
      if (containsProfanity(text)) {
        showFormError('Please keep messages respectful — profanity isn\'t allowed.');
        return;
      }

      const category = categoryEl ? categoryEl.value : 'other';

      // Disable button while submitting
      const origText = submitBtn.textContent;
      submitBtn.textContent = 'Submitting…';
      submitBtn.disabled = true;
      submitBtn.classList.add('disabled');

      try {
        await submitMessage(text, category);

        // Reset form
        textarea.value = '';
        charSpan.textContent = '280';
        if (categoryEl) categoryEl.selectedIndex = 0;
        clearFormError();

        // Success flash
        submitBtn.textContent = '✓ Message posted!';
        setTimeout(() => {
          submitBtn.textContent = origText;
          submitBtn.disabled = false;
          submitBtn.classList.remove('disabled');
        }, 2500);

        // Scroll to wall
        const wall = document.getElementById('message-wall');
        if (wall) setTimeout(() => wall.scrollIntoView({ behavior: 'smooth', block: 'start' }), 400);

      } catch (err) {
        console.error('Submit error:', err);
        showFormError('Something went wrong. Please try again.');
        submitBtn.textContent = origText;
        submitBtn.disabled = false;
        submitBtn.classList.remove('disabled');
      }
    });

    // Enter submits, Shift+Enter makes a new line
    textarea.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submitBtn.click();
      }
    });
  }

  // ── Error display ───────────────────────────────────────────────────────────

  function showFormError(msg) {
    let el = document.getElementById('voice-form-error');
    if (!el) {
      el = document.createElement('p');
      el.id = 'voice-form-error';
      el.setAttribute('style', 'color:#cc0000 !important;font-size:0.85rem;font-weight:600;margin-top:0.6rem;');
      const btn = document.getElementById('voice-submit');
      if (btn && btn.parentNode) btn.parentNode.insertAdjacentElement('afterend', el);
    }
    el.textContent = '⚠ ' + msg;
  }

  function clearFormError() {
    const el = document.getElementById('voice-form-error');
    if (el) el.textContent = '';
  }

  // ── Init ────────────────────────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', function () {
    fetchMessages();
    subscribeRealtime();
    setupForm();

    // Refresh time-ago labels every 60 s
    setInterval(fetchMessages, 60000);
  });

})();