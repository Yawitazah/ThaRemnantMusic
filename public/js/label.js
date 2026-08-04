// Tha Remnant Music Group — the public label page, /label.
//
// This is the fan-facing front door, and the only page here with no numbers on
// it. The Command Center at / is the internal view; this one is what happens
// right now, what just dropped, and who the artists are.
//
// Everything on it plays: artwork opens the shared bottom dock, platform
// buttons leave for the platform. Backgrounds are ruddy, dark and shadowy, and
// move as you scroll.

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { esc, fmt } from './ui.js';
import { SRC_NAME, playableArt, hydrateArt, dockMarkup, initDock } from './dock.js';

const REST = `${SUPABASE_URL}/rest/v1`;
const HEADERS = {
  apikey: SUPABASE_ANON_KEY,
  authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  'content-type': 'application/json',
};
const LABEL = 'Tha Remnant Music Group';

const sel = (table, query) =>
  fetch(`${REST}/${table}?${query}`, { headers: HEADERS })
    .then(r => (r.ok ? r.json() : []))
    .catch(() => []);

const isBot = () =>
  /bot|crawl|spider|preview|facebookexternalhit|whatsapp|telegram|slack|discord|twitter|linkedin|embed|headless|lighthouse|prerender/i
    .test(navigator.userAgent);

const sid = () => {
  let s = null;
  try { s = localStorage.getItem('hub-sid'); } catch {}
  if (!s) s = Math.random().toString(36).slice(2, 12);
  try { localStorage.setItem('hub-sid', s); } catch {}
  return s;
};

function track(artist, event, extra = {}) {
  if (isBot()) return;
  fetch(`${REST}/hub_events`, {
    method: 'POST', keepalive: true,
    headers: { ...HEADERS, prefer: 'return=minimal' },
    body: JSON.stringify({
      artist: artist || LABEL, event, session_id: sid(), page: 'label',
      referrer: (document.referrer || '').slice(0, 300) || null,
      ua: navigator.userAgent.slice(0, 300), ...extra,
    }),
  }).catch(() => {});
}

/* Each scene owns one of the ruddy, shadowy plates.
   The crown is the crossless version on purpose: the catalogue leans Hebrew
   Israelite (Here Comes Judah, the Sermon-to-Song material), so a Christian
   cross would be the wrong emblem. crown.jpg keeps the original if that reading
   is wrong. */
const SCENES = {
  hero:     'bible',
  now:      'microphone',
  releases: 'phone',
  roster:   'crown-nocross',
  popular:  'watch',
  join:     'ashtray',
};
const scene = key => `
  <div class="lb-scene" aria-hidden="true">
    <img src="/img/scenes/${SCENES[key]}.jpg" alt="" loading="lazy" decoding="async">
  </div>`;

