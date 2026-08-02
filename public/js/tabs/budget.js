import { store, isAdmin, updateRow, saveSetting, bench } from '../data.js';
import { fmt, money, esc, hbar, bindBars, stat, card, cvar, toast, banner } from '../ui.js';

const COLORS = ['--series-1', '--series-2', '--series-3', '--text-muted'];

const budgetRows = () => store.budget.map((b, i) => ({
  k: b.label, v: Number(b.amount), color: cvar(COLORS[i % COLORS.length]), note: b.rationale,
}));

const defaults = () => ({ perMonth: 2, reach: 17140, ctr: 6, streamsPerListener: 3, target: 100000 });
const model = () => ({ ...defaults(), ...(store.settings.goal_model || {}) });

function project(m) {
  const listeners = m.reach * (m.ctr / 100);
  const perRelease = listeners * m.streamsPerListener;
  const perMonth = perRelease * m.perMonth;
  const months = perMonth > 0 ? m.target / perMonth : Infinity;
  return { listeners, perRelease, perMonth, months, perYear: perMonth * 12 };
}

export function render() {
  const admin = isAdmin();
  const total = store.budget.reduce((s, b) => s + Number(b.amount), 0);
  const m = model();
  const p = project(m);

  const lines = store.budget.map(b => `
    <tr data-id="${b.id}">
      <td><strong>${esc(b.label)}</strong><br><span class="muted sm">${esc(b.rationale || '')}</span></td>
      <td class="r" style="width:120px">
        ${admin
          ? `<input class="cell" type="number" min="0" step="5" data-amt value="${Number(b.amount)}">`
          : `<span class="num">${money(b.amount)}</span>`}
      </td>
      <td class="r num muted" style="width:70px">${total ? Math.round(Number(b.amount) / total * 100) : 0}%</td>
    </tr>`).join('');

  const slider = (id, label, min, max, step, val, suffix = '') => `
    <label>${label}: <strong id="${id}-v" class="num">${val}${suffix}</strong>
      <input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}">
    </label>`;

  return `
${banner({ id: '_TmeO71ZeB4', title: 'Budget & goal model', sub: 'Where the $500 a month goes, and the arithmetic behind 100,000 streams.' })}
${card(`
  <h2>$500/month allocation</h2>
  <p class="muted sm">Most of the plan is free. This is the paid layer, and it is deliberately
  weighted toward audiences that already know who Breed is.</p>
  <div class="grid g4">
    ${stat('Monthly total', money(total), total <= 500 ? 'within cap' : 'over the $500 cap',
        total <= 500 ? 'good' : 'crit')}
    ${stat('Annual paid', money(total * 12), 'ads and submissions')}
    ${stat('Fixed costs', '$90/yr', 'DistroKid Ultimate + $10/collaborator')}
    ${stat('Cheapest lever', '$0', '9 of the 14 board moves')}
  </div>`)}

<section class="card">
  <h3>Where the money goes</h3>
  <table><tbody>${lines}
    <tr style="background:var(--surface-2);font-weight:650">
      <td>Total</td><td class="r num" id="b-total">${money(total)}</td><td class="r num">100%</td>
    </tr>
  </tbody></table>
  <div id="b-chart" style="margin-top:18px">${hbar(budgetRows(), {
      rowH: 32, padL: 175, aria: 'Budget allocation' })}</div>
  <p class="sm muted">Ask Claude to change the allocation and it updates here.</p>
</section>

${card(`
  <h3>Goal model — the road to 100,000 streams</h3>
  <p class="muted sm">Drag the assumptions. This is arithmetic, not a forecast — it shows what
  would have to be true, not what will happen.</p>
  <div class="grid g2" style="margin-top:14px">
    <div>
      ${slider('s-reach', 'Views per Sermon-to-Song release', 1000, 40000, 500, m.reach)}
      ${slider('s-ctr', 'Click-through to the song', 1, 25, 0.5, m.ctr, '%')}
      ${slider('s-spl', 'Streams per listener who converts', 1, 12, 0.5, m.streamsPerListener)}
      ${slider('s-pm', 'Releases per month', 0.5, 6, 0.5, m.perMonth)}
    </div>
    <div class="grid" style="align-content:start;gap:10px">
      ${stat('Listeners per release', `<span id="g-lis">${fmt(p.listeners)}</span>`, 'clicked through')}
      ${stat('Streams per release', `<span id="g-rel">${fmt(p.perRelease)}</span>`, '')}
      ${stat('Streams per month', `<span id="g-mo">${fmt(p.perMonth)}</span>`, '')}
      ${stat('Months to 100K', `<span id="g-months">${isFinite(p.months) ? p.months.toFixed(1) : '—'}</span>`,
        'at this cadence', 'good')}
    </div>
  </div>
  ${admin ? '<button class="btn sm" id="g-save" style="margin-top:14px">Save these assumptions</button>' : ''}`)}

${card(`
  <h3>What 100,000 streams is actually worth</h3>
  <div class="grid g3">
    ${stat('Streaming payout', '$300–400', 'at ~$0.003–0.004/stream', 'crit')}
    ${stat('Merch at 0.5%', '~$35,000', '0.5% of 237K buying a $30 tee', 'good')}
    ${stat('One sold-out room', 'Bookable', 'provable draw beats stream counts', 'good')}
  </div>
  <p class="sm muted" style="margin-top:14px">100,000 streams is a credibility milestone — it opens
  conversations. It is not the business. Merch and live are the business, and both run off the same
  237,000-person audience that is already there.</p>`)}`;
}

