// The bottom player, shared by every public page.
//
// One bar docked across the bottom so a fan keeps browsing while the music
// runs. Three sources: a YouTube video, a Spotify embed or an Apple Music
// embed. That matters here because 22 of the 32 releases have no YouTube URL,
// and a YouTube-only dock left most of the catalogue unplayable.
//
// What each source gives a listener is the platform's rule, not ours: YouTube
// plays in full, Spotify and Apple play a preview to a signed-out visitor and
// the whole song to someone signed in to that service.

import { esc } from './ui.js';

export const SRC_NAME = { youtube: 'YouTube', spotify: 'Spotify', apple: 'Apple Music' };

export const ytId = url =>
  (String(url || '').match(/[?&]v=([\w-]+)/) || String(url || '').match(/youtu\.be\/([\w-]+)/) || [])[1] || '';

/* open.spotify.com/album/ID -> open.spotify.com/embed/album/ID */
export const spotifyEmbed = url => {
  const m = String(url || '').match(
    /open\.spotify\.com\/(?:intl-[a-z]{2}\/)?(album|track|playlist|artist|episode|show)\/([A-Za-z0-9]+)/);
  return m ? `https://open.spotify.com/embed/${m[1]}/${m[2]}?utm_source=generator` : null;
};

/* music.apple.com/... -> embed.music.apple.com/... , query string intact so a
   song link (?i=123) still opens on that song rather than the album. */
export const appleEmbed = url =>
  /(?:^|\/\/)(?:geo\.)?music\.apple\.com\//.test(String(url || ''))
    ? String(url).replace(/(?:geo\.)?music\.apple\.com/, 'embed.music.apple.com')
    : null;

/** Best playable source for a release row, or null if it has no links at all. */
export const playableFor = r =>
  r?.youtube_url && ytId(r.youtube_url) ? { src: 'youtube', ref: ytId(r.youtube_url) }
  : r?.spotify_url ? { src: 'spotify', ref: r.spotify_url }
  : r?.apple_url   ? { src: 'apple',   ref: r.apple_url }
  : null;

export const ytThumb = id => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;

/**
 * Artwork that doubles as the play control.
 * Releases with no video have no still, so the initial becomes the artwork and
 * stays just as clickable.
 */
export const playableArt = (r, p = playableFor(r), q = {}) => `
  <div class="pf-rel-art"${r.spotify_url ? ` data-art-spotify="${esc(r.spotify_url)}"` : ''}${
    r.apple_url ? ` data-art-apple="${esc(r.apple_url)}"` : ''}>
    ${r.youtube_url && ytId(r.youtube_url)
      ? `<img src="${esc(ytThumb(ytId(r.youtube_url)))}" alt="" loading="lazy">`
      : `<span class="pf-rel-ph">${esc((r.title || '?').slice(0, 1))}</span>`}
    ${p ? `<span class="pf-src-tag">${esc(SRC_NAME[p.src])}</span>
      <button class="pf-rel-play" type="button" data-src="${p.src}" data-ref="${esc(p.ref)}"
        data-title="${esc(r.title)}" data-credit="${esc(r.credited_to || r.kind || '')}"
        data-item="${esc(r.title)}"${q.queue ? ` data-queue="${esc(q.queue)}" data-qi="${q.index}"` : ''}
        aria-label="Play ${esc(r.title)}"><span aria-hidden="true">▶</span></button>` : ''}
  </div>`;

/** Turn a list of releases into queue entries, skipping anything unplayable. */
export const queueFrom = rows => (rows || []).map(r => {
  const p = playableFor(r);
  return p && { src: p.src, ref: p.ref, title: r.title,
                credit: r.credited_to || r.kind || '', item: r.title };
}).filter(Boolean);

/* ---------- cover art ----------
   Only 10 of the 32 releases have a YouTube video, and the other 22 were
   falling back to a single letter on a coloured square. Both of these
   endpoints are public, CORS-open and need no key, so the real sleeve can be
   fetched for anything that lives on Spotify or Apple Music. Every failure is
   silent: the letter stays and nothing else on the page notices. */

