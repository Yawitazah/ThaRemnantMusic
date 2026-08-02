// App shell: routing and tab rendering. Read-only — data is maintained through Claude.

import { store, loadAll, catalogStats } from './data.js';
import { $, toast, hideTip } from './ui.js';

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

let currentTab = location.hash.slice(1) || 'now';
if (!TABS[currentTab]) currentTab = 'now';

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

/* ---------- boot ---------- */

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

boot();
