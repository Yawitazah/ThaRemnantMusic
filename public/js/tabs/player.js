import { store, bench } from '../data.js';
import { fmt, esc, hbar, bindBars, stat, card, cvar, $$, banner } from '../ui.js';

const ARTISTS = [
  { k: 'all',   label: 'All tracks' },
  { k: 'breed', label: 'BREED' },
  { k: 'king',  label: 'King Konnect' },
  { k: 'jay',   label: 'JayThaRealist' },
  { k: 'zah',   label: 'Yawitazah' },
  { k: 'album', label: '2026 album' },
];

const SORTS = [
  { k: 'views',   label: 'Most viewed' },
  { k: 'viewsA',  label: 'Least viewed' },
  { k: 'title',   label: 'Title A–Z' },
  { k: 'channel', label: 'Channel' },
];

const BANDS = [
  { k: 'all',  label: 'Any size',      test: () => true },
  { k: 'hit',  label: '10K+ views',    test: t => t.views >= 10000 },
  { k: 'mid',  label: '1K–10K',        test: t => t.views >= 1000 && t.views < 10000 },
  { k: 'low',  label: 'Under 1K',      test: t => t.views < 1000 },
];

const state = { artist: 'all', channel: 'all', band: 'all', sort: 'views', q: '', current: null };

const channels = () => [...new Set(store.catalog.map(t => t.channel).filter(Boolean))].sort();

function filtered() {
  let list = store.catalog.filter(t => {
    if (state.artist !== 'all' && !(t.artists || []).includes(state.artist)) return false;
    if (state.channel !== 'all' && t.channel !== state.channel) return false;
    if (!(BANDS.find(b => b.k === state.band) || BANDS[0]).test(t)) return false;
    if (state.q) {
      const hay = `${t.title} ${t.credit || ''} ${t.era || ''} ${t.channel || ''}`.toLowerCase();
      if (!hay.includes(state.q.toLowerCase())) return false;
    }
    return true;
  });
  const dir = state.sort === 'viewsA' ? 1 : -1;
  return list.sort((a, b) => {
    if (state.sort === 'title')   return a.title.localeCompare(b.title);
    if (state.sort === 'channel') return (a.channel || '').localeCompare(b.channel || '')
                                      || b.views - a.views;
    return (a.views - b.views) * dir;
  });
}

/* ---------- analytics for one track ---------- */
function analyse(t) {
  const all = [...store.catalog].sort((a, b) => b.views - a.views);
  const rank = all.findIndex(x => x.video_id === t.video_id) + 1;
  const pct = Math.round((1 - (rank - 1) / all.length) * 100);

  const sameChannel = store.catalog.filter(x => x.channel === t.channel);
  const chAvg = sameChannel.length
    ? Math.round(sameChannel.reduce((s, x) => s + x.views, 0) / sameChannel.length) : 0;

  const albumTracks = store.catalog.filter(x => (x.artists || []).includes('album'));
  const albumAvg = albumTracks.length
    ? Math.round(albumTracks.reduce((s, x) => s + x.views, 0) / albumTracks.length) : 0;

  const catalogAvg = Math.round(all.reduce((s, x) => s + x.views, 0) / all.length);

  return { rank, total: all.length, pct, chAvg, albumAvg, catalogAvg, best: all[0] };
}