const artCache = key => {
  try { return sessionStorage.getItem('art:' + key); } catch { return null; }
};
const artStore = (key, url) => {
  try { sessionStorage.setItem('art:' + key, url || ''); } catch { /* private mode */ }
};

async function spotifyArt(url) {
  const r = await fetch('https://open.spotify.com/oembed?url=' + encodeURIComponent(url));
  if (!r.ok) return null;
  const j = await r.json();
  return j.thumbnail_url || null;
}

async function appleArt(url) {
  const id = (String(url).match(/\/(?:id)?(\d{6,})(?:[/?#]|$)/) || [])[1];
  if (!id) return null;
  const r = await fetch(`https://itunes.apple.com/lookup?id=${id}`);
  if (!r.ok) return null;
  const j = await r.json();
  const art = j.results?.[0]?.artworkUrl100;
  // The API hands back a 100px thumbnail; the same path serves any size.
  return art ? art.replace(/\/100x100bb/, '/600x600bb') : null;
}

/**
 * Put the real sleeve on every card that has a Spotify or Apple release behind
 * it. This runs even where a YouTube still is already showing, because a still
 * is 16:9 and gets its edges cropped off in a square tile, while the sleeve is
 * square to begin with. Anything that cannot be resolved keeps what it had.
 */
export function hydrateArt(root) {
  for (const el of root.querySelectorAll('.pf-rel-art')) {
    const spot = el.dataset.artSpotify, apple = el.dataset.artApple;
    const ref = spot || apple;
    if (!ref) continue;

    /* Swapped in only once the sleeve has actually decoded, so a slow or dead
       CDN leaves what was there instead of an empty box. Note the absence of
       loading="lazy": on a detached image that defers the fetch, onload never
       fires, and the swap would wait forever. */
    const paint = url => {
      if (!url) return;
      const img = new Image();
      img.alt = '';
      img.onload = () => {
        const current = el.querySelector('.pf-rel-ph, img');
        if (current) current.replaceWith(img); else el.prepend(img);
      };
      img.src = url;
    };

    const cached = artCache(ref);
    if (cached !== null) { paint(cached); continue; }
    (spot ? spotifyArt(spot) : appleArt(apple))
      .then(url => { artStore(ref, url); paint(url); })
      .catch(() => {});
  }
}

/* ---------- the YouTube IFrame API ----------
   A plain embed iframe cannot tell us when a track finished, which is the one
   event a playlist is built on. The API gives us that, and it also lets one
   player instance be reused for every track instead of tearing an iframe down
   and building a new one between songs. */
let ytApiPromise = null;
function loadYouTubeApi() {
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise((resolve, reject) => {
    if (window.YT?.Player) return resolve(window.YT);
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { previous?.(); resolve(window.YT); };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.async = true;
    s.onerror = () => reject(new Error('YouTube API blocked'));
    document.head.appendChild(s);
    // Blocked by an extension or an offline moment: fall back rather than hang.
    setTimeout(() => reject(new Error('YouTube API timed out')), 8000);
  });
  return ytApiPromise;
}

/** The dock markup. Append once, near the end of the page. */
export const dockMarkup = () => `
<div class="pf-dock" id="pf-dock" hidden>
  <canvas class="pf-dock-fx" id="pf-dock-fx" aria-hidden="true"></canvas>
  <button class="pf-dock-scrim" id="pf-dock-scrim" type="button" tabindex="-1" aria-label="Close the player"></button>
  <div class="pf-dock-inner">
    <div class="pf-dock-video"><div id="pf-dock-frame"><div id="pf-yt"></div></div></div>
    <div class="pf-dock-meta">
      <strong id="pf-dock-title"></strong>
      <small id="pf-dock-credit"></small>
      <small class="pf-dock-next" id="pf-dock-next" hidden></small>
    </div>
    <div class="pf-dock-embed" id="pf-dock-embed"></div>
    <div class="pf-dock-actions">
      <button class="pf-dock-btn" id="pf-dock-prev" type="button" title="Previous track" hidden>⏮</button>
      <button class="pf-dock-btn" id="pf-dock-skip" type="button" title="Next track" hidden>⏭</button>
      <button class="pf-dock-btn" id="pf-dock-expand" type="button" title="Expand">⤢</button>
      <a class="pf-dock-btn" id="pf-dock-out" target="_blank" rel="noopener" title="Open on the platform">↗</a>
      <button class="pf-dock-btn" id="pf-dock-close" type="button" title="Close">✕</button>
    </div>
  </div>
</div>`;

/**
 * Wire the dock up. Returns { play, close }.
 * `play` answers true when the track opened in the dock and false when there
 * was nothing embeddable and the platform had to be opened in a new tab.
 */
export function initDock({ onTrack } = {}) {
  const dock = document.getElementById('pf-dock');
  const dockFrame = document.getElementById('pf-dock-frame');
  const dockEmbed = document.getElementById('pf-dock-embed');
  if (!dock) return { play: () => false, close: () => {}, setQueue: () => false, lightbox: () => {} };

  const $ = id => document.getElementById(id);
  let playing = null;
  let queue = [];
  let at = -1;
  let yt = null;          // the one YouTube player, reused for every track
  let ytBroken = false;   // API blocked: fall back to a plain embed

  /* ---------- the queue ----------
     A ranked list is a playlist. Clicking the third song should leave the rest
     of the list queued behind it, and when a track ends the next one starts on
     its own. Only YouTube reports the end of a track, so an auto-advance can
     only follow a YouTube item; the skip controls cover the rest by hand. */
  const current = () => queue[at] || playing;
  const upNext = () => queue[at + 1] || null;

  const paintQueue = () => {
    const nextEl = $('pf-dock-next');
    const n = upNext();
    nextEl.textContent = n ? `Up next: ${n.title}` : '';
    nextEl.hidden = !n;
    $('pf-dock-prev').hidden = at < 1;
    $('pf-dock-skip').hidden = !n;
  };

  const ytFrame = (id, autoplay = 1) =>
    `<iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=${autoplay}&rel=0&playsinline=1"
       title="Player" allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
       allowfullscreen></iframe>`;

  /* One player, created on the first track and reused after that: loading the
     next song into it is instant, where a new iframe each time meant a visible
     tear-down between songs. */
  async function ensureYouTube() {
    if (yt || ytBroken) return yt;
    const YT = await loadYouTubeApi();
    yt = await new Promise(resolve => {
      const player = new YT.Player('pf-yt', {
        host: 'https://www.youtube-nocookie.com',
        playerVars: { autoplay: 1, rel: 0, playsinline: 1, modestbranding: 1 },
        events: {
          onReady: () => resolve(player),
          onStateChange: e => { if (e.data === YT.PlayerState.ENDED) advance(1); },
          onError: () => advance(1),   // a pulled video should not stall the list
        },
      });
    });
    return yt;
  }

  const showYouTube = async (ref, title, credit) => {
    dockEmbed.innerHTML = '';
    $('pf-dock-title').textContent = title || '';
    $('pf-dock-credit').textContent = credit || '';
    $('pf-dock-out').href = `https://www.youtube.com/watch?v=${ref}`;
    try {
      const player = await ensureYouTube();
      if (player) { player.loadVideoById(ref); return; }
    } catch {
      ytBroken = true;   // blocked or timed out
    }
    // No API: still play, just without knowing when the track ends.
    dockFrame.innerHTML = ytFrame(ref);
  };

  const showEmbed = (src, ref) => {
    const url = src === 'spotify' ? spotifyEmbed(ref) : appleEmbed(ref);
    if (!url) return false;
    // Spotify and Apple ship artwork, title and transport inside the embed, so
    // repeating our own strip beside it would just be noise.
    if (yt) { try { yt.stopVideo(); } catch {} }
    dockEmbed.innerHTML = `<iframe src="${esc(url)}" title="Player"
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"></iframe>`;
    $('pf-dock-out').href = ref;
    return true;
  };

  const open = (src) => {
    document.body.classList.remove('has-dock-spotify', 'has-dock-apple');
    dock.dataset.src = src;
    if (src !== 'youtube') document.body.classList.add(`has-dock-${src}`);
    $('pf-dock-expand').hidden = src !== 'youtube';
    dock.hidden = false;
    document.body.classList.add('has-dock');
  };

  const playItem = (item) => {
    if (!item) return false;
    const { src, ref, title, credit } = item;
    if (src === 'youtube') { showYouTube(ref, title, credit); }
    else if (!showEmbed(src, ref)) { window.open(ref, '_blank', 'noopener'); return false; }
    playing = item;
    open(src);
    paintQueue();
    onTrack?.(item);
    return true;
  };

  /* Step through the queue. Running off the end closes the player rather than
     looping, so a listener is never trapped in it. */
  const advance = (step) => {
    const to = at + step;
    if (to < 0 || to >= queue.length) { if (step > 0) close(); return; }
    at = to;
    playItem(queue[at]);
  };

  const close = () => {
    if (yt) { try { yt.stopVideo(); } catch {} }
    dockEmbed.innerHTML = '';
    if (ytBroken) dockFrame.innerHTML = '';   // the fallback iframe has to go
    dock.hidden = true;
    dock.classList.remove('is-big');
    fxStop();   // defined below; only ever called after init completes
    document.body.classList.remove('has-dock', 'has-dock-spotify', 'has-dock-apple');
    document.body.style.overflow = '';
    playing = null; queue = []; at = -1;
  };

  /** Play one thing, with nothing queued behind it. */
  const play = (src, ref, title, credit) => {
    queue = []; at = -1;
    return playItem({ src, ref, title, credit });
  };

  /** Play `items[i]` and leave the rest of the list queued behind it. */
  const setQueue = (items, i = 0) => {
    queue = (items || []).filter(Boolean);
    at = Math.max(0, Math.min(i, queue.length - 1));
    return playItem(queue[at]);
  };

  /* ---------- the light ring ----------
     Rings of small ember lights orbiting the player in theatre mode, swelling
     and settling like they are listening. Honest note on the "with the music"
     part: the audio lives inside YouTube's iframe on another origin, so the
     real waveform is unreachable — this is a pulse built from layered waves
     tuned to feel like a beat, which is what every site does over an embed.

     It draws nothing outside theatre mode and stops the moment it closes, so
     the bottom-bar player costs nothing extra. */
  const fx = $('pf-dock-fx');
  const fxCtx = fx?.getContext('2d');
  let fxRaf = 0;
  const calmFx = typeof matchMedia === 'function'
    && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const LIGHTS = Array.from({ length: 96 }, (_, i) => ({
    ring: i % 3,                                   // three concentric orbits
    a: (i / 96) * Math.PI * 2 * 3 + (i % 7) * 0.61,
    sp: (0.10 + (i % 5) * 0.045) * (i % 2 ? 1 : -1),
    size: 1.2 + ((i * 7919) % 100) / 42,           // deterministic, no Math.random
    tw: (i % 11) * 0.57,
    warm: i % 4 !== 0,                             // mostly ember, some pale gold
  }));

  const drawFx = (tMs) => {
    if (!fxCtx || !dock.classList.contains('is-big')) return;
    const t = tMs / 1000;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = dock.clientWidth, h = dock.clientHeight;
    if (fx.width !== w * dpr || fx.height !== h * dpr) {
      fx.width = w * dpr; fx.height = h * dpr;
    }
    const c = fxCtx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, h);

    // A pulse that breathes like a track: a slow swell, an offbeat, and a
    // sharpened kick so the accents land rather than drift. Reduced motion
    // keeps the lights but calms them: half speed, no kick — a drift, not a
    // freeze, because many Windows desktops report reduced motion just from
    // animation effects being off.
    const tt = calmFx ? t * 0.4 : t;
    const kick = calmFx ? 0 : Math.pow(Math.max(0, Math.sin(t * 4.4)), 6);
    const e = 0.45 + 0.25 * Math.sin(tt * 2.05) + 0.18 * Math.sin(tt * 3.3 + 1.4) + 0.5 * kick;

    const cx = w / 2, cy = h * 0.46;
    const base = Math.min(w, h) * 0.34;

    // A soft ember wash behind the player that brightens on the kick.
    const glow = c.createRadialGradient(cx, cy, base * 0.2, cx, cy, base * 1.9);
    glow.addColorStop(0, `rgba(217,89,38,${0.05 + 0.07 * e})`);
    glow.addColorStop(1, 'rgba(217,89,38,0)');
    c.fillStyle = glow;
    c.fillRect(0, 0, w, h);

    for (const p of LIGHTS) {
      const R = base * (0.82 + p.ring * 0.22) * (1 + 0.05 * e * Math.sin(tt * 1.7 + p.tw));
      const a = p.a + tt * p.sp;
      const x = cx + Math.cos(a) * R * 1.28;       // wider than tall, like a halo
      const y = cy + Math.sin(a) * R * 0.86;
      const twinkle = 0.35 + 0.65 * Math.abs(Math.sin(tt * 1.3 + p.tw * 3));
      const s = p.size * (0.8 + 0.5 * e);
      c.beginPath();
      c.arc(x, y, s, 0, Math.PI * 2);
      c.fillStyle = p.warm
        ? `rgba(232,122,77,${0.5 * twinkle})`
        : `rgba(244,236,227,${0.4 * twinkle})`;
      c.fill();
      // halo around each light, cheap enough to run on all of them
      c.beginPath();
      c.arc(x, y, s * 3, 0, Math.PI * 2);
      c.fillStyle = p.warm
        ? `rgba(217,89,38,${0.08 * twinkle})`
        : `rgba(244,236,227,${0.05 * twinkle})`;
      c.fill();
    }
  };

  const fxLoop = (now) => {
    drawFx(now);
    fxRaf = dock.classList.contains('is-big')
      ? requestAnimationFrame(fxLoop) : 0;
  };
  const fxStart = () => {
    if (!fxCtx) return;
    // Where frames are never delivered the canvas just holds this one still
    // frame — decorative, so a static halo is a fine floor.
    drawFx(4000);
    if (!fxRaf) fxRaf = requestAnimationFrame(fxLoop);
  };
  const fxStop = () => {
    if (fxRaf) cancelAnimationFrame(fxRaf);
    fxRaf = 0;
    fxCtx?.clearRect(0, 0, fx.width, fx.height);
  };

  /* Theatre mode is the same player at full size rather than a second one.
     Moving an iframe in the DOM reloads it, which would restart the track and
     drop the queue, so the dock simply grows instead. */
  const big = (on) => {
    dock.classList.toggle('is-big', on);
    document.body.style.overflow = on ? 'hidden' : '';
    if (on) fxStart(); else fxStop();
  };

  $('pf-dock-close').addEventListener('click', close);
  $('pf-dock-scrim').addEventListener('click', () => big(false));
  $('pf-dock-expand').addEventListener('click', () => big(!dock.classList.contains('is-big')));
  $('pf-dock-prev').addEventListener('click', () => advance(-1));
  $('pf-dock-skip').addEventListener('click', () => advance(1));
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || dock.hidden) return;
    if (dock.classList.contains('is-big')) big(false); else close();
  });

  /** Play one video full size. Used for a music video, which is not background listening. */
  const lightbox = (id, title, credit) => {
    play('youtube', id, title, credit);
    big(true);
  };

  return { play, setQueue, close, lightbox, closeLightbox: () => big(false) };
}
