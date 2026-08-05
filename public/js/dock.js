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
export const playableArt = (r, p = playableFor(r)) => `
  <div class="pf-rel-art"${r.spotify_url ? ` data-art-spotify="${esc(r.spotify_url)}"` : ''}${
    r.apple_url ? ` data-art-apple="${esc(r.apple_url)}"` : ''}>
    ${r.youtube_url && ytId(r.youtube_url)
      ? `<img src="${esc(ytThumb(ytId(r.youtube_url)))}" alt="" loading="lazy">`
      : `<span class="pf-rel-ph">${esc((r.title || '?').slice(0, 1))}</span>`}
    ${p ? `<span class="pf-src-tag">${esc(SRC_NAME[p.src])}</span>
      <button class="pf-rel-play" type="button" data-src="${p.src}" data-ref="${esc(p.ref)}"
        data-title="${esc(r.title)}" data-credit="${esc(r.credited_to || r.kind || '')}"
        data-item="${esc(r.title)}"
        aria-label="Play ${esc(r.title)}"><span aria-hidden="true">▶</span></button>` : ''}
  </div>`;

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

/** The dock and lightbox markup. Append once, near the end of the page. */
export const dockMarkup = () => `
<div class="pf-dock" id="pf-dock" hidden>
  <div class="pf-dock-inner">
    <div class="pf-dock-video"><div id="pf-dock-frame"></div></div>
    <div class="pf-dock-meta">
      <strong id="pf-dock-title"></strong>
      <small id="pf-dock-credit"></small>
    </div>
    <div class="pf-dock-embed" id="pf-dock-embed"></div>
    <div class="pf-dock-actions">
      <button class="pf-dock-btn" id="pf-dock-expand" type="button" title="Expand">⤢</button>
      <a class="pf-dock-btn" id="pf-dock-out" target="_blank" rel="noopener" title="Open on the platform">↗</a>
      <button class="pf-dock-btn" id="pf-dock-close" type="button" title="Close">✕</button>
    </div>
  </div>
</div>

<div class="pf-lightbox" id="pf-lightbox" hidden>
  <button class="pf-lightbox-close" id="pf-lightbox-close" type="button" aria-label="Close">✕</button>
  <div class="pf-lightbox-frame" id="pf-lightbox-frame"></div>
</div>`;

/**
 * Wire the dock up. Returns { play, close }.
 * `play` answers true when the track opened in the dock and false when there
 * was nothing embeddable and the platform had to be opened in a new tab.
 */
export function initDock() {
  const dock = document.getElementById('pf-dock');
  const dockFrame = document.getElementById('pf-dock-frame');
  const dockEmbed = document.getElementById('pf-dock-embed');
  const lightbox = document.getElementById('pf-lightbox');
  const lightboxFrame = document.getElementById('pf-lightbox-frame');
  if (!dock) return { play: () => false, close: () => {} };
  let playing = null;

  const ytFrame = (id, autoplay = 1) =>
    `<iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=${autoplay}&rel=0"
       title="Player" allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
       allowfullscreen loading="lazy"></iframe>`;

  const frameFor = (src, ref) => {
    if (src === 'youtube') return ytFrame(ref);
    const url = src === 'spotify' ? spotifyEmbed(ref) : appleEmbed(ref);
    if (!url) return null;
    return `<iframe src="${esc(url)}" title="Player" loading="lazy"
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"></iframe>`;
  };

  const close = () => {
    dockFrame.innerHTML = '';        // clearing the iframe is what stops playback
    dockEmbed.innerHTML = '';
    dock.hidden = true;
    document.body.classList.remove('has-dock', 'has-dock-spotify', 'has-dock-apple');
    playing = null;
  };

  const play = (src, ref, title, credit) => {
    const html = frameFor(src, ref);
    if (!html) { window.open(ref, '_blank', 'noopener'); return false; }
    playing = { src, ref, title, credit };
    document.body.classList.remove('has-dock-spotify', 'has-dock-apple');
    dock.dataset.src = src;
    if (src === 'youtube') {
      dockFrame.innerHTML = html;
      dockEmbed.innerHTML = '';
      document.getElementById('pf-dock-title').textContent = title || '';
      document.getElementById('pf-dock-credit').textContent = credit || '';
      document.getElementById('pf-dock-out').href = `https://www.youtube.com/watch?v=${ref}`;
    } else {
      // Spotify and Apple ship artwork, title and transport inside the embed,
      // so repeating our own strip beside it would just be noise.
      dockEmbed.innerHTML = html;
      dockFrame.innerHTML = '';
      document.getElementById('pf-dock-out').href = ref;
      document.body.classList.add(`has-dock-${src}`);
    }
    document.getElementById('pf-dock-expand').hidden = src !== 'youtube';
    dock.hidden = false;
    document.body.classList.add('has-dock');
    return true;
  };

  const openLightbox = id => {
    lightboxFrame.innerHTML = ytFrame(id);
    lightbox.hidden = false;
    document.body.style.overflow = 'hidden';
  };
  const closeLightbox = () => {
    lightboxFrame.innerHTML = '';
    lightbox.hidden = true;
    document.body.style.overflow = '';
  };

  document.getElementById('pf-dock-close').addEventListener('click', close);
  document.getElementById('pf-dock-expand').addEventListener('click', () => {
    if (!playing || playing.src !== 'youtube') return;
    dockFrame.innerHTML = '';        // only one thing plays at a time
    openLightbox(playing.ref);
  });
  document.getElementById('pf-lightbox-close').addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', e => { if (e.target === lightbox) closeLightbox(); });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (!lightbox.hidden) closeLightbox();
    else if (!dock.hidden) close();
  });

  /* openLightbox is exposed because some things are not dock material. A music
     video is the record itself, not background listening, so it opens big. */
  return { play, close, lightbox: openLightbox, closeLightbox };
}
