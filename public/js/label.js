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
import { SRC_NAME, ytId, playableArt, hydrateArt, dockMarkup, initDock } from './dock.js';

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
  const [profiles, releases, projects, catalog, channels, links, settings] = await Promise.all([
    sel('artist_profiles', 'select=*&order=sort_order'),
    sel('releases', 'select=*&order=year.desc,sort_order'),
    sel('projects', 'select=*&order=priority'),
    sel('catalog', 'select=*&order=views.desc'),
    sel('channels', 'select=*'),
    sel('hub_links', 'select=*&active=eq.true&order=sort_order'),
    sel('settings', 'select=*&key=eq.founding'),
  ]);

  // Who founded the label is stated once, in settings, so no page invents its
  // own wording for it.
  const founding = settings?.[0]?.value?.line || '';

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

  /* The record being pushed is a music video, not a sleeve, so it gets its own
     still at 16:9 and opens full size rather than in the little bottom bar. */
  const nowVideoId = ytId(pushingRelease?.youtube_url) || pushing?.hero_video_id
    || pushing?.art_video_id || '';

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
          ${nowVideoId ? `
            <button class="lb-now-video" type="button" data-big="${esc(nowVideoId)}"
              data-artist="${esc(pushing.artist)}" data-item="${esc(pushing.title)}"
              aria-label="Play the ${esc(pushing.title)} music video">
              <img src="${esc(bigArt(nowVideoId))}" alt=""
                onerror="this.onerror=null;this.src='https://i.ytimg.com/vi/${esc(nowVideoId)}/hqdefault.jpg'">
              <span class="lb-now-play" aria-hidden="true">▶</span>
              <span class="lb-now-tag">Music video</span>
            </button>`
            : playableArt({
                title: pushing.title,
                credited_to: pushing.artist,
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
      ${founding ? `<p class="lb-founding reveal">${esc(founding)}</p>` : ''}
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

  const { play, lightbox } = initDock();

  view.addEventListener('click', e => {
    // The music video opens full size, not in the bottom bar.
    const big = e.target.closest('[data-big]');
    if (big) {
      lightbox(big.dataset.big);
      track(big.dataset.artist || LABEL, 'play', {
        item: big.dataset.item || null,
        label: `${big.dataset.item} · Music video`,
      });
      return;
    }
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

   Three things make this workable rather than a stutter:
   the clips carry a very short keyframe interval so a seek lands quickly, only
   the sections near the screen are fetched, and everything further away is
   released so its decoder is handed back.

   Phones run it too, on a smaller cut of each clip. They are the reason for the
   release step: iOS keeps only a small number of video elements decoding at
   once, and six live ones would starve each other until nothing painted. */
const SMALL = 900;

function bindFilm(view, { autoplayWhenIdle = true } = {}) {
  const vids = [...view.querySelectorAll('.lb-scene-vid')];
  if (!vids.length) return null;

  /* The one case worth skipping. Someone on Data Saver or a 2G connection did
     not ask to spend their allowance on background footage, and the still
     already carries the scene. */
  const conn = navigator.connection || {};
  if (conn.saveData || /^(slow-)?2g$/.test(conn.effectiveType || '')) {
    for (const v of vids) v.remove();
    return null;
  }

  // A 640px cut, about a third of the weight, for phones.
  const small = () => window.innerWidth < SMALL;
  let wasSmall = small();
  const srcFor = v => `/img/scenes/${v.dataset.scene}${small() ? '-sm' : ''}.mp4`;

  /* iOS will not paint a frame from a video that has never played, so a seek
     alone leaves the poster showing. One muted play/pause on the first touch
     unlocks it, and costs nothing anywhere else. */
  let unlocked = false;
  const unlock = () => {
    if (unlocked) return;
    unlocked = true;
    for (const v of vids) {
      if (!v.dataset.armed) continue;
      v.play().then(() => v.pause()).catch(() => {});
    }
  };
  addEventListener('touchstart', unlock, { once: true, passive: true });
  addEventListener('pointerdown', unlock, { once: true, passive: true });

  const arm = v => {
    if (v.dataset.armed || !v.isConnected) return;
    v.dataset.armed = '1';
    v.src = srcFor(v);
    v.preload = 'auto';
    v.load();
    v.addEventListener('loadeddata', () => {
      v.classList.add('ready');
      if (unlocked) v.play().then(() => v.pause()).catch(() => {});
    }, { once: true });
    // A clip that will not load is not worth chasing; the still stays.
    v.addEventListener('error', () => v.remove(), { once: true });
  };

  /* Handing the decoder back matters more than the download saved. Dropping the
     source is what lets a phone keep painting the section you are actually
     looking at. The still underneath takes over while it is released. */
  const release = v => {
    if (!v.dataset.armed) return;
    delete v.dataset.armed;
    v.classList.remove('ready');
    v.removeAttribute('src');
    v.load();
  };

  const armNearby = () => {
    // Phones hold a tighter window: current section plus the next one.
    const near = small() ? 1.2 : 2.2;
    const far  = small() ? 2.0 : 4.0;
    const h = window.innerHeight;
    for (const v of vids) {
      if (!v.isConnected) continue;
      const r = v.getBoundingClientRect();
      if (r.top < h * near && r.bottom > -h * near) arm(v);
      else if (r.top > h * far || r.bottom < -h * far) release(v);
    }
  };
  armNearby();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    armNearby();
    // Coming back to the tab, land on the right frame rather than easing to it.
    setTimeout(() => api.settle(), 0);
  });

  // Crossing the phone/desktop line mid-session means every clip is the wrong
  // cut. Drop them all and let the next sweep fetch the right one.
  addEventListener('resize', () => {
    if (small() === wasSmall) return;
    wasSmall = small();
    for (const v of vids) release(v);
    armNearby();
  }, { passive: true });

  let idleTimer = 0;
  let scrubbing = false;

  const stopScrub = () => {
    scrubbing = false;
    if (!autoplayWhenIdle) return;
    for (const v of vids) {
      if (!v.isConnected || !v.dataset.armed || !v.duration) continue;
      const r = v.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) continue;
      v.play().catch(() => {});   // autoplay of a muted video is allowed
    }
  };

  /* ---------- smoothing ----------
     Two things made this stutter, and both are here.

     A mouse wheel does not scroll continuously. It arrives in jumps of roughly
     a hundred pixels, and a hundred pixels is about a second of clip, so
     mapping scroll straight onto currentTime produced a slide show however well
     the video decoded. The scroll now only sets a TARGET, and an animation
     frame eases the playhead toward it. Discrete input, continuous output.

     The second was asking for seeks faster than the decoder could answer.
     A seek is not free, and assigning currentTime again cancels the one in
     flight, so a fast scroll could leave every seek abandoned before it painted.
     Requests are now quantised to the frame grid and skipped while a seek is
     still running. */
  const clamp01 = n => Math.min(1, Math.max(0, n));
  const FRAME = 1 / 16;      // the clips are encoded at 16fps, every frame a keyframe
  const EASE = 0.18;         // per frame; settles in ~150ms without feeling laggy
  const target = new WeakMap();
  const eased = new WeakMap();
  let raf = 0;
  let rafProven = false;   // set once a frame has actually been delivered

  /* How much scroll one clip is worth, as a fraction of the viewport. It has to
     match the hold the stylesheet guarantees (min-height minus one screen), or
     the sections that only just clear the minimum would animate faster than the
     content-heavy ones that run far longer. Desktop guarantees 100svh of hold,
     phones 65svh. */
  const measure = () => {
    const h = window.innerHeight;
    const SPAN = small() ? 0.65 : 1;
    for (const v of vids) {
      if (!v.isConnected) continue;
      const d = v.duration;
      if (!d || !isFinite(d)) { target.delete(v); continue; }

      /* Measured against the SECTION, never the video. The plate is sticky now,
         so its own rect stops moving the moment it pins, and scrubbing off that
         would freeze the clip on one frame for the whole hold. */
      const sec = v.closest('.lb-sec, .lb-hero');
      const r = (sec || v).getBoundingClientRect();
      if (r.bottom < -100 || r.top > h + 100) { target.delete(v); continue; }
      if (!v.paused) {
        // Coming back from the idle playthrough the playhead has moved on its
        // own, so the easing re-seeds from where the clip actually is rather
        // than snapping back to wherever the last scrub left it.
        v.pause();
        eased.set(v, v.currentTime);
      }

      /* The held stretch is the scroll distance where the plate fills the
         screen: from the section's top reaching the top of the viewport to its
         bottom reaching the bottom.

         The clip is mapped to a CAPPED slice of that, not all of it, because
         section heights are driven by their content and vary enormously. On a
         phone the releases section ran 3100px while the closing section ran
         162px, so the same eight seconds crawled in one and blew past in a
         single flick in the other. Capping the span makes every scene animate
         at the same speed; a long section simply finishes early and holds on
         its last frame. */
      const hold = r.height - h;
      const span = Math.min(hold, h * SPAN);
      const p = span > 40
        ? clamp01(-r.top / span)
        : clamp01((h - r.top) / (h + r.height));

      target.set(v, p * (d - 0.05));
    }
  };

  const apply = (v, t) => {
    // Never ask for a position between two frames; it is a seek that cannot
    // change the picture.
    const snapped = Math.round(t / FRAME) * FRAME;
    if (v.seeking) return;                       // one seek at a time
    if (Math.abs(v.currentTime - snapped) < FRAME * 0.9) return;
    v.currentTime = snapped;
  };

  const tick = () => {
    raf = 0;
    rafProven = true;
    let moving = false;
    for (const v of vids) {
      const to = target.get(v);
      if (to == null) continue;
      let cur = eased.get(v);
      if (cur == null) cur = v.currentTime || 0;
      const diff = to - cur;
      if (Math.abs(diff) <= FRAME / 2) cur = to;
      else { cur += diff * EASE; moving = true; }
      eased.set(v, cur);
      apply(v, cur);
    }
    if (moving) raf = requestAnimationFrame(tick);
  };

  const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };
  kick();   // proves whether frames arrive here at all

  const place = () => {
    for (const v of vids) {
      const to = target.get(v);
      if (to == null) continue;
      eased.set(v, to);
      apply(v, to);
    }
  };

  /* Where animation frames are never delivered — a background tab, a pane that
     is not compositing — the easing would never run and every clip would sit on
     frame zero. Until a frame has actually arrived, the playhead is placed
     directly instead. Nothing is smoothed, but nothing is stuck either. */
  const scrub = () => {
    measure();
    kick();
    if (!rafProven) place();
  };

  const api = {
    scrolled() {
      armNearby();
      scrubbing = true;
      scrub();
      clearTimeout(idleTimer);
      // Idle for a beat and the clips run on their own, which is the part that
      // makes it feel alive rather than mechanical.
      idleTimer = setTimeout(stopScrub, 320);
    },
    /* A clip that finishes loading late has missed the easing entirely, so it
       is placed on its frame outright rather than sliding there from zero. */
    settle() { measure(); place(); },
  };
  return api;
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