const artThumb = id => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
const bigArt = id => `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;

/* Catalog rows carry short tags rather than full artist names, so a play from
   this page is still credited to the right artist in the dashboard. */
const TAG_ARTIST = { breed: 'BREED', king: 'King Konnect', jay: 'JayThaRealist', zah: 'Yawitazah' };
const artistOf = t => (t.artists || []).map(x => TAG_ARTIST[x]).find(Boolean) || '';

export async function boot() {
  document.documentElement.dataset.theme = 'dark';
  document.body.classList.add('label-mode');

  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = '/css/label.css';
  document.head.appendChild(css);

  const view = document.getElementById('view');

  const [profiles, releases, projects, catalog, channels, links, team] = await Promise.all([
    sel('artist_profiles', 'select=*&order=sort_order'),
    sel('releases', 'select=*&order=year.desc,sort_order'),
    sel('projects', 'select=*&order=priority'),
    sel('catalog', 'select=*&order=views.desc'),
    sel('channels', 'select=*'),
    sel('hub_links', 'select=*&active=eq.true&order=sort_order'),
    sel('team_members', 'select=*&is_public=eq.true&order=sort_order'),
  ]);

  /* The same record is stored once per credited artist, so the label view has
     to fold them back into one card or Righteous appears three times. */
  const seen = new Set();
  const unique = releases.filter(r => {
    const k = (r.title || '').toLowerCase().trim();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const newest = unique.filter(r => r.spotify_url || r.apple_url || r.youtube_url).slice(0, 8);

  const pushing = projects.find(p => p.status === 'pushing now') || projects[0];
  const pushingRelease = pushing
    && (releases.find(r => (r.title || '').toLowerCase() === (pushing.title || '').toLowerCase())
      || { title: pushing.title, youtube_url: pushing.hero_video_id
             ? `https://www.youtube.com/watch?v=${pushing.hero_video_id}` : null });

  const top = catalog.slice(0, 6);
  const reach = channels.reduce((s, c) => s + (c.subs || 0), 0);

  const relCard = r => `
    <article class="lb-rel" data-artist="${esc(r.artist)}">
      ${playableArt(r)}
      <h3>${esc(r.title)}</h3>
      <p class="lb-rel-meta">${esc(r.artist)}${r.year ? ' · ' + r.year : ''}</p>
      <div class="lb-dsps">
        ${r.spotify_url ? `<a href="${esc(r.spotify_url)}" target="_blank" rel="noopener"
            data-artist="${esc(r.artist)}" data-item="${esc(r.title)}"
            data-label="${esc(r.title + ' · Spotify')}">Spotify</a>` : ''}
        ${r.apple_url ? `<a href="${esc(r.apple_url)}" target="_blank" rel="noopener"
            data-artist="${esc(r.artist)}" data-item="${esc(r.title)}"
            data-label="${esc(r.title + ' · Apple')}">Apple</a>` : ''}
        ${r.youtube_url ? `<a href="${esc(r.youtube_url)}" target="_blank" rel="noopener"
            data-artist="${esc(r.artist)}" data-item="${esc(r.title)}"
            data-label="${esc(r.title + ' · YouTube')}">YouTube</a>` : ''}
      </div>
    </article>`;

  const artistCard = p => {
    const portrait = p.image_url || (p.image_video_id ? bigArt(p.image_video_id) : '');
    return `
      <a class="lb-artist" href="/artist/${esc(p.slug)}" data-artist="${esc(p.artist)}"
         data-label="${esc('Roster · ' + p.artist)}">
        <div class="lb-artist-img">
          ${portrait ? `<img src="${esc(portrait)}" alt="${esc(p.artist)}" loading="lazy">` : ''}
        </div>
        <div class="lb-artist-body">
          <h3>${esc(p.artist)}</h3>
          <p class="lb-artist-role">${esc(p.role || '')}</p>
          ${p.tagline ? `<p class="lb-artist-tag">${esc(p.tagline)}</p>` : ''}
          <span class="lb-artist-go">View artist <span aria-hidden="true">→</span></span>
        </div>
      </a>`;
  };

  view.innerHTML = `
<div class="lb">

  <section class="lb-hero" id="lb-hero">
    ${scene('hero')}
    <div class="lb-hero-body reveal">
      <img class="lb-mark" src="/img/logo-mark-180.png" alt="">
      <h1><span>Tha Remnant</span><em>Music Group</em></h1>
      <p class="lb-hero-line">A remnant is what is left when the rest gives way.
        Four artists, one catalogue, no compromise on what the music is for.</p>
      <div class="lb-hero-cta">
        <a class="lb-btn" href="#lb-now">What is happening now</a>
        <a class="lb-btn ghost" href="#lb-roster">Meet the artists</a>
      </div>
    </div>
    <span class="lb-scroll" aria-hidden="true"><span></span></span>
  </section>

  ${pushing ? `
  <section class="lb-sec lb-now" id="lb-now">
    ${scene('now')}
    <div class="lb-inner">
      <span class="lb-eyebrow reveal">Right now</span>
      <div class="lb-now-grid">
        <div class="lb-now-art reveal">
          ${playableArt({
            title: pushing.title,
            credited_to: pushing.artist,
            youtube_url: pushingRelease?.youtube_url,
            spotify_url: pushingRelease?.spotify_url,
            apple_url: pushingRelease?.apple_url,
          })}
        </div>
        <div class="lb-now-body reveal">
          <h2>${esc(pushing.title)}</h2>
          <p class="lb-now-meta">${esc(pushing.artist)}${pushing.kind ? ' · ' + esc(pushing.kind) : ''}${
            pushing.release_label ? ' · ' + esc(pushing.release_label) : ''}</p>
          <p class="lb-now-blurb">The record the whole label is behind.</p>
          <div class="lb-dsps big">
            ${pushingRelease?.spotify_url ? `<a href="${esc(pushingRelease.spotify_url)}" target="_blank" rel="noopener"
                data-artist="${esc(pushing.artist)}" data-item="${esc(pushing.title)}"
                data-label="${esc(pushing.title + ' · Spotify')}">Spotify</a>` : ''}
            ${pushingRelease?.apple_url ? `<a href="${esc(pushingRelease.apple_url)}" target="_blank" rel="noopener"
                data-artist="${esc(pushing.artist)}" data-item="${esc(pushing.title)}"
                data-label="${esc(pushing.title + ' · Apple')}">Apple Music</a>` : ''}
            ${pushingRelease?.youtube_url ? `<a href="${esc(pushingRelease.youtube_url)}" target="_blank" rel="noopener"
                data-artist="${esc(pushing.artist)}" data-item="${esc(pushing.title)}"
                data-label="${esc(pushing.title + ' · YouTube')}">YouTube</a>` : ''}
          </div>
        </div>
      </div>
    </div>
  </section>` : ''}

  ${newest.length ? `
  <section class="lb-sec lb-releases" id="lb-releases">
    ${scene('releases')}
    <div class="lb-inner">
      <span class="lb-eyebrow reveal">Out now</span>
      <h2 class="reveal">The latest from the label</h2>
      <div class="lb-grid">${newest.map((r, i) =>
        `<div class="reveal" style="--d:${i * 60}ms">${relCard(r)}</div>`).join('')}</div>
    </div>
  </section>` : ''}

  ${profiles.length ? `
  <section class="lb-sec lb-roster" id="lb-roster">
    ${scene('roster')}
    <div class="lb-inner">
      <span class="lb-eyebrow reveal">The roster</span>
      <h2 class="reveal">Four artists${reach ? `, ${fmt(reach)} people reached` : ''}</h2>
      <div class="lb-artists">${profiles.map((p, i) =>
        `<div class="reveal" style="--d:${i * 80}ms">${artistCard(p)}</div>`).join('')}</div>
    </div>
  </section>` : ''}

  ${top.length ? `
  <section class="lb-sec lb-popular" id="lb-popular">
    ${scene('popular')}
    <div class="lb-inner">
      <span class="lb-eyebrow reveal">Most played</span>
      <h2 class="reveal">Start here</h2>
      <ol class="lb-tracks reveal">
        ${top.map((t, i) => `
          <li>
            <span class="lb-rank">${String(i + 1).padStart(2, '0')}</span>
            <button class="lb-track" type="button" data-src="youtube" data-ref="${esc(t.video_id)}"
              data-title="${esc(t.title)}" data-credit="${esc(t.credit || '')}"
              data-item="${esc(t.title)}" data-artist="${esc(artistOf(t))}">
              <img src="${esc(artThumb(t.video_id))}" alt="" loading="lazy">
              <span class="lb-track-t">${esc(t.title)}<small>${esc(t.credit || '')}</small></span>
              <span class="lb-track-v">${fmt(t.views)} plays</span>
              <span class="lb-track-ic" aria-hidden="true">▶</span>
            </button>
          </li>`).join('')}
      </ol>
    </div>
  </section>` : ''}

  ${team.length ? `
  <section class="lb-sec lb-team" id="lb-team">
    <div class="lb-inner">
      <span class="lb-eyebrow reveal">Behind the artists</span>
      <h2 class="reveal">Management</h2>
      ${team.map((m, i) => `
        <article class="lb-member reveal" style="--d:${i * 80}ms">
          ${m.image_url ? `<div class="lb-member-img"><img src="${esc(m.image_url)}" alt="${esc(m.name)}" loading="lazy"></div>` : ''}
          <div class="lb-member-body">
            <h3>${esc(m.name)}</h3>
            <p class="lb-member-title">${esc(m.title)}${m.based ? ' · ' + esc(m.based) : ''}</p>
            ${m.bio ? `<p class="lb-member-bio">${esc(m.bio)}</p>` : ''}
            ${(m.highlights || []).length ? `<ul class="lb-member-list">
              ${m.highlights.map(h => `<li>${esc(h)}</li>`).join('')}
            </ul>` : ''}
            ${(m.links || []).length ? `<div class="lb-dsps">
              ${m.links.map(l => `<a href="${esc(l.url)}" target="_blank" rel="noopener"
                 data-label="${esc(m.name + ' · ' + l.label)}">${esc(l.label)}</a>`).join('')}
            </div>` : ''}
          </div>
        </article>`).join('')}
    </div>
  </section>` : ''}

  <section class="lb-sec lb-join" id="lb-join">
    ${scene('join')}
    <div class="lb-inner narrow">
      <span class="lb-eyebrow reveal">Stay close</span>
      <h2 class="reveal">Hear it first</h2>
      <p class="reveal">New records, videos and shows from the whole label. No spam, and you can
        leave whenever you want.</p>
      <form id="lb-capture" class="lb-form reveal">
        <input type="text" name="name" placeholder="Name (optional)" autocomplete="name">
        <input type="email" name="email" placeholder="Your email" required autocomplete="email">
        <button class="lb-btn" type="submit">Join the list</button>
      </form>
      <p class="lb-form-done" hidden>You are on the list. Welcome in.</p>
    </div>
  </section>

  <footer class="lb-foot">
    <img src="/img/logo-mark-180.png" alt="">
    <p>Tha Remnant Music Group</p>
    ${links.length ? `<div class="lb-foot-links">
      ${[...new Map(links.map(l => [l.label.toLowerCase(), l])).values()].slice(0, 8).map(l =>
        `<a href="${esc(l.url)}" target="_blank" rel="noopener"
           data-artist="${esc(l.artist)}" data-label="${esc('Footer · ' + l.label)}">${esc(l.label)}</a>`).join('')}
    </div>` : ''}
    <a class="lb-foot-powered" href="https://zahbrandsolutions.com" target="_blank" rel="noopener"
       data-label="Powered by Zah Brand Solutions">Powered by Zah Brand Solutions</a>
  </footer>
</div>
${dockMarkup()}`;

  /* One view per session, same rule the hub uses, so a refresh is not a fan. */
  try {
    if (!sessionStorage.getItem('lb-seen')) {
      sessionStorage.setItem('lb-seen', '1');
      track(LABEL, 'view');
    }
  } catch { track(LABEL, 'view'); }

  const { play } = initDock();

  view.addEventListener('click', e => {
    const playBtn = e.target.closest('[data-src][data-ref]');
    if (playBtn) {
      const { src, ref, title, credit, item, artist } = playBtn.dataset;
      const opened = play(src, ref, title, credit);
      track(artist || LABEL, opened ? 'play' : 'click', {
        item: item || title || null,
        label: `${title || item} · ${SRC_NAME[src] || src}`,
      });
      return;
    }
    const labelled = e.target.closest('[data-label]');
    if (labelled) {
      track(labelled.dataset.artist || LABEL, 'click', {
        label: labelled.dataset.label,
        item: labelled.dataset.item || null,
      });
    }
  });

  hydrateArt(view);
  bindScroll(view);
  bindCapture(view);
}

