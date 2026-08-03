// Public artist link hub — /a/{slug}.
//
// A fan-facing page: portrait, the artist's links as big tracked buttons, the
// discography, and an email capture that lands in Zah CRM. Loads nothing from
// the dashboard shell and talks to Supabase over plain REST so the page stays
// light. Every view and button press is recorded in hub_events; the dashboard
// reads the aggregates back through hub_summary().

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { esc, fmt } from './ui.js';

const REST = `${SUPABASE_URL}/rest/v1`;
const HEADERS = {
  apikey: SUPABASE_ANON_KEY,
  authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  'content-type': 'application/json',
};

const sel = (table, query) =>
  fetch(`${REST}/${table}?${query}`, { headers: HEADERS }).then(r => {
    if (!r.ok) throw new Error(`${table}: HTTP ${r.status}`);
    return r.json();
  });

/* Link previews and crawlers hit hub URLs constantly once they are shared;
   none of that is a fan. Same idea as Zah CRM's tracked-link bot filter. */
const isBot = () =>
  /bot|crawl|spider|preview|facebookexternalhit|whatsapp|telegram|slack|discord|twitter|linkedin|skype|pinterest|embed|headless|lighthouse|vercel|prerender/i
    .test(navigator.userAgent);

const sid = () => {
  let s = sessionStorage.getItem('hub-sid');
  if (!s) { s = Math.random().toString(36).slice(2, 12); sessionStorage.setItem('hub-sid', s); }
  return s;
};

function track(artist, event, extra = {}) {
  if (isBot()) return;
  const row = {
    artist, event, session_id: sid(),
    referrer: (document.referrer || '').slice(0, 300) || null,
    ua: navigator.userAgent.slice(0, 300),
    ...extra,
  };
  // keepalive so a click that navigates away still lands.
  fetch(`${REST}/hub_events`, {
    method: 'POST', keepalive: true,
    headers: { ...HEADERS, prefer: 'return=minimal' },
    body: JSON.stringify(row),
  }).catch(() => {});
}

const ICONS = {
  youtube: 'YT', spotify: 'SP', 'apple music': 'AM', instagram: 'IG',
  tiktok: 'TT', 'x / twitter': 'X', website: 'WWW', 'last.fm': 'FM',
};
const iconFor = label => ICONS[(label || '').toLowerCase()] || '↗';

