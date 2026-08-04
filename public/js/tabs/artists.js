import { store, canEditHub, updateRow, insertRow, deleteRow, sb,
         saveProfile, uploadArtistPhoto } from '../data.js';
import { fmt, esc, stat, card, hbar, bindBars, line, toast } from '../ui.js';
import { imgTag } from './now.js';

let current = null;
let editorOpen = false;
let profileOpen = false;
let range = '28d'; // growth window: 7d | 28d | all

/** Called by the router when the URL is #artists/<name>. */
export function setArg(name) { if (name) current = name; }

const list = () => (store.profiles || []);

const dsp = (url, label) => url
  ? `<a class="btn sm ghost" href="${esc(url)}" target="_blank" rel="noopener">${label}</a> `
  : `<span class="badge p-mute" title="not on ${label}">—</span> `;

/** One block of the discography. `credit` shows who the record is released under. */
const releaseTable = (heading, rows, credit) => !rows.length ? '' : `
  <h4 style="margin:20px 0 8px">${esc(heading)}</h4>
  <table class="sm"><tbody>
    ${rows.map(r => `
      <tr>
        <td>
          <strong>${esc(r.title)}</strong>
          ${credit && r.credited_to ? `<span class="muted sm"> · ${esc(r.credited_to)}</span>` : ''}
          ${r.note ? `<br><span class="muted sm">${esc(r.note)}</span>` : ''}
        </td>
        <td class="muted sm" style="width:110px;white-space:nowrap">${
          credit ? (r.year || '') : esc(r.kind || '') + (r.year ? ' · ' + r.year : '')}</td>
        <td class="r" style="width:240px;white-space:nowrap">
          ${dsp(r.spotify_url, 'Spotify')}${dsp(r.apple_url, 'Apple')}${dsp(r.youtube_url, 'YouTube')}
        </td>
      </tr>`).join('')}
  </tbody></table>`;

const swot = (cls, title, items) => !items || !items.length ? '' : `
  <div class="swot-box ${cls}">
    <h4>${esc(title)}</h4>
    <ul>${items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>
  </div>`;

/* ---------- link-hub growth ---------- */

const ago = iso => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 90) return 'just now';
  if (s < 5400) return Math.round(s / 60) + 'm ago';
  if (s < 129600) return Math.round(s / 3600) + 'h ago';
  return Math.round(s / 86400) + 'd ago';
};

/* Windows the growth card can be read through. `days` slices the daily series;
   `all` deliberately carries no cap, because a capped all-time is a lie. */
const RANGES = [
  { k: '24h', label: '24 hours', days: 1,    suffix: '24h' },
  { k: '7d',  label: '7 days',   days: 7,    suffix: '7d'  },
  { k: '28d', label: '28 days',  days: 28,   suffix: '28d' },
  { k: 'all', label: 'All time', days: null, suffix: 'total' },
];

/* Both the chart and its tooltips read from here, so a hover can never report a
   different number than the bar it is sitting on. */
const linkRowsFor = h => {
  const sfx = (RANGES.find(x => x.k === range) || RANGES[2]).suffix;
  return (h?.links || [])
    .map(l => ({ k: l.label, v: sfx === 'total' ? l.clicks : (l[`clicks_${sfx}`] ?? l.clicks) }))
    .filter(l => l.v > 0);
};

const clockTime = iso => new Date(iso.length <= 16 ? iso + ':00' : iso)
  .toLocaleTimeString(undefined, { hour: 'numeric' });

const dayLabel = d => new Date(d + 'T00:00:00')
  .toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

/* A number on its own says nothing. Comparing a window to the one before it is
   the difference between a total and actual growth. */
function delta(now, prev) {
  if (prev === null || prev === undefined) return '';
  if (!prev && !now) return '<span class="delta flat">no change</span>';
  if (!prev) return `<span class="delta up">new</span>`;
  const pct = Math.round(((now - prev) / prev) * 100);
  if (pct === 0) return '<span class="delta flat">flat</span>';
  const cls = pct > 0 ? 'up' : 'down';
  return `<span class="delta ${cls}">${pct > 0 ? '▲' : '▼'} ${Math.abs(pct)}%</span>`;
}

/* ---------- artist-owned page editing ---------- */

