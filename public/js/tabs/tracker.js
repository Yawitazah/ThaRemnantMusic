import { store, isAdmin, insertRow, updateRow, deleteRow } from '../data.js';
import { fmt, money, esc, line, card, toast } from '../ui.js';

const FIELDS = [
  ['gt_subs',           'Global Truth subs'],
  ['music_subs',        'Music channel subs'],
  ['yt_views_28d',      'YT views (28d)'],
  ['spotify_listeners', 'Spotify listeners'],
  ['spotify_followers', 'Spotify followers'],
  ['total_streams',     'Total streams'],
  ['revenue',           'Revenue'],
];

const short = d => {
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

let metric = 'total_streams';

export function render() {
  const admin = isAdmin();
  const weeks = [...store.weeks].sort((a, b) => a.week_of.localeCompare(b.week_of));

  const head = `<tr><th>Week of</th>${FIELDS.map(f => `<th class="r">${f[1]}</th>`).join('')}
    ${admin ? '<th></th>' : ''}</tr>`;

  const body = weeks.length
    ? [...weeks].reverse().map(w => `
        <tr data-id="${w.id}">
          <td><strong>${short(w.week_of)}</strong><br><span class="muted sm">${w.week_of}</span></td>
          ${FIELDS.map(([k]) => `<td class="r">${admin
            ? `<input class="cell" type="number" min="0" data-f="${k}" value="${w[k] ?? ''}">`
            : `<span class="num">${k === 'revenue' ? money(w[k]) : fmt(w[k])}</span>`}</td>`).join('')}
          ${admin ? `<td><button class="btn sm ghost" data-del title="Delete row">×</button></td>` : ''}
        </tr>`).join('')
    : `<tr><td colspan="${FIELDS.length + 1}" class="muted" style="padding:22px;text-align:center">
         No weeks logged yet. ${admin ? 'Add the first snapshot below.' : ''}</td></tr>`;

  const pts = weeks
    .filter(w => w[metric] !== null && w[metric] !== undefined)
    .map(w => ({ k: short(w.week_of), v: Number(w[metric]) }));

  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const defaultDate = monday.toISOString().slice(0, 10);

  return `
${card(`
  <h2>Weekly snapshot</h2>
  <p class="muted sm">Every Monday, five minutes. This is the only recurring habit the plan asks for —
  and it is what turns the dashboard from a document into a record.</p>
  ${admin ? `
    <div class="row" style="margin-top:14px;align-items:flex-end">
      <label style="max-width:180px;margin:0">Week of
        <input type="date" id="w-date" value="${defaultDate}"></label>
      <button class="btn" id="w-add">Add week</button>
      <span class="muted sm">Adds an empty row you can fill in.</span>
    </div>`
    : '<p class="sm muted">Sign in to log a week.</p>'}
  <div class="row" style="margin-top:12px">
    <button class="btn ghost sm" id="w-export">Export everything (JSON)</button>
    <button class="btn ghost sm" id="w-export-csv">Export weeks (CSV)</button>
    <span class="muted sm">Snapshot for backup, or to hand someone the numbers offline.</span>
  </div>`)}

<section class="card">
  <div class="tbl-wrap" style="max-height:none">
    <table><thead>${head}</thead><tbody id="w-body">${body}</tbody></table>
  </div>
</section>

${card(`
  <div class="spread">
    <h3 style="margin:0">Trend</h3>
    <select id="w-metric" style="max-width:200px">
      ${FIELDS.map(f => `<option value="${f[0]}" ${metric === f[0] ? 'selected' : ''}>${f[1]}</option>`).join('')}
    </select>
  </div>
  <div id="w-chart" style="margin-top:14px">${line(pts, { aria: 'Weekly trend' })}</div>`)}

${card(`
  <h3>Where to get each number</h3>
  <table class="sm"><tbody>
    <tr><td><strong>Channel subs &amp; views</strong></td><td class="muted">YouTube Studio → Analytics → Overview → last 28 days</td></tr>
    <tr><td><strong>Spotify monthly listeners</strong></td><td class="muted">Spotify for Artists → Home</td></tr>
    <tr><td><strong>Spotify followers</strong></td><td class="muted">Spotify for Artists → Audience → Followers</td></tr>
    <tr><td><strong>Total streams, all DSPs</strong></td><td class="muted">DistroKid → Bank → Stats</td></tr>
    <tr><td><strong>Revenue</strong></td><td class="muted">DistroKid Bank + YT Studio Revenue + store dashboard</td></tr>
  </tbody></table>`)}`;
}

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function bind(mount, rerender) {
  const stamp = new Date().toISOString().slice(0, 10);

  mount.querySelector('#w-export')?.addEventListener('click', () => {
    download(`remnant-command-center-${stamp}.json`, JSON.stringify({
      exported: new Date().toISOString(),
      note: 'Tha Remnant Music Group — full dashboard snapshot',
      channels: store.channels, roster: store.roster, catalog: store.catalog,
      album: store.album, prior: store.prior, playbook: store.playbook,
      opportunities: store.opps, budget: store.budget,
      weeks: store.weeks, settings: store.settings,
    }, null, 2), 'application/json');
    toast('Snapshot downloaded');
  });

  mount.querySelector('#w-export-csv')?.addEventListener('click', () => {
    const cols = ['week_of', ...FIELDS.map(f => f[0])];
    const head = ['Week of', ...FIELDS.map(f => f[1])].join(',');
    const rows = [...store.weeks]
      .sort((a, b) => a.week_of.localeCompare(b.week_of))
      .map(w => cols.map(c => w[c] ?? '').join(','));
    download(`remnant-weekly-${stamp}.csv`, [head, ...rows].join('\n'), 'text/csv');
    toast('CSV downloaded');
  });

  mount.querySelector('#w-metric')?.addEventListener('change', e => {
    metric = e.target.value;
    const weeks = [...store.weeks].sort((a, b) => a.week_of.localeCompare(b.week_of));
    const pts = weeks.filter(w => w[metric] != null).map(w => ({ k: short(w.week_of), v: Number(w[metric]) }));
    mount.querySelector('#w-chart').innerHTML = line(pts, { aria: 'Weekly trend' });
  });

  if (!isAdmin()) return;

  mount.querySelector('#w-add')?.addEventListener('click', async () => {
    const date = mount.querySelector('#w-date').value;
    if (!date) return toast('Pick a date first', 'err');
    if (store.weeks.some(w => w.week_of === date)) return toast('That week is already logged', 'err');
    try {
      await insertRow('weekly_snapshots', { week_of: date }, store.weeks);
      toast('Week added');
      rerender();
    } catch (err) { toast('Could not add: ' + err.message, 'err'); }
  });

  mount.querySelector('#w-body')?.addEventListener('change', async e => {
    const inp = e.target.closest('input[data-f]');
    if (!inp) return;
    const id = +inp.closest('tr').dataset.id;
    const raw = inp.value.trim();
    const val = raw === '' ? null : Number(raw);
    inp.disabled = true;
    try {
      await updateRow('weekly_snapshots', id, { [inp.dataset.f]: val }, store.weeks);
      toast('Saved');
    } catch (err) {
      toast('Save failed: ' + err.message, 'err');
    } finally { inp.disabled = false; }
  });

  mount.querySelector('#w-body')?.addEventListener('click', async e => {
    const btn = e.target.closest('button[data-del]');
    if (!btn) return;
    const tr = btn.closest('tr');
    if (!confirm('Delete this week?')) return;
    try {
      await deleteRow('weekly_snapshots', +tr.dataset.id, store.weeks);
      toast('Deleted');
      rerender();
    } catch (err) { toast('Delete failed: ' + err.message, 'err'); }
  });
}
