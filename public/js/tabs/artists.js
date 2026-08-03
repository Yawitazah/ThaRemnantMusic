import { store } from '../data.js';
import { fmt, esc, stat, card } from '../ui.js';
import { imgTag } from './now.js';

let current = null;

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
        <td class="r" style="width:170px;white-space:nowrap">
          ${dsp(r.spotify_url, 'Spotify')}${dsp(r.apple_url, 'Apple')}
        </td>
      </tr>`).join('')}
  </tbody></table>`;

const swot = (cls, title, items) => !items || !items.length ? '' : `
  <div class="swot-box ${cls}">
    <h4>${esc(title)}</h4>
    <ul>${items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>
  </div>`;

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

export function bind(mount, rerender) {
  mount.addEventListener('click', e => {
    const chip = e.target.closest('.chip[data-artist]');
    if (!chip) return;
    current = chip.dataset.artist;
    rerender();
  });
}