function profileEditor(a) {
  if (!canEditHub(a.artist)) return '';
  const releases = (store.releases || []).filter(r => r.artist === a.artist);

  return card(`
    <div class="spread" style="flex-wrap:wrap;gap:10px">
      <div>
        <h3 style="margin:0">Your page</h3>
        <p class="muted sm" style="margin:.3em 0 0">Photo, bio and the record you want up top.
        This is what visitors see on your public profile.</p>
      </div>
      <button class="btn sm ghost" id="pf-edit-toggle" type="button">
        ${profileOpen ? 'Close' : 'Edit page'}</button>
    </div>

    <div id="pf-editor" ${profileOpen ? '' : 'hidden'} style="margin-top:16px">
      <div class="pf-edit-grid">
        <div>
          <div class="pf-edit-photo" id="pf-photo-preview">
            ${a.image_url
              ? `<img src="${esc(a.image_url)}" alt="">`
              : '<span class="muted sm">No photo yet</span>'}
          </div>
          <label class="btn sm ghost" style="margin-top:8px;display:inline-block;cursor:pointer">
            Choose photo
            <input type="file" id="pf-photo" accept="image/jpeg,image/png,image/webp" hidden>
          </label>
          <p class="muted sm" id="pf-photo-note" style="margin:.5em 0 0">JPG, PNG or WebP, up to 8MB. Square works best.</p>
        </div>
        <div>
          <label>Tagline <span class="muted sm">one line, shown under your name</span>
            <input type="text" id="pf-tagline" value="${esc(a.tagline || '')}" maxlength="160"></label>
          <label>Bio
            <textarea id="pf-bio" rows="6">${esc(a.bio || '')}</textarea></label>
          <label>Hometown
            <input type="text" id="pf-hometown" value="${esc(a.hometown || '')}" maxlength="120"></label>
          <label>Artist pick <span class="muted sm">the release you want featured</span>
            <select id="pf-pick">
              <option value="">— none —</option>
              ${releases.map(r => `<option value="${r.id}" ${r.id === a.pick_release_id ? 'selected' : ''}>
                ${esc(r.title)}${r.year ? ' (' + r.year + ')' : ''}</option>`).join('')}
            </select></label>
          <label>Why this one <span class="muted sm">optional note beside the pick</span>
            <input type="text" id="pf-picknote" value="${esc(a.pick_note || '')}" maxlength="160"></label>
          <div class="row" style="margin-top:12px">
            <button class="btn sm" id="pf-save" type="button">Save page</button>
            <a class="btn sm ghost" href="/artist/${esc(a.slug || '')}" target="_blank" rel="noopener">Preview</a>
          </div>
        </div>
      </div>
    </div>`, 'profile-editor-card');
}

