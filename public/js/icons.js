// Social platform icons, drawn as single-colour paths so a row of them reads
// as one set rather than a pile of brand logos in competing colours.

const P = {
  youtube:  'M23 12s0-3.9-.5-5.8a3 3 0 0 0-2.1-2.1C18.5 3.6 12 3.6 12 3.6s-6.5 0-8.4.5A3 3 0 0 0 1.5 6.2C1 8.1 1 12 1 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.5 8.4.5 8.4.5s6.5 0 8.4-.5a3 3 0 0 0 2.1-2.1C23 15.9 23 12 23 12ZM9.8 15.6V8.4l6.2 3.6-6.2 3.6Z',
  spotify:  'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4.6 14.4a.8.8 0 0 1-1.1.3c-3-1.8-6.7-2.2-11.1-1.2a.8.8 0 1 1-.3-1.5c4.8-1.1 8.9-.6 12.2 1.4.4.2.5.7.3 1Zm1.2-2.7a1 1 0 0 1-1.3.3c-3.4-2.1-8.6-2.7-12.6-1.5a1 1 0 0 1-.6-1.9c4.6-1.4 10.3-.7 14.2 1.7.4.3.6.9.3 1.4Zm.1-2.8C14.8 8.5 8.3 8.3 4.7 9.4a1.2 1.2 0 1 1-.7-2.3C8.2 5.8 15.4 6 19.7 8.6a1.2 1.2 0 1 1-1.2 2.1l-.6-.8Z',
  apple:    'M17.6 12.7c0-2.4 2-3.6 2.1-3.7-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.6.9-.8 0-1.9-.9-3.1-.8-1.6 0-3.1.9-3.9 2.4-1.7 2.9-.4 7.2 1.2 9.5.8 1.2 1.7 2.4 3 2.4 1.2 0 1.6-.8 3.1-.8s1.9.8 3.1.7c1.3 0 2.1-1.2 2.9-2.3.9-1.3 1.3-2.6 1.3-2.7-.1 0-2.5-1-2.6-3.7ZM15.2 5.3c.7-.8 1.1-2 1-3.1-1 0-2.2.6-2.9 1.5-.6.7-1.2 1.9-1 3 1.1.1 2.2-.6 2.9-1.4Z',
  instagram:'M12 2.2c3.2 0 3.6 0 4.9.1 1.2 0 1.8.3 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.4 1 .4 2.2.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c0 1.2-.3 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .4-2.2.4-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2 0-1.8-.3-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.4-1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.9c0-1.2.3-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.4 2.2-.4C8.4 2.2 8.8 2.2 12 2.2Zm0 6.3a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm0 5.8a2.3 2.3 0 1 1 0-4.6 2.3 2.3 0 0 1 0 4.6Zm4.5-5.9a.8.8 0 1 1-1.6 0 .8.8 0 0 1 1.6 0Z',
  tiktok:   'M16.6 5.8a4.8 4.8 0 0 1-1.2-3.2h-3.3v13a2.5 2.5 0 1 1-1.8-2.4V9.7a5.8 5.8 0 1 0 5 5.7V9.1a8 8 0 0 0 4.6 1.5V7.3a4.8 4.8 0 0 1-3.3-1.5Z',
  facebook: 'M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.7-3.9 1.1 0 2.2.2 2.2.2v2.4h-1.2c-1.2 0-1.6.8-1.6 1.6V12h2.7l-.4 2.9h-2.3v7A10 10 0 0 0 22 12Z',
  x:        'M18.2 2.3h3.3l-7.2 8.2 8.5 11.2h-6.7l-5.2-6.8-6 6.8H1.6l7.7-8.8L1.1 2.3h6.8l4.7 6.2 5.6-6.2Zm-1.2 17.6h1.8L7.1 4.1H5.2l11.8 15.8Z',
  soundcloud:'M1.5 14.3c0-.2-.1-.3-.2-.3s-.2.1-.2.3l-.2 1.4.2 1.4c0 .2.1.3.2.3s.2-.1.2-.3l.2-1.4-.2-1.4Zm1.4-.9c0-.2-.1-.3-.3-.3s-.3.1-.3.3l-.2 2.3.2 2.2c0 .2.1.3.3.3s.3-.1.3-.3l.3-2.2-.3-2.3Zm1.5-.6c0-.2-.2-.4-.4-.4s-.4.2-.4.4L3.4 15.7l.2 2.6c0 .2.2.4.4.4s.4-.2.4-.4l.3-2.6-.3-2.9Zm1.5-.2c0-.3-.2-.5-.5-.5s-.5.2-.5.5l-.2 3.1.2 2.6c0 .3.2.5.5.5s.5-.2.5-.5l.2-2.6-.2-3.1Zm1.6.3c0-.3-.2-.5-.5-.5s-.5.2-.5.5l-.2 2.8.2 2.6c0 .3.2.5.5.5s.5-.2.5-.5l.2-2.6-.2-2.8Zm1.6-2.4c-.3 0-.6.3-.6.6l-.2 5.2.2 2.5c0 .3.3.6.6.6s.6-.3.6-.6l.2-2.5-.2-5.2c0-.3-.3-.6-.6-.6Zm1.7-.9c-.4 0-.6.3-.7.6l-.2 6.1.2 2.5c0 .3.3.6.7.6s.6-.3.6-.6l.2-2.5-.2-6.1c0-.3-.3-.6-.6-.6Zm1.8-.4c-.4 0-.7.3-.7.7l-.1 6.4.1 2.4c0 .4.3.7.7.7s.7-.3.7-.7l.2-2.4-.2-6.4c0-.4-.3-.7-.7-.7Zm9.4 3.8c-.4 0-.8.1-1.1.2-.3-2.9-2.8-5.2-5.8-5.2-.7 0-1.4.1-2 .4-.2.1-.3.2-.3.5v9.6c0 .3.2.5.5.5h8.7a3 3 0 0 0 0-6Z',
  website:  'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm6.9 6h-2.9a15.6 15.6 0 0 0-1.4-3.6A8 8 0 0 1 18.9 8ZM12 4.1c.7 1 1.3 2.3 1.7 3.9h-3.4c.4-1.6 1-2.9 1.7-3.9ZM4.3 14a8 8 0 0 1 0-4h3.3a17 17 0 0 0 0 4H4.3Zm.8 2h2.9c.3 1.3.8 2.5 1.4 3.6A8 8 0 0 1 5.1 16Zm2.9-8H5.1a8 8 0 0 1 4.3-3.6A15.6 15.6 0 0 0 8 8Zm4 11.9c-.7-1-1.3-2.3-1.7-3.9h3.4c-.4 1.6-1 2.9-1.7 3.9ZM14.1 14H9.9a15 15 0 0 1 0-4h4.2a15 15 0 0 1 0 4Zm.5 5.6c.6-1.1 1.1-2.3 1.4-3.6h2.9a8 8 0 0 1-4.3 3.6Zm1.8-5.6a17 17 0 0 0 0-4h3.3a8 8 0 0 1 0 4h-3.3Z',
  link:     'M10.6 13.4a1 1 0 0 0 1.4 0l3.5-3.5a3.5 3.5 0 1 0-5-5l-1.2 1.2a1 1 0 0 0 1.4 1.4l1.2-1.2a1.5 1.5 0 1 1 2.1 2.1l-3.4 3.5a1 1 0 0 0 0 1.4Zm2.8-2.8a1 1 0 0 0-1.4 0l-3.5 3.5a3.5 3.5 0 1 0 5 5l1.2-1.2a1 1 0 0 0-1.4-1.4l-1.2 1.2a1.5 1.5 0 1 1-2.1-2.1l3.4-3.5a1 1 0 0 0 0-1.4Z',
  store:    'M5.2 3h13.6a1 1 0 0 1 .95.68l1.2 3.6A3.1 3.1 0 0 1 19 11.4V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8.6a3.1 3.1 0 0 1-1.95-4.12l1.2-3.6A1 1 0 0 1 5.2 3Zm.72 2-.97 2.9a1.1 1.1 0 0 0 2.13.5L7.6 5H5.92Zm3.72 0-.5 3.05a1.1 1.1 0 0 0 2.18.3L11.6 5H9.64Zm4 0 .48 3.35a1.1 1.1 0 0 0 2.18-.3L15.8 5h-2.16Zm4.16 0 .62 3.4a1.1 1.1 0 0 0 2.13-.5L19.58 5h-1.78ZM17 12.15a3.1 3.1 0 0 1-2.4-.9 3.1 3.1 0 0 1-4.6 0 3.1 3.1 0 0 1-2.4.9V19h3v-4.2h3.4V19H17v-6.85Z',
  patreon:  'M15.4 3.2c-3.9 0-7.1 3.2-7.1 7.1 0 3.9 3.2 7 7.1 7 3.9 0 7-3.1 7-7 0-3.9-3.1-7.1-7-7.1ZM2 20.8h3.5V3.2H2v17.6Z',
};

