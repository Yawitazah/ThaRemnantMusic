import { store, catalogStats } from '../data.js';
import { fmt, esc, stat, card, $$, banner, thumb } from '../ui.js';

const FILTERS = [
  { k: 'all',   label: 'All' },
  { k: 'breed', label: 'BREED' },
  { k: 'king',  label: 'King Konnect' },
  { k: 'jay',   label: 'JayThaRealist' },
  { k: 'zah',   label: 'Yawitazah' },
  { k: 'album', label: '2026 album' },
];

let filter = 'all', sortKey = 'views', sortDir = -1, query = '';

const rows = () => {
  let list = store.catalog.filter(t => filter === 'all' || (t.artists || []).includes(filter));
  if (query) {
    const q = query.toLowerCase();
    list = list.filter(t =>
      (t.title + ' ' + (t.credit || '') + ' ' + (t.channel || '')).toLowerCase().includes(q));
  }
  return list.sort((a, b) => {
    const av = a[sortKey], bv = b[sortKey];
    if (typeof av === 'number') return (av - bv) * sortDir;
    return String(av ?? '').localeCompare(String(bv ?? '')) * sortDir;
  });
};

const tbody = () => rows().map(t => `
  <tr>
    <td style="width:76px">${thumb(t.video_id, t.title)}</td>
    <td><a href="${esc(t.url)}" target="_blank" rel="noopener">${esc(t.title)}</a>
      ${t.note ? `<br><span class="muted sm">${esc(t.note)}</span>` : ''}</td>
    <td class="muted sm">${esc(t.credit || '')}</td>
    <td class="r num"><strong>${fmt(t.views)}</strong></td>
    <td class="muted sm">${esc(t.era || '')}</td>
    <td class="muted sm">${esc(t.channel || '')}</td>
  </tr>`).join('');

export function render() {
  const s = catalogStats();
  return `
${banner({ id: 'KSP3_HePoR8', title: 'The catalog', sub: 'Every track across all four channels, filterable and sortable.' })}
${card(`
  <h2>What the full catalog reveals</h2>
  <div class="grid g4">
    ${stat('Tracks catalogued', fmt(s.total), 'across 4 channels')}
    ${stat('Total views', fmt(s.totalViews), 'lifetime, all tracks')}
    ${stat('Top-10 average', fmt(s.top10Avg), 'the proven ceiling', 'good')}
    ${stat('2026 album average', fmt(s.albumAvg), 'current rollout', 'crit')}
  </div>
  <p class="sm muted" style="margin-top:14px">
    BREED ${s.breed} tracks · King Konnect ${s.king} · JayThaRealist ${s.jay}.
    Note how many titles appear more than once under different credits — that is one view count
    being split three ways instead of compounding.
  </p>`)}

<section class="card">
  <div class="row" style="margin-bottom:12px">
    ${FILTERS.map(f => `<button class="chip ${filter === f.k ? 'on' : ''}" data-f="${f.k}">${f.label}</button>`).join('')}
    <input type="text" class="search" id="c-search" placeholder="Search titles, credits…"
      value="${esc(query)}" style="margin-left:auto">
  </div>
  <div class="tbl-wrap">
    <table>
      <thead><tr>
        <th></th>
        <th class="sortable" data-s="title">Title</th>
        <th class="sortable" data-s="credit">Credited as</th>
        <th class="sortable r" data-s="views">Views</th>
        <th class="sortable" data-s="era">Era</th>
        <th class="sortable" data-s="channel">Channel</th>
      </tr></thead>
      <tbody id="c-body">${tbody()}</tbody>
    </table>
  </div>
  <p class="sm muted" style="margin-top:10px" id="c-count">${rows().length} shown</p>
</section>`;
}

export function bind(mount) {
  const redraw = () => {
    mount.querySelector('#c-body').innerHTML = tbody();
    mount.querySelector('#c-count').textContent = rows().length + ' shown';
    $$('.chip[data-f]', mount).forEach(c => c.classList.toggle('on', c.dataset.f === filter));
  };

  mount.addEventListener('click', e => {
    const chip = e.target.closest('.chip[data-f]');
    if (chip) { filter = chip.dataset.f; redraw(); return; }
    const th = e.target.closest('th.sortable');
    if (th) {
      const k = th.dataset.s;
      if (k === sortKey) sortDir *= -1; else { sortKey = k; sortDir = k === 'views' ? -1 : 1; }
      redraw();
    }
  });

  mount.querySelector('#c-search')?.addEventListener('input', e => {
    query = e.target.value; redraw();
  });
}
