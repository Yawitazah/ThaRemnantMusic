// App shell: routing, tab rendering, hub-activity bell, team sign-in.

import { store, loadAll, catalogStats, sb, initSession, signOut, isAdmin, crmSsoUrl } from './data.js';
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
import * as fans      from './tabs/fans.js';
import * as team      from './tabs/team.js';

const TABS = { now, artists, executive, diagnosis, roster, platforms, player, catalog, ledger, playbook, opps, budget, tracker, fans, team };

/* Routes look like #artists or #artists/BREED — the part after the slash is
   handed to the tab so a card on one page can open a specific record on another. */
const parseHash = () => {
  const [tab, ...rest] = location.hash.slice(1).split('/');
  return { tab: TABS[tab] ? tab : 'now', arg: rest.length ? decodeURIComponent(rest.join('/')) : null };
};

let { tab: currentTab, arg: currentArg } = parseHash();

/* ---------- rendering ---------- */

function draw() {
  // Tabs attach their click handlers with mount.addEventListener, so the
  // mount must be a FRESH node every draw — reusing it stacks a new set of
  // listeners per render, and any toggle handler then fires N times per
  // click (an even N makes the button appear completely dead).
  const old = $('#view');
  const view = old.cloneNode(false);
  old.replaceWith(view);
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
  // The topbar links follow whichever artist is on screen, so they are
  // refreshed whenever the view changes.
  renderAccount();
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

  // Keep the feed live while the app is open — hub activity shows up on its
  // own, no refresh needed.
  setInterval(async () => {
    if (document.visibilityState !== 'visible') return;
    try {
      const { data } = await sb.rpc('hub_recent', { n: 40 });
      if (data) { store.hubRecent = data; renderBell(); }
    } catch { /* transient network issues are fine */ }
  }, 60_000);
}

/* ---------- account menu ----------
   Signing in used to be a dead end: there was a way in and a way out, and no
   way to move between the Command Center, an artist's own hub, their public
   page and the CRM. This is that menu. The Command Center and the CRM are
   team-only, so a fan who somehow lands here is never shown either. */

const slugFor = artist => {
  const p = (store.profiles || []).find(x => x.artist === artist);
  return p?.slug || String(artist || '').toLowerCase().replace(/\s+/g, '');
};

/** Artists this account may act on: everyone for an admin, itself for an artist. */
const myArtists = () => {
  if (isAdmin()) return (store.profiles || []).map(p => p.artist);
  return store.myArtist ? [store.myArtist] : [];
};

