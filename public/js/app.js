// App shell: routing, tab rendering, hub-activity bell, team sign-in.

import { store, loadAll, catalogStats, sb, initSession, signIn, signOut, isAdmin } from './data.js';
import { $, toast, hideTip, esc } from './ui.js';

import * as now       from './tabs/now.js';
import * as artists   from './tabs/artists.js';
import * as executive from './tabs/executive.js';
import * as diagnosis from './tabs/diagnosis.js';
import * as roster    from './tabs/roster.js';
import * as platforms from './tabs/platforms.js';
import * as player    from './tabs/player.js';
import * as catalog   from './tabs/catalog.js';
import * as ledger    from './tabs/ledger.js';
import * as playbook  from './tabs/playbook.js';
import * as opps      from './tabs/opps.js';
import * as budget    from './tabs/budget.js';
import * as tracker   from './tabs/tracker.js';

const TABS = { now, artists, executive, diagnosis, roster, platforms, player, catalog, ledger, playbook, opps, budget, tracker };

/* Routes look like #artists or #artists/BREED — the part after the slash is
   handed to the tab so a card on one page can open a specific record on another. */
const parseHash = () => {
  const [tab, ...rest] = location.hash.slice(1).split('/');
  return { tab: TABS[tab] ? tab : 'now', arg: rest.length ? decodeURIComponent(rest.join('/')) : null };
};

let { tab: currentTab, arg: currentArg } = parseHash();

/* ---------- rendering ---------- */

function draw() {
  const view = $('#view');
  const mod = TABS[currentTab];
  if (currentArg && mod.setArg) mod.setArg(currentArg);
  view.innerHTML = mod.render();
  window.scrollTo({ top: 0, behavior: 'instant' });
  mod.bind?.(view, draw);

  document.querySelectorAll('.tab').forEach(t =>
    t.classList.toggle('is-active', t.dataset.t === currentTab));
  // Keep the active tab centred in view — the bar scrolls horizontally on
  // phones. Set scrollLeft directly: scrollIntoView also scrolls the page.
  const bar = document.querySelector('.tabs');
  const act = bar?.querySelector('.tab.is-active');
  if (bar && act) bar.scrollLeft = act.offsetLeft - (bar.clientWidth - act.offsetWidth) / 2;
  history.replaceState(null, '', '#' + currentTab + (currentArg ? '/' + encodeURIComponent(currentArg) : ''));
}

/* ---------- boot ---------- */

/* ---------- hub-activity bell ---------- */

const LAST_SEEN_KEY = 'remnant-bell-seen';
const agoShort = iso => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 90) return 'now';
  if (s < 5400) return Math.round(s / 60) + 'm';
  if (s < 129600) return Math.round(s / 3600) + 'h';
  return Math.round(s / 86400) + 'd';
};

function renderBell() {
  const feed = store.hubRecent || [];
  const lastSeen = +(localStorage.getItem(LAST_SEEN_KEY) || 0);
  const unseen = feed.filter(r => new Date(r.at).getTime() > lastSeen).length;
  const count = $('#bell-count');
  count.textContent = unseen > 9 ? '9+' : String(unseen);
  count.hidden = unseen === 0;
  $('#bell-list').innerHTML = feed.length ? feed.slice(0, 20).map(r => `
    <li>
      <span class="badge ${r.event === 'capture' ? 'p-good' : r.event === 'click' ? 'p-info' : 'p-mute'}">${esc(r.event)}</span>
      <span><strong>${esc(r.artist)}</strong> · ${
        r.event === 'view' ? 'hub opened' : r.event === 'capture' ? 'new fan on the list' : esc(r.label || 'link')}</span>
      <span class="muted sm" style="margin-left:auto">${agoShort(r.at)}</span>
    </li>`).join('')
    : '<li class="muted sm" style="justify-content:center">No hub activity yet.</li>';
}