export async function boot(slug) {
  document.documentElement.dataset.theme = 'dark';   // hubs are a brand surface
  const view = document.getElementById('view');

  let profile;
  try {
    const profiles = await sel('artist_profiles', `slug=eq.${encodeURIComponent(slug)}&select=*`);
    profile = profiles[0];
  } catch {
    view.innerHTML = '<div class="loading">Could not load this page. Try again in a minute.</div>';
    return;
  }
  if (!profile) {
    view.innerHTML = `<div class="hub"><div class="hub-head"><h1>Not found</h1>
      <p class="muted">No artist lives at this address.</p></div></div>`;
    return;
  }

  const a = profile.artist;
  const [links, releases, channels] = await Promise.all([
    sel('hub_links', `artist=eq.${encodeURIComponent(a)}&active=eq.true&order=sort_order`),
    sel('releases', `artist=eq.${encodeURIComponent(a)}&order=sort_order`).catch(() => []),
    sel('channels', `artist_name=eq.${encodeURIComponent(a)}&select=*`).catch(() => []),
  ]);

  const subs = channels.reduce((s, c) => s + (c.subs || 0), 0);
  const own = releases.filter(r => r.kind !== 'feature');
  const feats = releases.filter(r => r.kind === 'feature');

  const dsp = (r, platform, url) => url
    ? `<a class="hub-dsp" href="${esc(url)}" target="_blank" rel="noopener"
         data-label="${esc(`${r.title} · ${platform}`)}">${platform}</a>` : '';

  const releaseRow = r => `
    <li class="hub-release">
      <div>
        <strong>${esc(r.title)}</strong>
        <span class="muted sm">${esc(r.kind || '')}${r.year ? ' · ' + r.year : ''}${
          r.credited_to ? ' · ' + esc(r.credited_to) : ''}</span>
      </div>
      <div class="hub-dsps">${dsp(r, 'Spotify', r.spotify_url)}${dsp(r, 'Apple', r.apple_url)}${dsp(r, 'YouTube', r.youtube_url)}</div>
    </li>`;

  view.innerHTML = `
<div class="hub">
  <header class="hub-head">
    <div class="hub-portrait">
      ${profile.image_url
        ? `<img src="${esc(profile.image_url)}" alt="${esc(a)}">`
        : profile.image_video_id
          ? `<img src="https://i.ytimg.com/vi/${esc(profile.image_video_id)}/maxresdefault.jpg" alt="${esc(a)}"
               onerror="this.onerror=null;this.src='https://i.ytimg.com/vi/${esc(profile.image_video_id)}/hqdefault.jpg'">`
          : ''}
    </div>
    <h1>${esc(a)}</h1>
    <p class="hub-role">${esc(profile.role || '')}</p>
    ${profile.tagline ? `<p class="hub-tagline">${esc(profile.tagline)}</p>` : ''}
    ${subs ? `<p class="hub-subs">${fmt(subs)} subscribers</p>` : ''}
  </header>

  <nav class="hub-links">
    ${links.map(l => `
      <a class="hub-btn" href="${esc(l.url)}" target="_blank" rel="noopener" data-link-id="${l.id}">
        <span class="hub-ic">${esc(iconFor(l.label))}</span>
        <span>${esc(l.label)}${l.note ? `<small>${esc(l.note)}</small>` : ''}</span>
        <span class="hub-arrow">→</span>
      </a>`).join('')}
  </nav>

  <section class="hub-capture" id="hub-capture">
    <h2>Stay in the loop</h2>
    <p class="muted sm">New drops, videos and shows from ${esc(a)}. No spam.</p>
    <form id="capture-form">
      <input type="text" name="name" placeholder="Name (optional)" autocomplete="name">
      <input type="email" name="email" placeholder="Email" required autocomplete="email">
      <button class="btn" type="submit">Join the list</button>
    </form>
    <p class="hub-capture-done" hidden>You're on the list. Welcome in.</p>
  </section>

  ${releases.length ? `
  <section class="hub-disco">
    <h2>Music</h2>
    ${own.length ? `<ul>${own.map(releaseRow).join('')}</ul>` : ''}
    ${feats.length ? `<h3>Featured on</h3><ul>${feats.map(releaseRow).join('')}</ul>` : ''}
  </section>` : ''}

  <footer class="hub-foot">
    <img src="/img/logo-mark-180.png" alt="">
    <span>Tha Remnant Music Group</span>
  </footer>
</div>`;

  /* One view per session per artist — views read as people, not refreshes. */
  const seenKey = `hub-seen-${slug}`;
  if (!sessionStorage.getItem(seenKey)) {
    sessionStorage.setItem(seenKey, '1');
    track(a, 'view');
  }

  view.addEventListener('click', e => {
    const btn = e.target.closest('.hub-btn');
    if (btn) { track(a, 'click', { link_id: +btn.dataset.linkId }); return; }
    const dspBtn = e.target.closest('.hub-dsp');
    if (dspBtn) track(a, 'click', { label: dspBtn.dataset.label });
  });

  const form = document.getElementById('capture-form');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = form.querySelector('button');
    btn.disabled = true; btn.textContent = 'Joining…';
    try {
      const r = await fetch('/api/capture', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          artist: a,
          name: form.name.value.trim(),
          email: form.email.value.trim(),
        }),
      });
      if (!r.ok) throw new Error('capture failed');
      track(a, 'capture');
      form.hidden = true;
      document.querySelector('.hub-capture-done').hidden = false;
    } catch {
      btn.disabled = false; btn.textContent = 'Join the list';
      alert('That did not go through. Please try again.');
    }
  });
}
