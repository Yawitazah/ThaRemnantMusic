import { store, bench } from '../data.js';
import { fmt, esc, stat, card } from '../ui.js';

/** YouTube artwork. maxres is not always generated; hq always is, so fall back. */
export const art = id => `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;
export const artFallback = id => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
export const imgTag = (id, alt, cls = '') => id
  ? `<img class="${cls}" src="${art(id)}" alt="${esc(alt)}" loading="lazy"
       onerror="this.onerror=null;this.src='${artFallback(id)}'">`
  : '';

const STATUS_CLASS = {
  'pushing now':   'p-crit',
  released:        'p-info',
  'in production': 'p-warn',
  planned:         'p-mute',
};

export function render() {
  const b = bench();
  const projects = store.projects || [];
  const now = projects.find(p => p.status === 'pushing now') || projects[0];
  const rest = projects.filter(p => p !== now);
  const gt = store.channels.find(c => c.stage === 'established');
  const album = store.catalog.filter(t => (t.artists || []).includes('album'));
  const albumAvg = album.length
    ? Math.round(album.reduce((s, t) => s + t.views, 0) / album.length) : 0;

  const projCard = p => `
    <article class="proj">
      <div class="proj-art">
        <span class="badge ${STATUS_CLASS[p.status] || 'p-mute'} tag">${esc(p.status)}</span>
        ${imgTag(p.art_video_id, p.title)}
      </div>
      <div class="proj-body">
        <h4>${esc(p.title)}</h4>
        <div class="proj-meta">${esc(p.artist)}${p.kind ? ' · ' + esc(p.kind) : ''}${
          p.track_count ? ' · ' + p.track_count + ' tracks' : ''}${
          p.release_label ? ' · ' + esc(p.release_label) : ''}</div>
        <p>${esc(p.blurb || '')}</p>
      </div>
    </article>`;

  const heroId = now?.hero_video_id || now?.art_video_id || '';

  return `
<section class="hero" data-hero-video="${esc(heroId)}">
  ${heroId
    ? `<img class="hero-bg" src="${art(heroId)}" alt="${esc(now.title)}"
         onerror="this.onerror=null;this.src='${artFallback(heroId)}'">
       <div class="hero-video" id="hero-video"><div id="hero-player"></div></div>
       <div class="hero-note" id="hero-note" hidden></div>`
    : ''}
  <div class="hero-body">
    <div class="hero-eyebrow">
      <span class="badge p-crit">pushing now</span> Tha Remnant Music Group
    </div>
    <h1>${esc(now?.title || 'NO REMEDY')}</h1>
    <p class="sub-line">${esc(now?.blurb || '')}</p>
    <div class="hero-stats">
      <div class="hero-stat"><div class="n">${fmt(b.noRemedyBig)}</div>
        <div class="l">views on the 237K channel</div></div>
      <div class="hero-stat"><div class="n">${(b.noRemedyBig / b.noRemedySmall).toFixed(1)}×</div>
        <div class="l">lift over the music channel</div></div>
      <div class="hero-stat"><div class="n">${fmt(gt?.subs || 237000)}</div>
        <div class="l">audience the label owns</div></div>
    </div>
    <div class="hero-actions">
      <a class="btn" href="https://www.youtube.com/watch?v=${esc(now?.hero_video_id || 'wQwwd6zu62A')}"
         target="_blank" rel="noopener">Watch the video</a>
      <a class="btn ghost" href="#executive">Read the brief</a>
      <a class="btn ghost" href="https://nubreedglobaltruth.com/" target="_blank" rel="noopener">The store</a>
    </div>
  </div>
</section>

