// Fans — every email captured on any artist hub, visible to the whole team.
// The same leads also land in the label's CRM account for outreach; this tab
// is the shared, always-current view so the team decides together who follows
// up. Gated: the list only renders for signed-in team members (RLS enforces
// it server-side; this tab just explains it to everyone else).

import { store, sb, crmSsoUrl } from '../data.js';
import { fmt, esc, stat, card } from '../ui.js';

let rows = null;      // null = not loaded, [] = loaded empty
let artistFilter = 'all';

const ago = iso => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 5400) return Math.round(s / 60) + 'm ago';
  if (s < 129600) return Math.round(s / 3600) + 'h ago';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export function render() {
  if (!store.isTeam) {
    return card(`
      <h2>Fans</h2>
      <p class="muted" style="max-width:60ch">Every email captured on any artist hub lands here the
      moment it arrives — name, email, which artist they came in for — plus in the label CRM.
      This list is for the team only.</p>
      <p style="margin-top:14px"><a class="btn" href="/join">Sign in or join the team</a></p>`);
  }

  const list = (rows || []).filter(r => artistFilter === 'all' || r.artist === artistFilter);
  const artists = [...new Set((rows || []).map(r => r.artist))];
  const last7 = (rows || []).filter(r => Date.now() - new Date(r.created_at).getTime() < 7 * 86400_000).length;

  return `
${card(`
  <div class="spread">
    <h2 style="margin:0">Fans</h2>
    <span class="badge p-info">team only</span>
  </div>
  <p class="muted sm" style="margin:.4em 0 0">Everyone the hubs have captured, newest first. The same
  people are in the label CRM for outreach — decide together who contacts who.</p>
  <div class="grid g4" style="margin-top:14px">
    ${stat('Total fans', rows === null ? '…' : fmt(rows.length), 'captured across all hubs')}
    ${stat('Last 7 days', rows === null ? '…' : fmt(last7), 'new signups', last7 ? 'good' : '')}
    ${stat('Artists represented', rows === null ? '…' : fmt(artists.length), 'with at least one fan')}
    ${stat('Where to work them', 'CRM', 'one click below, same login')}
  </div>
  <p style="margin:14px 0 0"><a class="btn sm" href="${esc(crmSsoUrl())}" target="_blank" rel="noopener">
    Open the label CRM — signs you in automatically</a></p>`)}

${card(`
  <div class="row" style="margin-bottom:12px">
    <button class="chip ${artistFilter === 'all' ? 'on' : ''}" data-fan-artist="all">All</button>
    ${artists.map(a => `<button class="chip ${artistFilter === a ? 'on' : ''}" data-fan-artist="${esc(a)}">${esc(a)}</button>`).join('')}
  </div>
  ${rows === null ? '<p class="muted">Loading fans…</p>'
    : !list.length ? '<p class="muted">No fans captured yet. Share the hub links — signups appear here instantly.</p>'
    : `<div class="tbl-wrap"><table>
        <thead><tr><th>Name</th><th>Email</th><th>Came in for</th><th class="r">When</th></tr></thead>
        <tbody>${list.map(r => `
          <tr>
            <td>${esc(r.name || '—')}</td>
            <td><a href="mailto:${esc(r.email)}">${esc(r.email)}</a></td>
            <td><span class="badge p-mute">${esc(r.artist)}</span></td>
            <td class="r muted sm" style="white-space:nowrap">${ago(r.created_at)}</td>
          </tr>`).join('')}
        </tbody></table></div>`}`)}`;
}

export function bind(mount, rerender) {
  if (store.isTeam && rows === null) {
    sb.from('hub_captures').select('*').order('created_at', { ascending: false }).limit(500)
      .then(({ data }) => { rows = data || []; rerender(); });
  }
  mount.addEventListener('click', e => {
    const chip = e.target.closest('.chip[data-fan-artist]');
    if (chip) { artistFilter = chip.dataset.fanArtist; rerender(); }
  });
}
