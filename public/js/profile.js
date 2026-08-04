// Public artist profile — /artist/{slug}.
//
// The full artist page the link hub points at: a cover header with monthly
// listeners and a Follow control, popular tracks ranked by plays, the artist's
// own pick, discography split the way a DSP splits it, features, tour dates,
// an about panel with the ranking numbers, socials, and playlist placements.
// Same first-party tracking as the hub, so a profile view is measured too.

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { esc, fmt } from './ui.js';
import { socialRow, rollAll } from './icons.js';
import { SRC_NAME, ytThumb, playableArt, hydrateArt, dockMarkup, initDock } from './dock.js';
import { mountTeamBar } from './teambar.js';

const REST = `${SUPABASE_URL}/rest/v1`;
const HEADERS = {
  apikey: SUPABASE_ANON_KEY,
  authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  'content-type': 'application/json',
};

const sel = (table, query) =>
  fetch(`${REST}/${table}?${query}`, { headers: HEADERS })
    .then(r => (r.ok ? r.json() : []))
    .catch(() => []);

const rpc = fn =>
  fetch(`${REST}/rpc/${fn}`, { method: 'POST', headers: HEADERS, body: '{}' })
    .then(r => (r.ok ? r.json() : {}))
    .catch(() => ({}));

const isBot = () =>
  /bot|crawl|spider|preview|facebookexternalhit|whatsapp|telegram|slack|discord|twitter|linkedin|embed|headless|lighthouse|prerender/i
    .test(navigator.userAgent);

/* Same visitor id the hub page uses, kept in localStorage so a follow survives
   closing the tab. Storage can throw in private modes — never let that break
   the page. */
const sid = () => {
  let s = null;
  try { s = localStorage.getItem('hub-sid') || sessionStorage.getItem('hub-sid'); } catch {}
  if (!s) s = Math.random().toString(36).slice(2, 12);
  try { localStorage.setItem('hub-sid', s); } catch {}
  return s;
};

/* `page` separates profile traffic from hub traffic, and `item` names the
   release or track so the dashboard can count each one on its own. */
function track(artist, event, extra = {}) {
  if (isBot()) return;
  fetch(`${REST}/hub_events`, {
    method: 'POST', keepalive: true,
    headers: { ...HEADERS, prefer: 'return=minimal' },
    body: JSON.stringify({
      artist, event, session_id: sid(), page: 'profile',
      referrer: (document.referrer || '').slice(0, 300) || null,
      ua: navigator.userAgent.slice(0, 300), ...extra,
    }),
  }).catch(() => {});
}

