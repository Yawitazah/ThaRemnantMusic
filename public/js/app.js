// App shell: auth, routing, tab rendering.

import { sb, store, loadAll, isAdmin, catalogStats } from './data.js';
import { $, toast, hideTip } from './ui.js';

import * as diagnosis from './tabs/diagnosis.js';
import * as roster    from './tabs/roster.js';
import * as player    from './tabs/player.js';
import * as catalog   from './tabs/catalog.js';
import * as ledger    from './tabs/ledger.js';
import * as playbook  from './tabs/playbook.js';
import * as opps      from './tabs/opps.js';
import * as budget    from './tabs/budget.js';
import * as tracker   from './tabs/tracker.js';

const TABS = { diagnosis, roster, player, catalog, ledger, playbook, opps, budget, tracker };

let currentTab = location.hash.slice(1) || 'diagnosis';
if (!TABS[currentTab]) currentTab = 'diagnosis';

/* ---------- rendering ---------- */

function draw() {
  const view = $('#view');
  const mod = TABS[currentTab];
  view.innerHTML = mod.render();
  window.scrollTo({ top: 0, behavior: 'instant' });
  mod.bind?.(view, draw);

  document.querySelectorAll('.tab').forEach(t =>
    t.classList.toggle('is-active', t.dataset.t === currentTab));
  history.replaceState(null, '', '#' + currentTab);
}

function setMode() {
  const admin = isAdmin();
  $('#mode-banner').hidden = !admin;
  const btn = $('#auth-btn');
  btn.textContent = admin ? `Sign out (${store.session.user.email})` : 'Sign in to edit';
  btn.classList.toggle('ghost', admin);
}

/* ---------- boot ---------- */

async function boot() {
  const syncEl = $('#sync-state');
  try {
    const { data } = await sb.auth.getSession();
    store.session = data.session;

    await loadAll();

    syncEl.textContent = 'live';
    syncEl.classList.add('ok');
    const s = catalogStats();
    $('#foot-counts').textContent =
      `${s.total} tracks · ${store.playbook.length} playbook items · ${store.opps.length} opportunities`;

    setMode();
    draw();
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

document.querySelector('.tabs').addEventListener('click', e => {
  const t = e.target.closest('.tab');
  if (!t || t.dataset.t === currentTab) return;
  currentTab = t.dataset.t;
  draw();
});

window.addEventListener('hashchange', () => {
  const h = location.hash.slice(1);
  if (TABS[h] && h !== currentTab) { currentTab = h; draw(); }
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

// Auth
const dlg = $('#auth-dlg');
$('#auth-btn').addEventListener('click', async () => {
  if (isAdmin()) {
    await sb.auth.signOut();
    store.session = null;
    setMode();
    draw();
    toast('Signed out — read-only');
    return;
  }
  $('#auth-err').hidden = true;
  dlg.showModal();
});

$('#auth-form').addEventListener('submit', async e => {
  const ok = e.submitter?.value === 'ok';
  if (!ok) return;
  e.preventDefault();

  const email = $('#auth-email').value.trim();
  const password = $('#auth-pass').value;
  const errEl = $('#auth-err');
  errEl.hidden = true;

  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    errEl.textContent = error.message;
    errEl.hidden = false;
    return;
  }
  store.session = data.session;
  $('#auth-pass').value = '';
  dlg.close();
  setMode();
  draw();
  toast('Signed in — you can edit');
});

boot();