/* ---------- motion ----------
   Two effects: sections reveal as they arrive, and each plate drifts against
   the scroll. Where the operating system asks for reduced motion the drift is
   dropped and the reveal becomes a plain fade, because deleting both entirely
   leaves a page of blank rectangles. */
function bindScroll(view) {
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.body.classList.toggle('lb-calm', calm);

  const io = new IntersectionObserver(entries => {
    for (const en of entries) {
      if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
    }
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
  view.querySelectorAll('.reveal').forEach(el => io.observe(el));

  /* A page opened in a background tab gets no animation frames and no reliable
     observer callbacks, so every section would sit at opacity 0 until the tab
     was focused. Nothing is allowed to stay invisible: this sweeps anything
     already inside the viewport and shows it outright. */
  const sweep = () => {
    const h = window.innerHeight;
    for (const el of view.querySelectorAll('.reveal:not(.in)')) {
      const r = el.getBoundingClientRect();
      if (r.top < h * 0.94 && r.bottom > 0) { el.classList.add('in'); io.unobserve(el); }
    }
  };
  sweep();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) sweep(); });

  const scenes = calm ? [] : [...view.querySelectorAll('.lb-scene')];
  let ticking = false;
  const frame = () => {
    ticking = false;
    const h = window.innerHeight;
    for (const s of scenes) {
      const r = s.parentElement.getBoundingClientRect();
      if (r.bottom < -200 || r.top > h + 200) continue;
      // -1 above the fold, 0 centred, 1 below it.
      const p = (r.top + r.height / 2 - h / 2) / (h / 2 + r.height / 2);
      s.style.setProperty('--p', p.toFixed(4));
    }
  };
  const onScroll = () => {
    // Swept outside the animation frame on purpose: a background tab is served
    // no frames, and content that scrolled into view must still appear.
    sweep();
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(frame);
  };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll, { passive: true });
  frame();
}

function bindCapture(view) {
  const form = view.querySelector('#lb-capture');
  if (!form) return;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = form.querySelector('button');
    btn.disabled = true; btn.textContent = 'Joining…';
    try {
      const r = await fetch('/api/capture', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          artist: LABEL,
          name: form.name.value.trim(),
          email: form.email.value.trim(),
        }),
      });
      if (!r.ok) throw new Error('capture failed');
      track(LABEL, 'capture');
      form.hidden = true;
      view.querySelector('.lb-form-done').hidden = false;
    } catch {
      btn.disabled = false; btn.textContent = 'Join the list';
      alert('That did not go through. Please try again.');
    }
  });
}