${card(`
  <h2>Where the label stands today</h2>
  <p class="muted sm">The numbers behind the record above, and the gap the whole plan is built to close.</p>
  <div class="grid g4" style="margin-top:14px">
    ${stat('Commentary audience', fmt(gt?.subs || 237000), `~${fmt(b.gtAvg)} views a video, near-daily`, 'good')}
    ${stat('The album', fmt(albumAvg), 'average views a track', 'crit')}
    ${stat('Proven ceiling', fmt(b.topTenAvg), 'his own top-10 average')}
    ${stat('Catalog', fmt(store.catalog.length), 'tracks across four channels')}
  </div>
  <div class="callout crit" style="margin-top:16px">
    <strong>One song has been posted to both channels.</strong> NO REMEDY did ${fmt(b.noRemedyBig)}
    on the 237,000-subscriber commentary channel and ${fmt(b.noRemedySmall)} on the 18,400-subscriber
    music channel — same song, same week. That single result is the argument for everything else in
    this dashboard.
  </div>`)}

${card(`
  <h2>The slate</h2>
  <p class="muted sm">What is out, what is being pushed, and what is coming next.</p>
  <div class="proj-grid" style="margin-top:16px">
    ${projects.map(projCard).join('')}
  </div>`)}

${card(`
  <h2>The roster</h2>
  <p class="muted sm">Four people. Open the Artists tab for the full profile on each.</p>
  <div class="proj-grid" style="margin-top:16px">
    ${(store.profiles || []).map(a => `
      <article class="proj">
        <div class="proj-art" style="aspect-ratio:1">
          ${a.image_url
            ? `<img src="${esc(a.image_url)}" alt="${esc(a.artist)}">`
            : imgTag(a.image_video_id, a.artist)}
        </div>
        <div class="proj-body">
          <h4>${esc(a.artist)}</h4>
          <div class="proj-meta">${esc(a.role || '')}</div>
          <p>${esc(a.tagline || '')}</p>
        </div>
      </article>`).join('')}
  </div>`)}`;
}

/* ------------------------------------------------------------------ *
 * Hero background video.
 *
 * The still image is always painted first. The player is layered over it
 * and only faded in once YouTube reports it is actually playing, so a
 * blocked embed (error 101/150/153 — "Allow embedding" switched off)
 * leaves the artwork untouched rather than showing an error panel.
 * ------------------------------------------------------------------ */

let apiPromise = null;
function youtubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(window.YT); };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = () => reject(new Error('YouTube API failed to load'));
    document.head.appendChild(s);
    setTimeout(() => reject(new Error('YouTube API timed out')), 8000);
  });
  return apiPromise;
}

const EMBED_BLOCKED = new Set([101, 150, 153]);

export function bind(mount) {
  const hero  = mount.querySelector('.hero[data-hero-video]');
  const layer = mount.querySelector('#hero-video');
  const note  = mount.querySelector('#hero-note');
  const id    = hero?.dataset.heroVideo;
  if (!hero || !layer || !id) return;

  const blocked = msg => {
    layer.classList.remove('on');
    layer.innerHTML = '';
    if (!note) return;
    note.hidden = false;
    note.innerHTML = msg;
  };

  youtubeApi().then(YT => {
    let player;
    player = new YT.Player('hero-player', {
      videoId: id,
      playerVars: {
        autoplay: 1, mute: 1, controls: 0, loop: 1, playlist: id,
        modestbranding: 1, rel: 0, playsinline: 1, disablekb: 1,
        iv_load_policy: 3, fs: 0,
      },
      events: {
        onReady: e => { e.target.mute(); e.target.playVideo(); },
        onStateChange: e => {
          // Fade in only on real playback, and restart rather than trusting `loop`.
          if (e.data === YT.PlayerState.PLAYING) layer.classList.add('on');
          if (e.data === YT.PlayerState.ENDED) { player.seekTo(0); player.playVideo(); }
        },
        onError: e => {
          if (EMBED_BLOCKED.has(e.data)) {
            blocked('<strong>Embedding is off</strong> for this video, so it can\'t play here — '
                  + 'the same reason no blog or EPK can show it. Turn on "Allow embedding" in '
                  + 'YouTube Studio and this hero starts playing on its own.');
          } else {
            blocked('Video could not load (error ' + e.data + ').');
          }
        },
      },
    });
  }).catch(() => {
    // No API, no autoplay — the artwork alone is a perfectly good hero.
    layer.remove();
  });
}
