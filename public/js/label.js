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
  join:     'pendant',
};

/* Each plate is a short silent clip scrubbed by the scroll position, with the
   still as its poster. The poster is what a phone, a slow connection or a
   reduced-motion setting gets, and it is also the first paint everywhere, so
   the section is never empty while the video loads. */
const scene = key => `
  <div class="lb-scene" aria-hidden="true">
    <img src="/img/scenes/${SCENES[key]}.jpg" alt="" loading="lazy" decoding="async">
    <video class="lb-scene-vid" data-scene="${SCENES[key]}" muted playsinline
      preload="none" disablepictureinpicture></video>
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

  /* Management is deliberately absent from this page. It is the artists' page,
     and the label's staff belong in the Command Center, not in front of fans. */
  const [profiles, releases, projects, catalog, channels, links] = await Promise.all([
    sel('artist_profiles', 'select=*&order=sort_order'),
    sel('releases', 'select=*&order=year.desc,sort_order'),
    sel('projects', 'select=*&order=priority'),
    sel('catalog', 'select=*&order=views.desc'),
    sel('channels', 'select=*'),
    sel('hub_links', 'select=*&active=eq.true&order=sort_order'),
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

  /* Reduced motion switches off the things that move on their own: the drift,
     the rotation, and letting a clip run once you stop scrolling. Scrubbing
     stays, because the scroll IS the transport and the reader is driving every
     frame of it. Killing it outright would leave still photographs on a page
     built around them moving, and this machine reports reduced motion purely
     because Windows animation effects are off. */
  const scenes = calm ? [] : [...view.querySelectorAll('.lb-scene')];
  const film = bindFilm(view, { autoplayWhenIdle: !calm });
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
    film?.scrolled();
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(frame);
  };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll, { passive: true });
  frame();
  // Clips finish loading after this runs, so nudge them onto the right frame
  // once they are decodable instead of leaving them all on frame zero.
  for (const v of view.querySelectorAll('.lb-scene-vid')) {
    v.addEventListener('loadeddata', () => film?.settle(), { once: true });
  }
}

/* ---------- scroll-driven film ----------
   Each plate is a short silent clip. While you scroll, the scroll position is
   the transport: the clip is scrubbed frame by frame as the section crosses the
   screen. Stop scrolling and it takes over and plays on by itself, then pauses
   again the moment you move.

   Two things make this workable rather than a stutter:
   the clips are re-encoded with a very short keyframe interval so seeking lands
   quickly, and they are only fetched once their section is close to the screen.
   Phones do not get them at all: seeking video is expensive, iOS will not
   decode several at once, and the poster already carries the scene. */
const FILM_MIN_WIDTH = 900;

function bindFilm(view, { autoplayWhenIdle = true } = {}) {
  const vids = [...view.querySelectorAll('.lb-scene-vid')];
  if (!vids.length) return null;

  const wanted = () => window.innerWidth >= FILM_MIN_WIDTH
    && !matchMedia('(hover: none)').matches;

  if (!wanted()) {
    for (const v of vids) v.remove();
    return null;
  }

  /* Loaded lazily so a visitor who never scrolls past the hero pays for one
     clip. Armed from a direct viewport check rather than only an observer: a
     background tab does not deliver observer callbacks reliably, and the clips
     would never load at all. */
  const arm = v => {
    if (v.dataset.armed || !v.isConnected) return;
    v.dataset.armed = '1';
    v.src = `/img/scenes/${v.dataset.scene}.mp4`;
    v.preload = 'auto';
    v.load();
    v.addEventListener('loadeddata', () => v.classList.add('ready'), { once: true });
    // A clip that will not load is not worth chasing; the still stays.
    v.addEventListener('error', () => v.remove(), { once: true });
  };

  const armNearby = () => {
    const h = window.innerHeight;
    for (const v of vids) {
      if (v.dataset.armed || !v.isConnected) continue;
      const r = v.getBoundingClientRect();
      if (r.top < h * 2.2 && r.bottom > -h) arm(v);
    }
  };
  armNearby();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) armNearby(); });

  let idleTimer = 0;
  let scrubbing = false;

  const stopScrub = () => {
    scrubbing = false;
    if (!autoplayWhenIdle) return;
    for (const v of vids) {
      if (!v.isConnected || !v.duration) continue;
      const r = v.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) continue;
      v.play().catch(() => {});   // autoplay of a muted video is allowed
    }
  };

  /* Seeking runs straight from the scroll event rather than inside an animation
     frame. Scrubbing should track the finger with no frame of lag, and a
     background tab is served no frames at all, which would leave every clip
     frozen on its first frame. */
  const clamp01 = n => Math.min(1, Math.max(0, n));
  const first = vids[0], last = vids[vids.length - 1];

  const scrub = () => {
    const h = window.innerHeight;
    for (const v of vids) {
      if (!v.isConnected) continue;
      const d = v.duration;
      if (!d || !isFinite(d)) continue;
      const r = v.getBoundingClientRect();
      if (r.bottom < -100 || r.top > h + 100) continue;
      if (!v.paused) v.pause();

      /* Middle sections cross the whole screen, so their clip runs from the
         moment they appear at the bottom to the moment they leave at the top.
         The first and last sections never get that full pass: nothing is above
         the first one and nothing below the last. They are measured against
         their own height instead, so the hero starts on frame one at the top of
         the page and the closing section finishes at the bottom. */
      const p = v === first ? clamp01(-r.top / r.height)
        : v === last ? clamp01((h - r.top) / r.height)
        : clamp01((h - r.top) / (h + r.height));

      const t = p * (d - 0.05);
      if (Math.abs(v.currentTime - t) > 0.02) v.currentTime = t;
    }
  };

  return {
    scrolled() {
      armNearby();
      scrubbing = true;
      scrub();
      clearTimeout(idleTimer);
      // Idle for a beat and the clips run on their own, which is the part that
      // makes it feel alive rather than mechanical.
      idleTimer = setTimeout(stopScrub, 320);
    },
    // Called once at boot so a clip that loads late lands on the right frame.
    settle() { if (!scrubbing) scrub(); },
  };
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