function analyticsHtml(t) {
  if (!t) return '';
  const a = analyse(t);
  const b = bench();
  const vsAlbum = a.albumAvg ? (t.views / a.albumAvg) : 0;
  const vsChannel = a.chAvg ? (t.views / a.chAvg) : 0;

  const rows = [
    { k: 'This track', v: t.views, color: cvar('--series-2'), note: t.credit },
    { k: `${t.channel || 'Channel'} avg`, v: a.chAvg, color: cvar('--series-1'),
      note: `Average across ${store.catalog.filter(x => x.channel === t.channel).length} tracks` },
    { k: '2026 album avg', v: a.albumAvg, color: cvar('--text-muted'), note: 'The 10 album uploads' },
    { k: 'Whole catalog avg', v: a.catalogAvg, color: cvar('--text-muted'), note: `All ${a.total} tracks` },
    { k: 'Commentary channel', v: b.gtAvg, color: cvar('--good'), note: 'What the 237K channel does per video' },
  ];

  return `
  <div class="grid g4" style="margin-top:16px">
    ${stat('Views', fmt(t.views), t.era || '')}
    ${stat('Catalog rank', '#' + a.rank, `of ${a.total} · top ${100 - a.pct || 1}%`,
        a.rank <= 10 ? 'good' : a.rank > a.total * 0.66 ? 'crit' : '')}
    ${stat('vs album avg', vsAlbum ? vsAlbum.toFixed(1) + '×' : '—', 'against the 2026 rollout',
        vsAlbum >= 1 ? 'good' : 'crit')}
    ${stat('vs its channel', vsChannel ? vsChannel.toFixed(1) + '×' : '—', 'against that channel’s average',
        vsChannel >= 1 ? 'good' : 'crit')}
  </div>
  <div id="np-chart" style="margin-top:16px">${hbar(rows, {
      rowH: 30, padL: 190, ref: b.gtAvg, refLabel: 'commentary-channel reach',
      aria: 'Track performance in context' })}</div>
  <p class="sm muted" style="margin-top:10px">
    ${vsChannel >= 1
      ? 'This one outperforms its own channel — worth studying what it did differently.'
      : 'This sits below its own channel average, which is already below the label’s proven ceiling.'}
    The dashed line is what the 237K commentary channel reaches per upload — the gap between that
    line and this bar is the opportunity the whole plan is built around.
  </p>`;
}

/* ---------- summary for the filtered set ---------- */
function summaryHtml(list) {
  if (!list.length) return '<p class="muted sm">Nothing matches those filters.</p>';
  const views = list.map(t => t.views).sort((a, b) => a - b);
  const total = views.reduce((s, v) => s + v, 0);
  const avg = Math.round(total / views.length);
  const mid = views.length % 2
    ? views[(views.length - 1) / 2]
    : Math.round((views[views.length / 2 - 1] + views[views.length / 2]) / 2);
  const best = list.reduce((m, t) => (t.views > m.views ? t : m), list[0]);

  return `
  <div class="grid g4">
    ${stat('Tracks shown', fmt(list.length), 'matching the filters')}
    ${stat('Combined views', fmt(total), 'lifetime')}
    ${stat('Average', fmt(avg), 'per track')}
    ${stat('Median', fmt(mid), avg > mid * 2 ? 'far below average — a few hits carry it' : 'per track')}
  </div>
  <p class="sm muted" style="margin-top:12px">
    Best in this set: <strong>${esc(best.title)}</strong> at ${fmt(best.views)} views
    ${best.credit ? `· <span class="muted">${esc(best.credit)}</span>` : ''}
  </p>`;
}