function renderAccount() {
  const btn = $('#acct-btn'), panel = $('#acct-panel'), avatar = $('#acct-avatar');
  if (!btn) return;

  const email = store.session?.user?.email || '';
  const who = store.myArtist || email;
  const role = isAdmin() ? 'Label admin' : store.myArtist ? 'Artist' : store.isTeam ? 'Team' : '';
  // Signed out there is no initial to show, and a question mark reads as an
  // error rather than an invitation.
  avatar.textContent = store.session ? (who.trim().charAt(0).toUpperCase() || '·') : '·';
  btn.classList.toggle('signed-in', !!store.session);

  const mine = myArtists();
  /* An admin's links follow whichever artist the Artists tab is showing, so the
     buttons stay generic and always point at whoever is on screen. An artist
     only ever has themselves. */
  const primary = store.myArtist
    || (mine.includes(artists.currentArtist()) ? artists.currentArtist() : mine[0]);

  // The two quick links in the bar itself, so the most common jumps are one
  // click and do not need the menu opened at all. Labels stay generic: naming
  // one artist made them read as if they only worked for that artist.
  const quickHub = $('#nav-hub'), quickPage = $('#nav-page');
  if (primary && store.isTeam) {
    quickHub.href = `/a/${slugFor(primary)}`;
    quickPage.href = `/artist/${slugFor(primary)}`;
    quickHub.hidden = quickPage.hidden = false;
    quickHub.title = `${primary} link hub`;
    quickPage.title = `${primary} artist page`;
  } else {
    quickHub.hidden = quickPage.hidden = true;
  }

  // The label page is public and meant to be shared, so it is offered to
  // everyone, signed in or not.
  const labelLink = `
    <a class="acct-item" href="/"><span class="acct-ic">◇</span>
      <span>Label page<small>The public page for fans. Share this one.</small></span></a>`;

  if (!store.session) {
    panel.innerHTML = `
      <div class="acct-head">
        <strong>Not signed in</strong>
        <span class="muted sm">Viewing the public dashboard.</span>
      </div>
      <div class="acct-group">
        ${labelLink}
        <a class="acct-item" href="/join"><span class="acct-ic">→</span>
          <span>Team sign in or join<small>Artists and label staff</small></span></a>
      </div>`;
    return;
  }

  const artistLinks = mine.map(name => `
    <div class="acct-artist">
      <span class="acct-artist-name">${esc(name)}</span>
      <span class="acct-artist-links">
        <a href="/a/${esc(slugFor(name))}">Link hub</a>
        <a href="/artist/${esc(slugFor(name))}">Artist page</a>
      </span>
    </div>`).join('');

  panel.innerHTML = `
    <div class="acct-head">
      <strong>${esc(who)}</strong>
      <span class="muted sm">${esc(email)}${role ? ' · ' + esc(role) : ''}</span>
    </div>

    <div class="acct-group">
      <span class="acct-label">Go to</span>
      <a class="acct-item is-here" href="/command"><span class="acct-ic">◆</span>
        <span>Command Center<small>You are here</small></span></a>
      ${labelLink}
      <a class="acct-item" id="acct-crm" href="${esc(crmSsoUrl())}" target="_blank" rel="noopener">
        <span class="acct-ic">◈</span>
        <span>ZAH CRM<small>Fans, campaigns and invoices. Opens signed in.</small></span></a>
    </div>

    ${artistLinks ? `<div class="acct-group">
      <span class="acct-label">${isAdmin() ? 'Public pages' : 'Your public pages'}</span>
      ${artistLinks}
    </div>` : ''}

    <div class="acct-group">
      <a class="acct-item" href="#" id="acct-out"><span class="acct-ic">×</span>
        <span>Sign out</span></a>
    </div>`;
}

function initAccount() {
  const btn = $('#acct-btn'), panel = $('#acct-panel');
  btn.addEventListener('click', () => {
    const open = panel.hidden;
    if (open) renderAccount();
    panel.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('click', e => {
    if (!panel.hidden && !panel.contains(e.target) && !btn.contains(e.target)) {
      panel.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
    }
  });
  panel.addEventListener('click', async e => {
    // The CRM link is built from the access token, which can refresh while the
    // menu sits open. Rebuild it at the moment of the click.
    if (e.target.closest('#acct-crm')) { e.target.closest('#acct-crm').href = crmSsoUrl(); return; }
    if (e.target.closest('#acct-out')) {
      e.preventDefault();
      await signOut();
      panel.hidden = true;
      renderAccount(); renderAuth(); draw();
      toast('Signed out');
    }
  });
  renderAccount();
}

/* Wipe every piece of state this device holds — stored session, service-worker
   caches, the registration itself — then reload. The escape hatch for a device
   stuck on a bad session or a stale offline copy. */
export async function hardReset() {
  try { await signOut(); } catch {}
  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch {}
  try {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
  } catch {}
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map(r => r.unregister()));
  } catch {}
  // Back to the page they were on, not "/" — that is the public label page now.
  location.replace(location.pathname + '?fresh=' + Date.now());
}

/* ---------- team sign-in (footer) ---------- */

function renderAuth() {
  const el = $('#foot-auth');
  if (store.session) {
    const who = store.session.user?.email || 'signed in';
    el.innerHTML = `<span class="muted">${esc(who)}${isAdmin() ? ' · admin' : store.myArtist ? ' · ' + esc(store.myArtist) : ''}</span>
      · <a href="#" id="auth-out">Sign out</a>`;
  } else {
    el.innerHTML = `<a href="/join">Team sign-in / join</a>`;
  }
  el.innerHTML += ` · <a href="#" id="auth-reset" title="Sign out, clear the offline copy and reload">Reset this device</a>`;
}

function initAuth() {
  $('#foot-auth').addEventListener('click', async e => {
    if (e.target.id === 'auth-out') {
      e.preventDefault();
      await signOut();
      renderAuth(); draw();
      toast('Signed out');
    }
    if (e.target.id === 'auth-reset') {
      e.preventDefault();
      toast('Resetting this device…');
      await hardReset();
    }
  });
  sb.auth.onAuthStateChange(async (_ev, session) => {
    const had = !!store.session;
    store.session = session;
    if (!!session !== had) {
      await initSession();
      renderAuth(); renderAccount(); draw();
    }
  });
  renderAuth();
}

