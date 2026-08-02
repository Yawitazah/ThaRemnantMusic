import { store, isAdmin, updateRow } from '../data.js';
import { esc, card, toast } from '../ui.js';

const STATUSES = ['Not started', 'In progress', 'Blocked', 'Done'];
const IMPACT_CLASS = { critical: 'p-crit', high: 'p-warn', medium: 'p-info' };
const STATUS_CLASS = { 'Not started': 'p-mute', 'In progress': 'p-info', Blocked: 'p-crit', Done: 'p-good' };

export function render() {
  const admin = isAdmin();
  const counts = STATUSES.map(s => ({ s, n: store.opps.filter(o => o.status === s).length }));

  const body = store.opps.map(o => `
    <tr data-id="${o.id}">
      <td><strong>${esc(o.move)}</strong></td>
      <td><span class="badge ${IMPACT_CLASS[o.impact] || 'p-mute'}">${esc(o.impact)}</span></td>
      <td class="muted sm">${esc(o.owner || '—')}</td>
      <td class="muted sm">${esc(o.cost || '—')}</td>
      <td class="muted sm">${esc(o.timeframe || '—')}</td>
      <td style="width:150px">
        ${admin
          ? `<select data-status>${STATUSES.map(s =>
              `<option ${o.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select>`
          : `<span class="badge ${STATUS_CLASS[o.status] || 'p-mute'}">${esc(o.status)}</span>`}
      </td>
    </tr>`).join('');

  return `
${card(`
  <h2>Opportunity board</h2>
  <p class="muted sm">Every move worth making, ordered by impact. Nine of these cost nothing but
  an afternoon.</p>
  <div class="row" style="margin-top:14px">
    ${counts.map(c => `<span class="badge ${STATUS_CLASS[c.s]}">${c.s}: ${c.n}</span>`).join('')}
  </div>
  ${!admin ? '<p class="sm muted" style="margin-top:12px">Sign in to change status.</p>' : ''}`)}

<section class="card">
  <div class="tbl-wrap" style="max-height:none">
    <table>
      <thead><tr>
        <th>Move</th><th>Impact</th><th>Owner</th><th>Cost</th><th>Time</th><th>Status</th>
      </tr></thead>
      <tbody id="o-body">${body}</tbody>
    </table>
  </div>
</section>

${card(`
  <h3>Free doors, still unopened</h3>
  <ul class="sm muted">
    <li><strong>Rapzilla</strong> — <a href="https://rapzilla.com/submit/" target="_blank" rel="noopener">rapzilla.com/submit</a>,
    email <code>me@rapzilla.com</code>, subject <code>SONG: BREED – Title</code>, with MP3, YouTube
    link, 1000×1000 art, photo and bio. They explicitly do not accept payment for coverage.</li>
    <li><strong>Trackstarz</strong> free tier · <strong>Holy Culture Radio</strong> (SiriusXM)</li>
    <li><strong>Amazon Music for Artists</strong> self-serve pitching</li>
    <li><strong>Spotify editorial pitch</strong> — 14+ days ahead, one song at a time · Release Radar</li>
    <li><strong>YouTube Official Artist Channel</strong> via DistroKid Goodies</li>
    <li><strong>HyperFollow + Meta pixel</strong> on every release</li>
  </ul>`)}

${card(`
  <h3>Things to be honest about</h3>
  <ul class="sm muted">
    <li><strong>Do not buy playlist placements.</strong> Playlist Push starts at $250–450 — most of
    the budget — and playlist-sourced streams show ~2% 30-day return-listener rate vs ~11% for
    algorithmic. Anything guaranteeing stream counts is a distribution risk under current fraud
    enforcement.</li>
    <li><strong>Do not enable YouTube Content ID on leased or licensed beats.</strong> DistroKid's
    Social Media Pack excludes beats, loops and sample-library audio; enabling it on ineligible
    tracks produces false claims against other creators and against yourself.</li>
    <li><strong>Discovery Mode</strong> needs 25,000+ monthly listeners and costs a 30% royalty
    commission. Not available yet — don't budget for it.</li>
    <li><strong>TikTok Spark Ads</strong> have a ~$50/day floor. Out of reach at $500/mo. Post organic.</li>
    <li><strong>Spotify Ad Studio</strong> has a $250 minimum and 3–5× worse cost-per-stream than Meta.</li>
    <li><strong>100,000 streams pays roughly $300–400.</strong> It is a credibility milestone, not
    revenue. Merch and live are the business.</li>
    <li><strong>Touring:</strong> bookers buy provable draw, not streams. One sold-out hometown room
    beats 100K streams in every booking conversation.</li>
  </ul>
  <p class="sm muted">Ad CPM/CPV benchmarks and curator conversion rates come from third-party
  industry sources, not vendor documentation — treat as directional.</p>`)}`;
}

export function bind(mount) {
  if (!isAdmin()) return;
  mount.querySelector('#o-body')?.addEventListener('change', async e => {
    const sel = e.target.closest('select[data-status]');
    if (!sel) return;
    const id = +sel.closest('tr').dataset.id;
    sel.disabled = true;
    try {
      await updateRow('opportunities', id, { status: sel.value }, store.opps);
      toast('Status updated');
    } catch (err) {
      toast('Save failed: ' + err.message, 'err');
    } finally { sel.disabled = false; }
  });
}
