import { store, isAdmin, updateRow, albumTotals, bench } from '../data.js';
import { fmt, esc, hbar, bindBars, stat, card, cvar, toast, banner, thumb } from '../ui.js';

const barRows = () => store.album.map(a => ({
  k: a.title.length > 24 ? a.title.slice(0, 23) + '…' : a.title,
  v: a.yt_views,
  color: a.alt_views ? cvar('--critical') : cvar('--series-1'),
  note: `Released ${a.released}${a.alt_label ? ' · ' + a.alt_label : ''}`,
}));

const totalsRow = () => {
  const t = albumTotals();
  return `<tr style="background:var(--surface-2);font-weight:650">
    <td colspan="4">Totals</td>
    <td class="r num">${fmt(t.yt)}</td>
    <td class="r num" id="t-sp">${fmt(t.spotify)}</td>
    <td class="r num" id="t-ap">${fmt(t.apple)}</td>
    <td class="r num" id="t-ot">${fmt(t.other)}</td>
    <td class="r num" id="t-all">${fmt(t.streams)}</td>
  </tr>`;
};

export function render() {
  const b = bench();
  const t = albumTotals();
  const admin = isAdmin();
  const dis = admin ? '' : 'disabled';

  const body = store.album.map(a => {
    const sum = (a.spotify || 0) + (a.apple || 0) + (a.other || 0);
    return `<tr data-id="${a.id}">
      <td class="num">${a.track_no}</td>
      <td style="width:76px">${thumb(a.video_id, a.title)}</td>
      <td><strong>${esc(a.title)}</strong>
        ${a.alt_label ? `<br><span class="badge p-good">${esc(a.alt_label)}</span>` : ''}</td>
      <td class="muted sm">${esc(a.features || '—')}<br>${esc(a.released || '')}</td>
      <td class="r num">${fmt(a.yt_views)}</td>
      <td class="r"><input class="cell" type="number" min="0" data-f="spotify" value="${a.spotify || 0}" ${dis}></td>
      <td class="r"><input class="cell" type="number" min="0" data-f="apple"   value="${a.apple || 0}" ${dis}></td>
      <td class="r"><input class="cell" type="number" min="0" data-f="other"   value="${a.other || 0}" ${dis}></td>
      <td class="r num rowtot"><strong>${fmt(sum)}</strong></td>
    </tr>`;
  }).join('');

  return `
${banner({ id: '35Fgo3LSEd4', title: 'Album ledger', sub: 'The 2026 record, track by track, with room for the stream counts as they come in.' })}
${card(`
  <h2>Album ledger — the 2026 record</h2>
  <p class="muted sm">Nine tracks, released 2–30 July 2026, mostly on the 18.4K channel.
  YouTube views were scraped live. Stream counts are logged by hand from DistroKid → Bank → Stats
  and Spotify for Artists.</p>
  <div class="grid g4">
    ${stat('YouTube views', fmt(t.yt), 'all 9 tracks')}
    ${stat('Album average', fmt(Math.round(t.yt / (store.album.length || 1))), 'per track', 'crit')}
    ${stat('Logged streams', fmt(t.streams), 'Spotify + Apple + other')}
    ${stat('Toward 100K', Math.round(t.streams / 1000) / 10 + '%', 'of the stream goal')}
  </div>
  <p class="sm muted" style="margin-top:12px">Give Claude the DistroKid and Spotify numbers and they appear here.</p>`)}

<section class="card">
  <h3>Track ledger</h3>
  <div class="tbl-wrap" style="max-height:none">
    <table>
      <thead><tr>
        <th>#</th><th></th><th>Track</th><th>Features / released</th>
        <th class="r">YouTube</th><th class="r">Spotify</th><th class="r">Apple</th>
        <th class="r">Other</th><th class="r">Streams</th>
      </tr></thead>
      <tbody id="l-body">${body}${totalsRow()}</tbody>
    </table>
  </div>
</section>

${card(`
  <h3>Views by track</h3>
  <p class="muted sm">Dashed line is the commentary channel's average — what these songs could
  have reached through the other door.</p>
  <div id="l-chart">${hbar(barRows(), {
      rowH: 30, padL: 200, ref: b.gtAvg, refLabel: 'Global Truth avg ' + fmt(b.gtAvg),
      aria: 'Album track views' })}</div>
  <div class="callout crit" style="margin-top:12px">
    <strong>NO REMEDY</strong> is the same song twice: ${fmt(b.noRemedySmall)} views on the music
    channel, ${fmt(b.noRemedyBig)} on the commentary channel. Every other bar here went out the
    quiet door.
  </div>`)}`;
}

export function bind(mount) {
  bindBars(mount.querySelector('#l-chart'),
    store.album.map(a => ({ k: a.title, v: a.yt_views,
      note: `Released ${a.released}${a.alt_label ? ' · ' + a.alt_label : ''}` })));

  if (!isAdmin()) return;

  mount.querySelector('#l-body')?.addEventListener('change', async e => {
    const input = e.target.closest('input[data-f]');
    if (!input) return;
    const tr = input.closest('tr');
    const id = +tr.dataset.id;
    const val = Math.max(0, parseInt(input.value, 10) || 0);
    input.value = val;
    input.disabled = true;
    try {
      await updateRow('album_tracks', id, { [input.dataset.f]: val }, store.album);
      const a = store.album.find(x => x.id === id);
      tr.querySelector('.rowtot').innerHTML =
        `<strong>${fmt((a.spotify || 0) + (a.apple || 0) + (a.other || 0))}</strong>`;
      const t = albumTotals();
      mount.querySelector('#t-sp').textContent  = fmt(t.spotify);
      mount.querySelector('#t-ap').textContent  = fmt(t.apple);
      mount.querySelector('#t-ot').textContent  = fmt(t.other);
      mount.querySelector('#t-all').textContent = fmt(t.streams);
      toast('Saved');
    } catch (err) {
      toast('Save failed: ' + err.message, 'err');
    } finally {
      input.disabled = false;
    }
  });
}