async function boot() {
  const syncEl = $('#sync-state');
  try {
    await loadAll();

    // A partial load must announce itself — silently empty pages read as "the
    // app is broken" with no clue why.
    if (store.loadErrors?.length) {
      syncEl.textContent = `${store.loadErrors.length} failed`;
      syncEl.classList.add('err');
      syncEl.title = store.loadErrors.join('\n');
      console.warn('[data] failed to load:', store.loadErrors);
    } else {
      syncEl.textContent = 'live';
      syncEl.classList.add('ok');
    }
    const s = catalogStats();
    $('#foot-counts').textContent =
      `${s.total} tracks · ${store.playbook.length} playbook items · ${store.opps.length} opportunities`;

    draw();
    initBell();
    initAuth();
    initAccount();
  } catch (err) {
    syncEl.textContent = 'offline';
    syncEl.classList.add('err');
    $('#view').innerHTML = `
      <section class="card">
        <h2>Could not load the label data</h2>
        <p class="err">${esc(err.message)}</p>
        <p class="muted sm">If this keeps happening, reset this device — it signs you out,
        clears the offline copy and reloads fresh. Nothing on the server is touched.</p>
        <div class="row">
          <button class="btn" onclick="location.reload()">Retry</button>
          <button class="btn ghost" id="hard-reset" type="button">Reset this device</button>
        </div>
      </section>`;
    $('#hard-reset')?.addEventListener('click', hardReset);
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

/* Installable app shell. The service worker is what makes browsers offer
   "install"; it passes requests straight through otherwise. */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

/* Public artist hubs (/a/{slug}) and team onboarding (/join) share this bundle
   but none of the dashboard chrome — they boot straight into standalone pages.

   The dashboard answers ONE path, /command, and nothing else. Everything we do
   not recognise falls through to the public label page, so a stray URL on
   tharemnant.com shows fans the front door rather than the budget and ledger.
   / is the label page; /label still works for links already in the wild. */
const hubSlug = location.pathname.match(/^\/a\/([\w-]+)\/?$/)?.[1];
const profileSlug = location.pathname.match(/^\/artist\/([\w-]+)\/?$/)?.[1];
const isJoin = /^\/join\/?$/.test(location.pathname);
const isCommand = /^\/command\/?$/.test(location.pathname);
if (isCommand) {
  /* The Command Center is team-only. Chrome stays hidden behind `hub-mode` until
     the team check passes, so someone who just typed the URL never sees even the
     shape of the dashboard, and a slow or broken check fails CLOSED — the gate
     only stands down on an explicit true. RLS (migration 0013) is the other half;
     this alone would just be a screen over data anyone could still fetch. */
  document.body.classList.add('hub-mode');
  /* `?v=2` is a cache bust, not decoration. /js/gate.js was requested once before
     it existed, the old SPA fallback answered 200 + HTML with no cache header, and
     Cloudflare stored that HTML under the .js URL for four hours — so the import
     kept receiving HTML and the gate could not load. The query string is a
     different cache key, so this fetches clean. server.js reads url.pathname, so
     the query is ignored server-side. The fallback itself now 404s missing assets,
     which stops this happening again; bump the number if it ever recurs. */
  import('./gate.js?v=2')
    .then(m => m.requireTeam())
    .then(ok => {
      if (!ok) return;   // gate.js has painted the sign-in screen
      document.body.classList.remove('hub-mode');
      initDashboard();
    })
    .catch(() => {
      $('#view').innerHTML = '<div class="loading">Could not check this device. '
        + 'Reload to try again.</div>';
    });
} else {
  document.body.classList.add('hub-mode');
  const load = isJoin
    ? import('./join.js').then(m => m.boot())
    : profileSlug
      ? import('./profile.js').then(m => m.boot(profileSlug.toLowerCase()))
      : hubSlug
        ? import('./hub.js').then(m => m.boot(hubSlug.toLowerCase()))
        : import('./label.js').then(m => m.boot());
  load.catch(() => {
    $('#view').innerHTML = '<div class="loading">Could not load this page.</div>';
  });
}