export function render() {
  const list = filtered();
  if (!state.current || !list.some(t => t.video_id === state.current.video_id)) {
    state.current = list[0] || store.catalog[0] || null;
  }
  const t = state.current;

  const items = list.map(x => `
    <button data-vid="${esc(x.video_id)}" class="${t && x.video_id === t.video_id ? 'on' : ''}">
      <strong>${esc(x.title)}</strong><br>
      <span class="muted sm">${esc(x.credit || '')}</span><br>
      <span class="muted sm">${fmt(x.views)} views · ${esc(x.channel || '')}</span>
    </button>`).join('');

  return `
${banner({ id: 'gjZGQyazceY', title: 'Player', sub: 'Every record in the catalog, filterable, with the numbers behind each one.' })}
${card(`
  <h2>Player</h2>
  <div class="callout crit">
    <strong>Note:</strong> "Allow embedding" is currently OFF on these uploads, so the inline player
    shows <code>Error 153</code>. Use "Open on YouTube" until that is fixed — and treat every grey box
    here as the same grey box a blog, an EPK or a Rapzilla feature would show a reader.
  </div>

  <div class="row" style="margin-top:14px">
    ${ARTISTS.map(f => `<button class="chip ${state.artist === f.k ? 'on' : ''}" data-artist="${f.k}">${f.label}</button>`).join('')}
  </div>
  <div class="row" style="margin-top:10px">
    <label style="margin:0;max-width:210px">Channel
      <select id="p-channel">
        <option value="all">All channels</option>
        ${channels().map(c => `<option value="${esc(c)}" ${state.channel === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
      </select></label>
    <label style="margin:0;max-width:160px">Size
      <select id="p-band">
        ${BANDS.map(b => `<option value="${b.k}" ${state.band === b.k ? 'selected' : ''}>${b.label}</option>`).join('')}
      </select></label>
    <label style="margin:0;max-width:170px">Sort
      <select id="p-sort">
        ${SORTS.map(s => `<option value="${s.k}" ${state.sort === s.k ? 'selected' : ''}>${s.label}</option>`).join('')}
      </select></label>
    <label style="margin:0;max-width:230px">Search
      <input type="text" id="p-search" placeholder="Title, credit, era…" value="${esc(state.q)}"></label>
    <button class="btn ghost sm" id="p-reset" style="align-self:flex-end">Reset</button>
  </div>`)}

${card(`<h3>This selection</h3><div id="p-summary">${summaryHtml(list)}</div>`)}

<div class="grid g2" style="grid-template-columns:1.55fr 1fr">
  <section class="card">
    <div class="player-wrap">
      <iframe id="yt" src="https://www.youtube-nocookie.com/embed/${esc(t?.video_id || '')}"
        title="Player" allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
        allowfullscreen loading="lazy"></iframe>
    </div>
    <div class="spread" style="margin-top:14px">
      <div>
        <h3 id="np-title" style="margin:0">${esc(t?.title || '—')}</h3>
        <p class="muted sm" id="np-credit" style="margin:.2em 0 0">${esc(t?.credit || '')}</p>
      </div>
      <a class="btn sm" id="np-link" target="_blank" rel="noopener"
         href="${esc(t?.url || '#')}">Open on YouTube</a>
    </div>
    <div id="np-analytics">${analyticsHtml(t)}</div>
  </section>

  <section class="card">
    <div class="spread">
      <h3 style="margin:0">Tracks</h3>
      <span class="badge p-mute" id="p-count">${list.length}</span>
    </div>
    <div class="track-list" id="p-list" style="margin-top:10px;max-height:640px">${items}</div>
  </section>
</div>`;
}

export function bind(mount, rerender) {
  const t = state.current;
  if (t) {
    const a = analyse(t), b = bench();
    bindBars(mount.querySelector('#np-chart'), [
      { k: 'This track', v: t.views, note: t.credit },
      { k: `${t.channel} avg`, v: a.chAvg, note: 'Channel average' },
      { k: '2026 album avg', v: a.albumAvg, note: 'The album uploads' },
      { k: 'Whole catalog avg', v: a.catalogAvg, note: `All ${a.total} tracks` },
      { k: 'Commentary channel', v: b.gtAvg, note: 'The 237K channel' },
    ]);
  }

  const redraw = () => rerender();

  mount.addEventListener('click', e => {
    const chip = e.target.closest('.chip[data-artist]');
    if (chip) { state.artist = chip.dataset.artist; return redraw(); }
    if (e.target.closest('#p-reset')) {
      Object.assign(state, { artist: 'all', channel: 'all', band: 'all', sort: 'views', q: '' });
      return redraw();
    }
    const btn = e.target.closest('button[data-vid]');
    if (btn) {
      const track = store.catalog.find(x => x.video_id === btn.dataset.vid);
      if (!track) return;
      state.current = track;
      $$('button[data-vid]', mount).forEach(x => x.classList.toggle('on', x === btn));
      mount.querySelector('#yt').src = `https://www.youtube-nocookie.com/embed/${track.video_id}`;
      mount.querySelector('#np-title').textContent = track.title;
      mount.querySelector('#np-credit').textContent = track.credit || '';
      mount.querySelector('#np-link').href = track.url;
      const box = mount.querySelector('#np-analytics');
      box.innerHTML = analyticsHtml(track);
      const a = analyse(track), b = bench();
      bindBars(box.querySelector('#np-chart'), [
        { k: 'This track', v: track.views, note: track.credit },
        { k: `${track.channel} avg`, v: a.chAvg, note: 'Channel average' },
        { k: '2026 album avg', v: a.albumAvg, note: 'The album uploads' },
        { k: 'Whole catalog avg', v: a.catalogAvg, note: `All ${a.total} tracks` },
        { k: 'Commentary channel', v: b.gtAvg, note: 'The 237K channel' },
      ]);
    }
  });

  mount.querySelector('#p-channel')?.addEventListener('change', e => { state.channel = e.target.value; redraw(); });
  mount.querySelector('#p-band')?.addEventListener('change',    e => { state.band = e.target.value; redraw(); });
  mount.querySelector('#p-sort')?.addEventListener('change',    e => { state.sort = e.target.value; redraw(); });

  let timer;
  mount.querySelector('#p-search')?.addEventListener('input', e => {
    state.q = e.target.value;
    clearTimeout(timer);
    timer = setTimeout(() => {
      redraw();
      const el = document.querySelector('#p-search');
      if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
    }, 250);
  });
}