/* Match a link to an icon by its label first, then by where it points — a hub
   link can be titled anything, but the destination rarely lies. */
/* A store has to be recognised before the generic ".com" rule below catches it,
   or every merch site reads as a plain website. */
const STORE_RE = /store|shop(?!ify\.dev)|merch|apparel|bigcartel|big-cartel|shopify|myshopify|teespring|teepublic|bonfire|spreadshop|spreadshirt|printful|redbubble|etsy|gumroad|square\.site|squarespace|ecwid|sellfy|fourthwall/i;
const SUPPORT_RE = /patreon|ko-?fi|buymeacoffee|cash\.app|venmo|paypal\.me|gofundme|substack|memberful/i;

export function iconFor(label = '', url = '') {
  const s = `${label} ${url}`.toLowerCase();
  if (/youtu/.test(s)) return 'youtube';
  if (/spotify/.test(s)) return 'spotify';
  if (/apple|itunes/.test(s)) return 'apple';
  if (/instagram|(^|\W)ig(\W|$)/.test(s)) return 'instagram';
  if (/tiktok/.test(s)) return 'tiktok';
  if (/facebook|fb\.com/.test(s)) return 'facebook';
  if (/twitter|x\.com|(^|\W)x(\W|$)/.test(s)) return 'x';
  if (/soundcloud/.test(s)) return 'soundcloud';
  if (/patreon/.test(s)) return 'patreon';
  if (STORE_RE.test(s)) return 'store';
  if (SUPPORT_RE.test(s)) return 'store';
  if (/last\.fm|website|\.com|\.org|\.net/.test(s)) return 'website';
  return 'link';
}

