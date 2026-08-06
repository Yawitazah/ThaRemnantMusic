// Public artist link hub — /a/{slug}.
//
// A fan-facing page: portrait, the artist's links as big tracked buttons, the
// discography, and an email capture that lands in Zah CRM. Loads nothing from
// the dashboard shell and talks to Supabase over plain REST so the page stays
// light. Every view and button press is recorded in hub_events; the dashboard
// reads the aggregates back through hub_summary().

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { esc, fmt } from './ui.js';
import { socialRow, socialIcon, iconFor, isSocialLink, isListedLink, isStoreLink, isPlayableLink, rollAll } from './icons.js';
import { SRC_NAME, playableArt, playableFor, queueFrom, hydrateArt, dockMarkup, initDock } from './dock.js';
import { mountTeamBar } from './teambar.js';
import { wireShare } from './share.js';

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

/* One visitor id shared with the profile page (profile.js reads the same key),
   kept in localStorage so a follow survives closing the tab. */
const sid = () => {
  let s = null;
  try { s = localStorage.getItem('hub-sid') || sessionStorage.getItem('hub-sid'); } catch {}
  if (!s) s = Math.random().toString(36).slice(2, 12);
  try { localStorage.setItem('hub-sid', s); } catch {}
  return s;
};

function track(artist, event, extra = {}) {
  if (isBot()) return;
  const row = {
    artist, event, session_id: sid(), page: 'hub',
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


export async function boot(slug) {
  document.documentElement.dataset.theme = 'dark';   // hubs are a brand surface
  const view = document.getElementById('view');

  /* Hubs are not artists-only. Label staff get one too, so a slug that matches
     no artist is checked against team_members before giving up. Their row is
     reshaped into the same fields the rest of this page reads. */
  let profile;
  try {
    const profiles = await sel('artist_profiles', `slug=eq.${encodeURIComponent(slug)}&select=*`);
    profile = profiles[0];
    if (!profile) {
      const [member] = await sel('team_members',
        `slug=eq.${encodeURIComponent(slug)}&is_public=eq.true&select=*`).catch(() => []);
      if (member) {
        profile = {
          artist: member.name,
          role: member.title,
          tagline: member.short || null,
          bio: member.bio || null,
          image_url: member.image_url || null,
          image_video_id: null,
          is_team_member: true,
        };
      }
    }
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

  /* Icons at the top are for following. Everything else, and the store above
     all, gets a named button in the list where a visitor can actually read
     what it is. Stores are pulled to the front of that list. */
  const socials = links.filter(l => isSocialLink(l.label, l.url));
  const listed = links.filter(l => isListedLink(l.label, l.url))
    .sort((x, y) => (isStoreLink(y.label, y.url) ? 1 : 0) - (isStoreLink(x.label, x.url) ? 1 : 0));

  const dsp = (r, platform, url) => url
    ? `<a class="hub-dsp" href="${esc(url)}" target="_blank" rel="noopener"
         data-item="${esc(r.title)}" data-label="${esc(`${r.title} · ${platform}`)}">${platform}</a>` : '';

  /* The discography is a playlist: start on any record and the rest of that
     list keeps going behind it. */
  const playableOwn = own.filter(r => playableFor(r));
  const playableFeats = feats.filter(r => playableFor(r));
  const QUEUES = { own: queueFrom(playableOwn), feats: queueFrom(playableFeats) };

  /* Artwork plays in the dock, the platform buttons leave for the platform. */
  const releaseRow = (key, list) => r => `
    <li class="hub-release">
      ${playableArt(r, undefined, { queue: key, index: list.indexOf(r) })}
      <div class="hub-release-t">
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
    ${subs ? `<p class="hub-subs"><span data-roll="${subs}">${fmt(subs)}</span> subscribers</p>` : ''}
    ${socialRow(socials.map(l => ({ label: l.label, url: l.url, id: l.id })),
      { size: 20, cls: 'social-row social-row-hero' })}
    <!-- The artist's own link, handed out from their phone in two taps. -->
    <button class="hub-share" id="hub-share" type="button"
      data-share-url="/a/${esc(slug)}"
      data-share-title="${esc(a)} — all my links">
      <span class="share-label">Share my link</span>
    </button>
  </header>

  ${profile.is_team_member && profile.bio
    ? `<section class="hub-bio"><p>${esc(profile.bio)}</p></section>` : ''}

  <nav class="hub-links">
    ${profile.is_team_member ? `
    <a class="hub-btn hub-btn-primary" href="/">
      <span class="hub-ic">★</span>
      <span>Tha Remnant Music Group<small>The label, the artists, the music</small></span>
      <span class="hub-arrow">→</span>
    </a>` : `
    <a class="hub-btn hub-btn-primary" href="/artist/${esc(slug)}">
      <span class="hub-ic">★</span>
      <span>Artist profile<small>Popular tracks, releases, tour dates</small></span>
      <span class="hub-arrow">→</span>
    </a>`}
    ${listed.map(l => isPlayableLink(l.label, l.url) ? `
      <button class="hub-btn hub-btn-play" type="button"
         data-src="soundcloud" data-ref="${esc(l.url)}" data-title="${esc(l.label)}"
         data-credit="${esc(a)}" data-item="${esc(l.label)}" data-link-id="${l.id}">
        <span class="hub-ic">${socialIcon(iconFor(l.label, l.url), 18)}</span>
        <span>${esc(l.label)}<small>${esc(l.note || 'Play it here')}</small></span>
        <span class="hub-arrow" aria-hidden="true">▶</span>
      </button>` : `
      <a class="hub-btn ${isStoreLink(l.label, l.url) ? 'hub-btn-store' : ''}"
         href="${esc(l.url)}" target="_blank" rel="noopener" data-link-id="${l.id}">
        <span class="hub-ic">${socialIcon(iconFor(l.label, l.url), 18)}</span>
        <span>${esc(l.label)}${l.note ? `<small>${esc(l.note)}</small>`
          : isStoreLink(l.label, l.url) ? '<small>Merch and releases</small>' : ''}</span>
        <span class="hub-arrow">→</span>
      </a>`).join('')}
  </nav>

  ${releases.length ? `
  <section class="hub-disco">
    <h2>Music</h2>
    ${own.length ? `<ul>${own.map(releaseRow('own', playableOwn)).join('')}</ul>` : ''}
    ${feats.length ? `<h3>Featured on</h3><ul>${feats.map(releaseRow('feats', playableFeats)).join('')}</ul>` : ''}
  </section>` : ''}

  <section class="hub-capture" id="hub-capture">
    <h2>${profile.is_team_member ? 'Get in touch' : 'Stay in the loop'}</h2>
    <p class="muted sm">${profile.is_team_member
      ? `Leave your email and ${esc(a)} will get back to you.`
      : `New drops, videos and shows from ${esc(a)}. No spam.`}</p>
    <form id="capture-form">
      <input type="text" name="name" placeholder="Name (optional)" autocomplete="name">
      <input type="email" name="email" placeholder="Email" required autocomplete="email">
      <button class="btn" type="submit">${profile.is_team_member ? 'Send it' : 'Join the list'}</button>
    </form>
    <p class="hub-capture-done" hidden>${profile.is_team_member
      ? 'Got it. Expect a reply.' : "You're on the list. Welcome in."}</p>
  </section>

  <footer class="hub-foot">
    <img src="/img/logo-mark-180.png" alt="">
    <span>Tha Remnant Music Group</span>
    <a class="powered" href="https://zahbrandsolutions.com" target="_blank" rel="noopener"
       data-label="Powered by Zah Brand Solutions">Powered by Zah Brand Solutions</a>
  </footer>
</div>
${dockMarkup()}`;

  /* One view per session per artist — views read as people, not refreshes. */
  rollAll(view);

  const seenKey = `hub-seen-${slug}`;
  if (!sessionStorage.getItem(seenKey)) {
    sessionStorage.setItem(seenKey, '1');
    track(a, 'view');
  }

  hydrateArt(view);
  wireShare(view, url => track(a, 'click', { item: 'Share', label: `Share · ${url}` }));
  mountTeamBar({ artist: a, slug, here: 'hub' });

  /* Recorded from the player, so a track the queue started counts too. */
  const { play, setQueue } = initDock({
    onTrack: it => track(a, 'play', {
      item: it.item || it.title || null,
      label: `${it.title || it.item} · ${SRC_NAME[it.src] || it.src}`,
    }),
  });

  view.addEventListener('click', e => {
    const playBtn = e.target.closest('[data-src][data-ref]');
    if (playBtn) {
      const { src, ref, title, credit, item, queue, qi } = playBtn.dataset;
      const opened = queue && QUEUES[queue]?.length
        ? setQueue(QUEUES[queue], +qi)
        : play(src, ref, title, credit);
      if (!opened) {
        track(a, 'click', {
          item: item || title || null,
          label: `${title || item} · ${SRC_NAME[src] || src}`,
        });
      }
      return;
    }
    const btn = e.target.closest('.hub-btn');
    if (btn) { track(a, 'click', { link_id: +btn.dataset.linkId }); return; }
    const dspBtn = e.target.closest('.hub-dsp');
    if (dspBtn) track(a, 'click', { label: dspBtn.dataset.label, item: dspBtn.dataset.item || null });
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
      btn.disabled = false;
      btn.textContent = profile.is_team_member ? 'Send it' : 'Join the list';
      alert('That did not go through. Please try again.');
    }
  });
}