export function bind(mount) {
  bindBars(mount.querySelector('#b-chart'),
    store.budget.map(b => ({ k: b.label, v: Number(b.amount), note: b.rationale })));

  const ids = { 's-reach': 'reach', 's-ctr': 'ctr', 's-spl': 'streamsPerListener', 's-pm': 'perMonth' };
  const cur = model();

  const recalc = () => {
    const m = {
      reach: +mount.querySelector('#s-reach').value,
      ctr: +mount.querySelector('#s-ctr').value,
      streamsPerListener: +mount.querySelector('#s-spl').value,
      perMonth: +mount.querySelector('#s-pm').value,
      target: cur.target || 100000,
    };
    const p = project(m);
    mount.querySelector('#s-reach-v').textContent = fmt(m.reach);
    mount.querySelector('#s-ctr-v').textContent   = m.ctr + '%';
    mount.querySelector('#s-spl-v').textContent   = m.streamsPerListener;
    mount.querySelector('#s-pm-v').textContent    = m.perMonth;
    mount.querySelector('#g-lis').textContent     = fmt(p.listeners);
    mount.querySelector('#g-rel').textContent     = fmt(p.perRelease);
    mount.querySelector('#g-mo').textContent      = fmt(p.perMonth);
    mount.querySelector('#g-months').textContent  = isFinite(p.months) ? p.months.toFixed(1) : '—';
    return m;
  };

  Object.keys(ids).forEach(id =>
    mount.querySelector('#' + id)?.addEventListener('input', recalc));

  if (!isAdmin()) return;

  mount.querySelector('#g-save')?.addEventListener('click', async () => {
    try {
      await saveSetting('goal_model', { ...recalc(), target: cur.target || 100000 });
      toast('Assumptions saved');
    } catch (err) { toast('Save failed: ' + err.message, 'err'); }
  });

  mount.addEventListener('change', async e => {
    const inp = e.target.closest('input[data-amt]');
    if (!inp) return;
    const id = +inp.closest('tr').dataset.id;
    const amount = Math.max(0, parseFloat(inp.value) || 0);
    inp.disabled = true;
    try {
      await updateRow('budget_lines', id, { amount }, store.budget);
      const total = store.budget.reduce((s, b) => s + Number(b.amount), 0);
      mount.querySelector('#b-total').textContent = money(total);
      toast(total > 500 ? `Saved — ${money(total - 500)} over the monthly cap` : 'Saved');
    } catch (err) {
      toast('Save failed: ' + err.message, 'err');
    } finally { inp.disabled = false; }
  });
}