function initBell() {
  const btn = $('#bell-btn'), panel = $('#bell-panel');
  btn.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    if (!panel.hidden) renderBell();
  });
  $('#bell-clear').addEventListener('click', () => {
    localStorage.setItem(LAST_SEEN_KEY, String(Date.now()));
    renderBell();
  });
  document.addEventListener('click', e => {
    if (!panel.hidden && !panel.contains(e.target) && !btn.contains(e.target)) panel.hidden = true;
  });
  renderBell();
}

/* ---------- team sign-in (footer) ---------- */

function renderAuth() {
  const el = $('#foot-auth');
  if (store.session) {
    const who = store.session.user?.email || 'signed in';
    el.innerHTML = `<span class="muted">${esc(who)}${isAdmin() ? ' · admin' : store.myArtist ? ' · ' + esc(store.myArtist) : ''}</span>
      · <a href="#" id="auth-out">Sign out</a>`;
  } else {
    el.innerHTML = `<a href="#" id="auth-in">Team sign-in</a>`;
  }
}

function initAuth() {
  $('#foot-auth').addEventListener('click', async e => {
    if (e.target.id === 'auth-in') {
      e.preventDefault();
      const email = prompt('Team email (you get a one-tap sign-in link):');
      if (!email) return;
      try {
        await signIn(email.trim());
        toast('Check your email for the sign-in link');
      } catch (err) { toast(err.message, 'err'); }
    }
    if (e.target.id === 'auth-out') {
      e.preventDefault();
      await signOut();
      renderAuth(); draw();
      toast('Signed out');
    }
  });
  sb.auth.onAuthStateChange(async (_ev, session) => {
    const had = !!store.session;
    store.session = session;
    if (!!session !== had) {
      await initSession();
      renderAuth(); draw();
    }
  });
  renderAuth();
}

async function boot() {
  const syncEl = $('#sync-state');
  try {
    await loadAll();

    syncEl.textContent = 'live';
    syncEl.classList.add('ok');
    const s = catalogStats();
    $('#foot-counts').textContent =
      `${s.total} tracks · ${store.playbook.length} playbook items · ${store.opps.length} opportunities`;

    draw();
    initBell();
    initAuth();
  } catch (err) {
    syncEl.textContent = 'offline';
    syncEl.classList.add('err');
    $('#view').innerHTML = `
      <section class="card">
        <h2>Could not reach the database</h2>
        <p class="err">${err.message}</p>
        <p class="muted sm">Check that the Supabase project is running and that
        <code>public/js/config.js</code> has the right URL and publishable key.</p>
        <button class="btn" onclick="location.reload()">Retry</button>
      </section>`;
  }
}

/* ---------- events ---------- */

function initDashboard() {
  document.querySelector('.tabs').addEventListener('click', e => {
    const t = e.target.closest('.tab');
    if (!t || (t.dataset.t === currentTab && !currentArg)) return;
    currentTab = t.dataset.t;
    currentArg = null;
    draw();
  });

  window.addEventListener('hashchange', () => {
    const { tab, arg } = parseHash();
    if (tab === currentTab && arg === currentArg) return;
    currentTab = tab; currentArg = arg;
    draw();
  });

  window.addEventListener('scroll', hideTip, { passive: true });

  // Theme
  const themeBtn = $('#theme-btn');
  const applyTheme = t => {
    document.documentElement.dataset.theme = t;
    themeBtn.textContent = t === 'light' ? 'Dark' : 'Light';
    try { localStorage.setItem('remnant-theme', t); } catch {}
  };
  applyTheme((() => { try { return localStorage.getItem('remnant-theme') || 'dark'; } catch { return 'dark'; } })());
  themeBtn.addEventListener('click', () => {
    applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
    draw(); // charts read CSS variables at render time
  });

  boot();
}

/* Public artist hubs (/a/{slug}) share this bundle but none of the dashboard
   chrome — they boot straight into the standalone hub page. */
const hubSlug = location.pathname.match(/^\/a\/([\w-]+)\/?$/)?.[1];
if (hubSlug) {
  document.body.classList.add('hub-mode');
  import('./hub.js')
    .then(m => m.boot(hubSlug.toLowerCase()))
    .catch(() => {
      $('#view').innerHTML = '<div class="loading">Could not load this page.</div>';
    });
} else {
  initDashboard();
}