export function socialIcon(name, size = 20) {
  const d = P[name] || P.link;
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="currentColor"
    aria-hidden="true" focusable="false"><path d="${d}"/></svg>`;
}

/* Where a link belongs.
   The icon row is social only: Instagram, TikTok, X, Facebook and the like.
   Those are places to follow someone, and a bare icon is enough because the
   glyph itself says where it goes.
   Everything else is a labelled button in the list. A store is the case that
   forced this: sitting in the icon row, nobody could tell it was the merch
   shop, so nobody clicked it. The same goes for Patreon, a personal site or
   anything unrecognised — if a visitor has to guess, it gets a name. */
const SOCIAL = new Set(['instagram', 'tiktok', 'facebook', 'x']);
export const isSocialLink = (label = '', url = '') => SOCIAL.has(iconFor(label, url))
  || /threads\.net|snapchat|linkedin|reddit|pinterest|discord|telegram|whatsapp/i.test(`${label} ${url}`);

/** Anything that is not a social profile earns a named button. */
export const isListedLink = (label = '', url = '') => !isSocialLink(label, url);

const MUSIC = new Set(['youtube', 'spotify', 'apple', 'soundcloud']);
export const isMusicLink = (label = '', url = '') => MUSIC.has(iconFor(label, url))
  || /deezer|tidal|audiomack|bandcamp|amazon|pandora|boomplay/i.test(`${label} ${url}`);

export const isStoreLink = (label = '', url = '') => iconFor(label, url) === 'store';

/* A SoundCloud link is music, and it can be played on the page rather than
   sending someone away, so it gets a play button instead of an arrow. */
export const isPlayableLink = (label = '', url = '') => /soundcloud\.com\//i.test(`${url}`);

/* Count up to a number, so a figure lands rather than just appearing.
   The markup already contains the real value — this only replays it from zero.
   If anything here never runs (no observer callbacks in a background tab,
   reduced motion, JS disabled), the correct figure is what stays on screen. */
export function rollNumber(el, to, ms = 1100) {
  if (!el || !isFinite(to)) return;
  if (typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const start = performance.now();
  const step = now => {
    const p = Math.min(1, (now - start) / ms);
    // ease-out: quick off the mark, settles onto the real figure
    el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))).toLocaleString();
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/** Replay every [data-roll] inside `root` as it comes into view. */
export function rollAll(root) {
  const els = [...root.querySelectorAll('[data-roll]')];
  if (!els.length) return;
  const run = el => rollNumber(el, +el.dataset.roll);
  if (!('IntersectionObserver' in window)) return els.forEach(run);
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      run(en.target);
      io.unobserve(en.target);
    });
  }, { threshold: .4 });
  els.forEach(el => io.observe(el));
}

/** A single-colour row of social icons. `links` = [{label, url, id?}] */
export function socialRow(links, { size = 20, cls = 'social-row' } = {}) {
  if (!links?.length) return '';
  return `<div class="${cls}">${links.map(l => {
    const name = iconFor(l.label, l.url);
    return `<a href="${l.url}" target="_blank" rel="noopener" title="${l.label}"
      aria-label="${l.label}"${l.id ? ` data-link-id="${l.id}"` : ` data-label="${l.label}"`}
      >${socialIcon(name, size)}</a>`;
  }).join('')}</div>`;
}
