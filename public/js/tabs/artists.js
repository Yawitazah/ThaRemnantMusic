import { store } from '../data.js';
import { fmt, esc, stat, card } from '../ui.js';
import { imgTag } from './now.js';

let current = null;

/** Called by the router when the URL is #artists/<name>. */
export function setArg(name) { if (name) current = name; }

const list = () => (store.profiles || []);

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
  const links = (store.platforms || [])
    .filter(p => p.owner === a.artist && p.url)
    .map(p => ({ url: p.url, label: p.platform, metric_value: p.metric_value }));
  if (channel?.url) links.unshift({ label: 'YouTube', url: channel.url, metric_value: channel.subs });

  const releases = (store.releases || []).filter(r => r.artist === a.artist);
  const own      = releases.filter(r => r.kind !== 'feature');
  const features = releases.filter(r => r.kind === 'feature');

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

  ${own.length ? `
    <h4 style="margin:18px 0 8px">Own releases</h4>
    <table class="sm"><tbody>
      ${own.map(r => `
        <tr>
          <td><strong>${esc(r.title)}</strong>
            ${r.note ? `<br><span class="muted sm">${esc(r.note)}</span>` : ''}</td>
          <td class="muted sm" style="width:90px">${esc(r.kind)}${r.year ? ' · ' + r.year : ''}</td>
          <td class="r" style="width:190px">
            ${r.spotify_url ? `<a class="btn sm ghost" href="${esc(r.spotify_url)}" target="_blank" rel="noopener">Spotify</a> ` : ''}
            ${r.apple_url ? `<a class="btn sm ghost" href="${esc(r.apple_url)}" target="_blank" rel="noopener">Apple</a>` : ''}
          </td>
        </tr>`).join('')}
    </tbody></table>` : ''}

  ${features.length ? `
    <h4 style="margin:22px 0 8px">Features on other artists' records</h4>
    <table class="sm"><tbody>
      ${features.map(r => `
        <tr>
          <td><strong>${esc(r.title)}</strong>
            ${r.credited_to ? `<br><span class="muted sm">${esc(r.credited_to)}</span>` : ''}</td>
          <td class="muted sm" style="width:120px">${r.year || ''}${r.note ? '<br>' + esc(r.note) : ''}</td>
          <td class="r" style="width:190px">
            ${r.spotify_url ? `<a class="btn sm ghost" href="${esc(r.spotify_url)}" target="_blank" rel="noopener">Spotify</a> ` : ''}
            ${r.apple_url ? `<a class="btn sm ghost" href="${esc(r.apple_url)}" target="_blank" rel="noopener">Apple</a>` : ''}
          </td>
        </tr>`).join('')}
    </tbody></table>` : ''}`) : ''}

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