const monthYear = d => new Date(d + 'T00:00:00')
  .toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export async function boot(slug) {
  document.documentElement.dataset.theme = 'dark';
  const view = document.getElementById('view');

  const [profile] = await sel('artist_profiles', `slug=eq.${encodeURIComponent(slug)}&select=*`);
  if (!profile) {
    view.innerHTML = `<div class="profile"><header class="pf-head"><h1>Not found</h1>
      <p class="muted">No artist lives at this address.</p></header></div>`;
    return;
  }
  const a = profile.artist;
  const enc = encodeURIComponent(a);

  const [links, releases, channels, tour, discovered, followerMap, catalog, reachMap] = await Promise.all([
    sel('hub_links', `artist=eq.${enc}&active=eq.true&order=sort_order`),
    sel('releases', `artist=eq.${enc}&order=year.desc`),
    sel('channels', `artist_name=eq.${enc}&select=*`),
    sel('tour_dates', `artist=eq.${enc}&order=event_date`),
    sel('discovered_on', `artist=eq.${enc}&order=sort_order`),
    rpc('follower_counts'),
    sel('catalog', 'select=*&order=views.desc'),
    rpc('artist_reach'),
  ]);
  const reach = reachMap[a];

  // Catalog rows carry short artist tags, not full names.
  const TAG = { BREED: 'breed', 'King Konnect': 'king', JayThaRealist: 'jay', Yawitazah: 'zah' }[a];
  const mine = TAG ? catalog.filter(t => (t.artists || []).includes(TAG)) : [];
  const popular = mine.slice(0, 10);

  const subs = channels.reduce((s, c) => s + (c.subs || 0), 0);
  const listeners = profile.monthly_listeners;
  const followers = followerMap[a] || 0;

  const own = releases.filter(r => r.kind !== 'feature');
  const albums = own.filter(r => /album/i.test(r.kind || ''));
  const singles = own.filter(r => /single|ep/i.test(r.kind || ''));
  const otherOwn = own.filter(r => !albums.includes(r) && !singles.includes(r));
  const feats = releases.filter(r => r.kind === 'feature');
  const pick = releases.find(r => r.id === profile.pick_release_id) || own[0];

  /* Every button goes straight out to the platform the fan chose. Playing
     without leaving happens on the artwork instead, in the dock below. */
  const dsp = (r, label, url) => url
    ? `<a class="pf-dsp" href="${esc(url)}" target="_blank" rel="noopener"
         data-item="${esc(r.title)}" data-label="${esc(`${r.title} · ${label}`)}">${label}</a>`
    : '';

  const releaseCard = r => `
    <article class="pf-rel">
      ${playableArt(r)}
      <h4>${esc(r.title)}</h4>
      <p class="muted sm">${r.year || ''}${r.kind ? ' · ' + esc(r.kind) : ''}</p>
      <div class="pf-dsps">${dsp(r, 'Spotify', r.spotify_url)}${dsp(r, 'Apple', r.apple_url)}${dsp(r, 'YouTube', r.youtube_url)}</div>
    </article>`;

  const shelf = (title, rows) => !rows.length ? '' : `
    <section class="pf-section">
      <h2>${esc(title)}</h2>
      <div class="pf-grid">${rows.map(releaseCard).join('')}</div>
    </section>`;

  view.innerHTML = `
<div class="profile">
  <header class="pf-head">
    ${profile.image_url ? `<img class="pf-cover" src="${esc(profile.image_url)}" alt="" aria-hidden="true">` : ''}
    <div class="pf-head-body">
      <span class="pf-verified">Tha Remnant Music Group</span>
      <h1>${esc(a)}</h1>
      <p class="pf-stats">
        ${listeners ? `<strong data-roll="${listeners}">${fmt(listeners)}</strong> monthly listeners` : ''}
        ${subs ? `${listeners ? ' · ' : ''}<strong data-roll="${subs}">${fmt(subs)}</strong> subscribers` : ''}
        <span id="pf-followers">${followers ? ` · <strong>${fmt(followers)}</strong> followers` : ''}</span>
      </p>
      <div class="pf-actions">
        <button class="btn pf-follow" id="pf-follow" type="button">Follow</button>
        <a class="btn ghost" href="/a/${esc(slug)}">All links</a>
      </div>
      ${socialRow(links.map(l => ({ label: l.label, url: l.url, id: l.id })),
        { size: 20, cls: 'social-row social-row-hero' })}
    </div>
  </header>

  ${popular.length ? `
  <section class="pf-section">
    <h2>Popular</h2>
    <ol class="pf-tracks">
      ${popular.map((t, i) => `
        <li>
          <span class="pf-rank">${i + 1}</span>
          <button class="pf-track" type="button"
             data-src="youtube" data-ref="${esc(t.video_id)}" data-title="${esc(t.title)}"
             data-credit="${esc(t.credit || '')}" data-item="${esc(t.title)}">
            <img src="${esc(ytThumb(t.video_id))}" alt="" loading="lazy">
            <span class="pf-track-t">${esc(t.title)}<small>${esc(t.credit || '')}</small></span>
            <span class="pf-plays">${fmt(t.views)}</span>
            <span class="pf-play-ic" aria-hidden="true">▶</span>
          </button>
        </li>`).join('')}
    </ol>
  </section>` : ''}

  ${pick ? `
  <section class="pf-section pf-pick">
    <h2>Artist pick</h2>
    <div class="pf-pick-body">
      ${playableArt(pick)}
      <div>
        <h3>${esc(pick.title)}</h3>
        <p class="muted sm">${esc(profile.pick_note || `${pick.kind || 'release'}${pick.year ? ' · ' + pick.year : ''}`)}</p>
        <div class="pf-dsps">${dsp(pick, 'Spotify', pick.spotify_url)}${dsp(pick, 'Apple', pick.apple_url)}${dsp(pick, 'YouTube', pick.youtube_url)}</div>
      </div>
    </div>
  </section>` : ''}

  ${shelf('Albums', albums)}
  ${shelf('Singles and EPs', singles)}
  ${shelf('More releases', otherOwn)}
  ${shelf('Featuring ' + a, feats)}

  ${tour.length ? `
  <section class="pf-section">
    <h2>On tour</h2>
    <ul class="pf-tour">
      ${tour.map(t => `
        <li>
          <span class="pf-date">${esc(monthYear(t.event_date))}</span>
          <span class="pf-where"><strong>${esc(t.city)}</strong>${t.venue ? `<small>${esc(t.venue)}</small>` : ''}</span>
          ${t.sold_out
            ? '<span class="badge p-mute">Sold out</span>'
            : t.ticket_url ? `<a class="btn sm" href="${esc(t.ticket_url)}" target="_blank" rel="noopener"
                 data-label="${esc('Tickets · ' + t.city)}">Tickets</a>` : ''}
        </li>`).join('')}
    </ul>
  </section>` : ''}

  <section class="pf-section pf-about">
    <h2>About</h2>
    <div class="pf-about-body">
      ${profile.image_url ? `<img src="${esc(profile.image_url)}" alt="${esc(a)}" loading="lazy">` : ''}
      <div>
        ${reach ? `
          <p class="pf-about-stat"><strong data-roll="${reach.reach}">${fmt(reach.reach)}</strong> combined reach</p>
          <p class="muted sm">Number ${reach.rank} of ${reach.of} on the roster, counted across
          ${reach.platforms.length} platform${reach.platforms.length === 1 ? '' : 's'}.</p>
          <ul class="pf-reach">
            ${reach.platforms.map(p => `<li><span>${esc(p.platform)}</span>
              <strong>${fmt(p.value)}</strong> <small>${esc(p.metric || '')}</small></li>`).join('')}
          </ul>` : ''}
        ${listeners ? `<p class="muted sm">${fmt(listeners)} monthly listeners on Spotify.</p>` : ''}
        ${profile.world_rank ? `<p class="muted sm">${esc(profile.world_rank)}</p>` : ''}
        ${profile.hometown_rank ? `<p class="muted sm">${esc(profile.hometown_rank)}</p>` : ''}
        ${profile.tagline ? `<p class="pf-tagline">${esc(profile.tagline)}</p>` : ''}
        ${profile.bio ? `<p>${esc(profile.bio)}</p>` : ''}
        ${profile.role ? `<p class="muted sm">${esc(profile.role)}${profile.hometown ? ' · ' + esc(profile.hometown) : ''}</p>` : ''}
      </div>
    </div>
  </section>

  ${discovered.length ? `
  <section class="pf-section">
    <h2>Discovered on</h2>
    <div class="pf-grid">
      ${discovered.map(d => `
        <a class="pf-rel" href="${esc(d.url || '#')}" target="_blank" rel="noopener"
           data-label="${esc('Discovered · ' + d.name)}">
          <div class="pf-rel-art">${d.image_url
            ? `<img src="${esc(d.image_url)}" alt="" loading="lazy">`
            : `<span class="pf-rel-ph">♫</span>`}</div>
          <h4>${esc(d.name)}</h4>
          <p class="muted sm">${d.followers ? fmt(d.followers) + ' followers' : esc(d.curator || '')}</p>
        </a>`).join('')}
    </div>
  </section>` : ''}

  <footer class="hub-foot">
    <img src="/img/logo-mark-180.png" alt="">
    <span>Tha Remnant Music Group</span>
    <a class="powered" href="https://zahbrandsolutions.com" target="_blank" rel="noopener"
       data-label="Powered by Zah Brand Solutions">Powered by Zah Brand Solutions</a>
  </footer>
</div>

${dockMarkup()}`;

  rollAll(view);

  const seen = `pf-seen-${slug}`;
  if (!sessionStorage.getItem(seen)) { sessionStorage.setItem(seen, '1'); track(a, 'view'); }

  hydrateArt(view);
  mountTeamBar({ artist: a, slug, here: 'profile' });

  const { play } = initDock();

  /* Playing is recorded as a play and leaving for a platform as a click, so
     the two never get averaged into one meaningless number. */
  view.addEventListener('click', e => {
    const playBtn = e.target.closest('[data-src][data-ref]');
    if (playBtn) {
      const { src, ref, title, credit, item } = playBtn.dataset;
      const opened = play(src, ref, title, credit);
      track(a, opened ? 'play' : 'click', {
        item: item || title || null,
        label: `${title || item} · ${SRC_NAME[src] || src}`,
      });
      return;
    }
    const link = e.target.closest('[data-link-id]');
    if (link) return track(a, 'click', { link_id: +link.dataset.linkId });
    const labelled = e.target.closest('[data-label]');
    if (labelled) track(a, 'click', { label: labelled.dataset.label, item: labelled.dataset.item || null });
  });

  /* Follow is anonymous — keyed to this browser, so it survives a refresh and
     can be undone without an account. */
  const btn = document.getElementById('pf-follow');
  const followKey = `pf-follow-${a}`;
  const isFollowing = () => {
    try { return localStorage.getItem(followKey) === '1'; } catch { return false; }
  };
  const paint = on => {
    btn.textContent = on ? 'Following' : 'Follow';
    btn.classList.toggle('on', on);
  };
  paint(isFollowing());

  btn.addEventListener('click', async () => {
    const on = isFollowing();
    btn.disabled = true;
    try {
      if (on) {
        // Via RPC, not a raw DELETE: filtering rows needs SELECT, and the
        // follow list is team-only by design.
        await fetch(`${REST}/rpc/unfollow`, {
          method: 'POST', headers: HEADERS,
          body: JSON.stringify({ p_artist: a, p_session: sid() }),
        });
        try { localStorage.removeItem(followKey); } catch {}
      } else {
        // Plain insert, not an upsert: an upsert is ON CONFLICT DO UPDATE,
        // which would need anon UPDATE rights on the table. A repeat follow
        // just collides with the unique key, and that is already success.
        const res = await fetch(`${REST}/artist_follows`, {
          method: 'POST',
          headers: { ...HEADERS, prefer: 'return=minimal' },
          body: JSON.stringify({ artist: a, session_id: sid() }),
        });
        if (!res.ok && res.status !== 409) throw new Error('follow failed');
        try { localStorage.setItem(followKey, '1'); } catch {}
        track(a, 'click', { label: 'Follow' });
      }
      paint(!on);
      const counts = await rpc('follower_counts');
      const n = counts[a] || 0;
      document.getElementById('pf-followers').innerHTML =
        n ? ` · <strong>${fmt(n)}</strong> followers` : '';
    } finally { btn.disabled = false; }
  });
}