function growth(a) {
  const h = (store.hub || {})[a.artist];
  const slug = a.slug || a.artist.toLowerCase().replace(/\s+/g, '');
  const hubUrl = `${location.origin}/a/${slug}`;
  const canEdit = canEditHub(a.artist);

  const win = RANGES.find(x => x.k === range);
  const sfx = win.suffix;
  const rangeLabel = win.label.toLowerCase();

  const n = key => h?.[key] || 0;
  const views  = n(`views_${sfx}`);
  const clicks = n(`clicks_${sfx}`);
  const plays  = n(`plays_${sfx}`);
  const captures = n(`captures_${sfx}`);
  // All time has nothing before it to compare against.
  const prev = key => range === 'all' ? null : (h?.[`${key}_prev_${sfx}`] ?? 0);
  /* Reported as a rate, not a percentage: one visitor can play a track and then
     tap three platforms, so this legitimately goes above 1 and a "117%
     click-through" would just look broken. */
  const perVisit = views ? (clicks + plays) / views : 0;
  const perVisitText = perVisit >= 1
    ? `${perVisit.toFixed(1)} plays or clicks out per visit`
    : `${Math.round(perVisit * 100)}% of visits turned into a play or a click out`;

  /* 24 hours reads as hour buckets; everything longer reads as days. */
  const cutoff = win.days === null ? 0 : Date.now() - win.days * 86400_000;
  const series = range === '24h'
    ? (h?.hourly || []).map(x => ({ k: clockTime(x.h), v: x.views }))
    : (h?.daily || [])
        .filter(d => new Date(d.d + 'T00:00:00').getTime() >= cutoff)
        .map(d => ({ k: dayLabel(d.d), v: d.views }));
  const seriesNote = range === '24h' ? 'hourly hub views' : 'daily hub views';

  const linkRows = linkRowsFor(h);

  /* Per release and track, the thing that was actually missing: how many times
     each one was played and how many times it was clicked out to a platform. */
  const items = (h?.items || [])
    .map(i => ({
      item: i.item,
      plays:  range === 'all' ? i.plays  : (i[`plays_${sfx}`]  ?? 0),
      clicks: range === 'all' ? i.clicks : (i[`clicks_${sfx}`] ?? 0),
      last_at: i.last_at,
    }))
    .filter(i => i.plays + i.clicks > 0)
    .sort((x, y) => (y.plays + y.clicks) - (x.plays + x.clicks));

  const itemTable = !items.length ? '' : `
    <h4 style="margin:20px 0 6px">Every release, by the numbers</h4>
    <p class="muted sm" style="margin:0 0 10px">Plays are taps on the player. Clicks left the page for a platform. Window: ${esc(rangeLabel)}.</p>
    <table class="sm hub-items"><thead><tr>
      <th>Release or track</th><th class="r">Played</th><th class="r">Clicked out</th><th class="r">Last</th>
    </tr></thead><tbody>
      ${items.map(i => `
        <tr>
          <td><strong>${esc(i.item)}</strong></td>
          <td class="r">${i.plays ? fmt(i.plays) : '<span class="muted">0</span>'}</td>
          <td class="r">${i.clicks ? fmt(i.clicks) : '<span class="muted">0</span>'}</td>
          <td class="r muted sm" style="white-space:nowrap">${i.last_at ? esc(ago(i.last_at)) : '—'}</td>
        </tr>`).join('')}
    </tbody></table>`;

  /* The old feed printed the raw event name and left the reader to guess. Each
     row is now one plain sentence: who, what, where from. */
  const PAGE_NAME = { hub: 'the link hub', profile: 'the artist page', label: 'the label page' };
  const sentence = r => {
    const where = PAGE_NAME[r.page] || 'the link hub';
    if (r.event === 'view')    return `opened <strong>${esc(where)}</strong>`;
    if (r.event === 'capture') return `joined the mailing list from <strong>${esc(where)}</strong>`;
    if (r.event === 'play')    return `played <strong>${esc(r.item || r.label || 'a track')}</strong>`;
    if (r.item)                return `clicked through to <strong>${esc(r.label || r.item)}</strong>`;
    return `tapped <strong>${esc(r.label || 'a link')}</strong>`;
  };
  const VERB = { view: 'Visit', click: 'Click', play: 'Play', capture: 'New fan' };
  const recent = (store.hubRecent || []).filter(x => x.artist === a.artist).slice(0, 10);

  const feed = !recent.length ? '' : `
    <h4 style="margin:22px 0 6px">Latest activity</h4>
    <p class="muted sm" style="margin:0 0 10px">The last ${recent.length} thing${recent.length === 1 ? '' : 's'}
      ${esc(a.artist)}'s visitors did, newest first. Each row is one action by one visitor.</p>
    <ul class="hub-feed">${recent.map(r => `
      <li>
        <span class="badge ${r.event === 'capture' ? 'p-good' : r.event === 'play' ? 'p-info'
          : r.event === 'click' ? 'p-info' : 'p-mute'}">${esc(VERB[r.event] || r.event)}</span>
        <span class="hub-feed-what">A visitor ${sentence(r)}${r.ref ? `, arriving from ${esc(r.ref)}` : ''}.</span>
        <span class="muted sm hub-feed-when">${esc(ago(r.at))}</span>
      </li>`).join('')}
    </ul>`;

  const editor = !canEdit ? '' : `
    <div id="hub-editor" ${editorOpen ? '' : 'hidden'}>
      <h4 style="margin:20px 0 4px">Hub links</h4>
      <p class="muted sm" style="margin:0 0 10px">Label, destination, on/off. Order here is the order on the page.</p>
      <div id="hub-editor-rows">
        ${(store.hubLinks || []).filter(l => l.artist === a.artist).map(l => `
          <div class="hub-edit-row" data-id="${l.id}">
            <input type="text" class="he-label" value="${esc(l.label)}" placeholder="Label">
            <input type="text" class="he-url" value="${esc(l.url)}" placeholder="https://…">
            <label class="he-active" title="Show on the hub"><input type="checkbox" ${l.active ? 'checked' : ''}></label>
            <button class="btn sm ghost he-up" type="button" title="Move up">↑</button>
            <button class="btn sm ghost he-down" type="button" title="Move down">↓</button>
            <button class="btn sm ghost he-del" type="button" title="Remove">×</button>
          </div>`).join('')}
      </div>
      <div class="row" style="margin-top:10px">
        <button class="btn sm ghost" id="hub-add" type="button">+ Add link</button>
        <button class="btn sm" id="hub-save" type="button">Save changes</button>
      </div>
    </div>`;

  return card(`
    <div class="spread" style="flex-wrap:wrap;gap:10px">
      <div>
        <h3 style="margin:0">Growth</h3>
        <p class="muted sm" style="margin:.3em 0 0">First-party numbers from the public pages. Every view, play and button press,
          measured here rather than borrowed from a platform.</p>
      </div>
      <div class="row">
        <a class="btn sm ghost" href="${esc(hubUrl)}" target="_blank" rel="noopener">View hub</a>
        <button class="btn sm ghost" id="hub-copy" data-url="${esc(hubUrl)}" type="button">Copy link</button>
        ${canEdit ? `<button class="btn sm ghost" id="hub-edit-toggle" type="button">${editorOpen ? 'Close editor' : 'Edit hub'}</button>` : ''}
      </div>
    </div>

    <div class="row" style="margin-top:14px">
      ${RANGES.map(x => `<button class="chip ${range === x.k ? 'on' : ''}" data-range="${x.k}">${x.label}</button>`).join('')}
    </div>

    <div class="grid g4" style="margin-top:12px">
      ${stat(`Page views · ${rangeLabel}`, fmt(views),
          `${delta(views, prev('views'))} ${fmt(h?.views_total || 0)} all time`)}
      ${stat(`Tracks played · ${rangeLabel}`, fmt(plays),
          `${delta(plays, prev('plays'))} ${fmt(h?.plays_total || 0)} all time`)}
      ${stat(`Clicks out · ${rangeLabel}`, fmt(clicks),
          `${delta(clicks, prev('clicks'))} ${fmt(h?.clicks_total || 0)} all time`)}
      ${stat('Fans captured', fmt(captures),
          range === 'all' ? 'via the email form' : `${fmt(h?.captures_total || 0)} all time`,
          h?.captures_total ? 'good' : '')}
    </div>

    <p class="muted sm" style="margin:10px 0 0">
      ${views ? esc(perVisitText) : 'No visits in this window yet'}${
        h?.views_profile ? ` · ${fmt(h.views_hub || 0)} on the link hub, ${fmt(h.views_profile)} on the artist page` : ''}.
    </p>

    ${series.length >= 2 ? `<div style="margin-top:16px">${line(series, { aria: seriesNote })}</div>`
      : series.length === 1 ? `<p class="muted sm" style="margin-top:12px">The ${range === '24h' ? 'hourly' : 'daily'} chart appears once there are two ${range === '24h' ? 'hours' : 'days'} of traffic in this window.</p>` : ''}
    ${linkRows.length ? `<h4 style="margin:18px 0 8px">Clicks by destination · ${esc(rangeLabel)}</h4><div id="hub-bars">${hbar(linkRows, { aria: 'clicks per link' })}</div>` : ''}
    ${itemTable}
    ${!h ? `<div class="callout" style="margin-top:14px"><strong>No traffic yet.</strong>
      Share the hub link. Every visit and tap lands here the moment it happens.</div>` : ''}
    ${feed}
    ${editor}`, 'growth-card');
}

export function render() {
  const people = list();
  if (!people.length) return card('<p class="muted">No artist profiles yet.</p>');
  if (!current || !people.some(p => p.artist === current)) current = people[0].artist;
  const a = people.find(p => p.artist === current);

  const channel = store.channels.find(c => c.artist_name === a.artist && c.subs > 0);
  const roster  = store.roster.find(r => r.name === a.artist);
  const tracks  = store.catalog.filter(t => {
    const tag = { BREED: 'breed', 'King Konnect': 'king', JayThaRealist: 'jay', Yawitazah: 'zah' }[a.artist];
    return tag && (t.artists || []).includes(tag);
  }).sort((x, y) => y.views - x.views);
  const top = tracks.slice(0, 6);
  const totalViews = tracks.reduce((s, t) => s + t.views, 0);
  const projects = (store.projects || []).filter(p => p.artist === a.artist);

  // Everywhere this artist can be found, and everything they have put out.
  // One button per destination. The channel row and the platforms row often point
  // at the same URL, so key on the URL — but keep genuinely separate channels
  // (BREED runs two) and tell them apart by their handle.
  const links = [];
  const seenUrl = new Set();
  const key = u => (u || '').replace(/\/+$/, '').toLowerCase();
  const addLink = l => {
    const k = key(l.url);
    if (!k || seenUrl.has(k)) return;
    seenUrl.add(k);
    links.push(l);
  };
  if (channel?.url) addLink({ label: 'YouTube', url: channel.url, metric_value: channel.subs });
  const mine = (store.platforms || []).filter(p => p.owner === a.artist && p.url);
  for (const p of mine) {
    const twin  = mine.filter(q => q.platform === p.platform).length > 1;
    const handle = (p.url.match(/@([\w.-]+)/) || [])[1];
    addLink({
      url: p.url,
      label: twin && handle ? `${p.platform} · @${handle}` : p.platform,
      metric_value: p.metric_value,
    });
  }

  const releases = (store.releases || []).filter(r => r.artist === a.artist);
  const own      = releases.filter(r => r.kind !== 'feature');
  const features = releases.filter(r => r.kind === 'feature');
  const onSpotify = releases.filter(r => r.spotify_url).length;
  const appleOnly = releases.filter(r => r.apple_url && !r.spotify_url).length;

  return `
<nav class="artist-nav">
  ${people.map(p => `<button class="chip ${p.artist === current ? 'on' : ''}"
      data-artist="${esc(p.artist)}">${esc(p.artist)}</button>`).join('')}
</nav>

<section class="artist-hero">
  <div class="portrait">
    ${a.image_url
      ? `<img src="${esc(a.image_url)}" alt="${esc(a.artist)}">`
      : a.image_video_id
        ? imgTag(a.image_video_id, a.artist)
        : `<div class="placeholder">No photo yet<br>send one and it drops in here</div>`}
    ${!a.image_url ? `<span class="badge p-mute" style="position:absolute;bottom:8px;left:8px;
        backdrop-filter:blur(6px);background:rgba(0,0,0,.6)">artwork stand-in</span>` : ''}
  </div>
  <div>
    <span class="artist-name" style="font-size:1.9rem">${esc(a.artist)}</span>
    <p class="muted sm" style="margin:.35em 0 .1em">${esc(a.role || '')}${
      a.hometown ? ' · ' + esc(a.hometown) : ''}</p>
    <p style="font-size:1.05rem;color:var(--text-secondary);margin:.7em 0 1em">${esc(a.tagline || '')}</p>

    <div class="grid g4" style="margin-bottom:16px">
      ${stat('Subscribers', channel ? fmt(channel.subs) : '—', channel ? esc(channel.name) : 'no own channel')}
      ${stat('Tracks', fmt(tracks.length), 'in the catalog')}
      ${stat('Total views', fmt(totalViews), 'lifetime')}
      ${stat('Best record', top[0] ? fmt(top[0].views) : '—', top[0] ? esc(top[0].title) : '')}
    </div>

    <p style="font-size:.92rem;color:var(--text-secondary);line-height:1.6">${esc(a.bio || '')}</p>

    ${links.length ? `<div class="row" style="margin-top:14px">
      ${links.map(l => `<a class="btn sm ghost" href="${esc(l.url)}" target="_blank" rel="noopener">
        ${esc(l.label)}${l.metric_value !== null && l.metric_value !== undefined
          ? ` · ${fmt(l.metric_value)}` : ''}</a>`).join('')}
    </div>` : ''}
  </div>
</section>

${profileEditor(a)}

${growth(a)}

${card(`
  <h3>Position in the label</h3>
  <p style="margin:0;font-size:.95rem;color:var(--text-secondary)">${esc(a.position_note || '')}</p>`)}

<div class="swot" style="margin-bottom:18px">
  ${swot('s', 'Strengths', a.strengths)}
  ${swot('w', 'What is holding them back', a.weaknesses)}
  ${swot('o', 'Opportunities', a.opportunities)}
</div>

${card(`
  <h3>Artist development</h3>
  <p style="font-size:.95rem;color:var(--text-secondary);line-height:1.6">${esc(a.development || '')}</p>
  ${a.next_move ? `<div class="callout" style="margin-top:12px">
    <strong>Next move:</strong> ${esc(a.next_move)}</div>` : ''}`)}

${projects.length ? card(`
  <h3>Projects</h3>
  <div class="proj-grid" style="margin-top:14px">
    ${projects.map(p => `
      <article class="proj">
        <div class="proj-art">
          <span class="badge ${p.status === 'pushing now' ? 'p-crit' : p.status === 'released' ? 'p-info' : 'p-warn'} tag">${esc(p.status)}</span>
          ${imgTag(p.art_video_id, p.title)}
        </div>
        <div class="proj-body">
          <h4>${esc(p.title)}</h4>
          <div class="proj-meta">${esc(p.kind || '')}${p.release_label ? ' · ' + esc(p.release_label) : ''}</div>
          <p>${esc(p.blurb || '')}</p>
        </div>
      </article>`).join('')}
  </div>`) : ''}


${releases.length ? card(`
  <div class="spread">
    <h3 style="margin:0">Discography</h3>
    <span class="badge p-mute">${releases.length} releases</span>
  </div>
  <p class="muted sm" style="margin:.4em 0 0">Everything out on the DSPs, with a link to each.</p>

  <div class="grid g3" style="margin-top:14px">
    ${stat('Own releases', fmt(own.length), own.length ? 'under their own name' : 'nothing under their own name', own.length ? '' : 'crit')}
    ${stat('Features', fmt(features.length), 'on other artists’ records')}
    ${stat('On Spotify', `${onSpotify} of ${releases.length}`,
        appleOnly ? `${appleOnly} live on Apple but missing from Spotify` : 'full coverage',
        appleOnly ? 'crit' : 'good')}
  </div>

  ${appleOnly >= 2 ? `<div class="callout crit" style="margin-top:14px">
    <strong>Distribution gap.</strong> ${appleOnly} of these ${releases.length} records are live on Apple
    Music but do not appear on the Spotify profile. Every link below is checkable — open the Apple one,
    then look for the same record on Spotify. This is a delivery problem, not an audience problem.
  </div>` : ''}

  ${releaseTable('Own releases', own, false)}
  ${releaseTable('Features on other artists’ records', features, true)}`) : ''}

${top.length ? card(`
  <h3>Best-performing records</h3>
  <div class="proj-grid" style="margin-top:14px">
    ${top.map(t => `
      <a class="proj" href="${esc(t.url)}" target="_blank" rel="noopener" style="text-decoration:none">
        <div class="proj-art">${imgTag(t.video_id, t.title)}</div>
        <div class="proj-body">
          <h4>${esc(t.title)}</h4>
          <div class="proj-meta">${fmt(t.views)} views · ${esc(t.era || '')}</div>
          <p>${esc(t.credit || '')}</p>
        </div>
      </a>`).join('')}
  </div>`) : ''}

${roster?.verdict ? card(`
  <h3>The read</h3>
  <p style="font-size:.95rem;color:var(--text-secondary);line-height:1.6">${esc(roster.verdict)}</p>`) : ''}`;
}

let pendingPhoto = null;   // uploaded but not yet saved onto the profile

export function bind(mount, rerender) {
  /* Photo upload happens on selection so the preview is immediate; the URL is
     only written to the profile when the page is saved. */
  mount.querySelector('#pf-photo')?.addEventListener('change', async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const note = mount.querySelector('#pf-photo-note');
    note.textContent = 'Uploading…';
    try {
      const url = await uploadArtistPhoto(current, file);
      pendingPhoto = url;
      mount.querySelector('#pf-photo-preview').innerHTML = `<img src="${url}" alt="">`;
      note.textContent = 'Looks good. Save the page to publish it.';
    } catch (err) {
      note.textContent = err.message;
    }
  });

  const bars = mount.querySelector('#hub-bars');
  if (bars) {
    const a = (store.hub || {})[current];
    if (a) bindBars(bars, linkRowsFor(a));
  }

  const deleted = new Set();

  mount.addEventListener('click', async e => {
    const chip = e.target.closest('.chip[data-artist]');
    if (chip) { current = chip.dataset.artist; editorOpen = false; rerender(); return; }

    const rangeChip = e.target.closest('.chip[data-range]');
    if (rangeChip) { range = rangeChip.dataset.range; rerender(); return; }

    if (e.target.id === 'pf-edit-toggle') { profileOpen = !profileOpen; rerender(); return; }

    if (e.target.id === 'pf-save') {
      const btn = e.target;
      btn.disabled = true; btn.textContent = 'Saving…';
      try {
        const pickVal = mount.querySelector('#pf-pick').value;
        await saveProfile(current, {
          tagline: mount.querySelector('#pf-tagline').value.trim() || null,
          bio: mount.querySelector('#pf-bio').value.trim() || null,
          hometown: mount.querySelector('#pf-hometown').value.trim() || null,
          pick_release_id: pickVal ? +pickVal : null,
          pick_note: mount.querySelector('#pf-picknote').value.trim() || null,
          ...(pendingPhoto ? { image_url: pendingPhoto } : {}),
        });
        pendingPhoto = null;
        toast('Your page is updated');
        profileOpen = false;
        rerender();
      } catch (err) {
        toast(`Could not save: ${err.message}`, 'err');
        btn.disabled = false; btn.textContent = 'Save page';
      }
      return;
    }

    if (e.target.id === 'hub-copy') {
      try {
        await navigator.clipboard.writeText(e.target.dataset.url);
        toast('Hub link copied');
      } catch { prompt('Copy the hub link:', e.target.dataset.url); }
      return;
    }

    if (e.target.id === 'hub-edit-toggle') {
      editorOpen = !editorOpen;
      rerender();
      return;
    }

    const row = e.target.closest('.hub-edit-row');
    if (e.target.closest('.he-up') && row?.previousElementSibling) {
      row.parentElement.insertBefore(row, row.previousElementSibling); return;
    }
    if (e.target.closest('.he-down') && row?.nextElementSibling) {
      row.parentElement.insertBefore(row.nextElementSibling, row); return;
    }
    if (e.target.closest('.he-del') && row) {
      if (row.dataset.id) deleted.add(+row.dataset.id);
      row.remove(); return;
    }

    if (e.target.id === 'hub-add') {
      const rows = mount.querySelector('#hub-editor-rows');
      const div = document.createElement('div');
      div.className = 'hub-edit-row';
      div.innerHTML = `
        <input type="text" class="he-label" placeholder="Label">
        <input type="text" class="he-url" placeholder="https://…">
        <label class="he-active" title="Show on the hub"><input type="checkbox" checked></label>
        <button class="btn sm ghost he-up" type="button" title="Move up">↑</button>
        <button class="btn sm ghost he-down" type="button" title="Move down">↓</button>
        <button class="btn sm ghost he-del" type="button" title="Remove">×</button>`;
      rows.appendChild(div);
      div.querySelector('.he-label').focus();
      return;
    }

    if (e.target.id === 'hub-save') {
      const btn = e.target;
      btn.disabled = true; btn.textContent = 'Saving…';
      try {
        const rows = [...mount.querySelectorAll('.hub-edit-row')];
        let order = 0;
        for (const r of rows) {
          const label = r.querySelector('.he-label').value.trim();
          const url = r.querySelector('.he-url').value.trim();
          const active = r.querySelector('.he-active input').checked;
          if (!label || !url) continue;
          order += 10;
          if (r.dataset.id) {
            await updateRow('hub_links', +r.dataset.id, { label, url, active, sort_order: order }, store.hubLinks);
          } else {
            await insertRow('hub_links', { artist: current, label, url, active, sort_order: order, kind: 'link' }, store.hubLinks);
          }
        }
        for (const id of deleted) await deleteRow('hub_links', id, store.hubLinks);
        deleted.clear();
        const { data } = await sb.from('hub_links').select('*').order('sort_order');
        store.hubLinks = data || [];
        toast('Hub saved');
        editorOpen = false;
        rerender();
      } catch (err) {
        toast(store.session ? `Save failed: ${err.message}` : 'Sign in first (Team, bottom of the page)', 'err');
        btn.disabled = false; btn.textContent = 'Save changes';
      }
    }
  });
}
