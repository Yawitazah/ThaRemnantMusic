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
  <p class="sm muted" style="margin-top:12px">Tell Claude what moved and the statuses update.</p>`)}

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
  <p class="muted sm">Every one of these costs nothing but the time to submit. None have been used.</p>
  <table class="sm" style="margin-top:8px">
    <thead><tr><th>Channel</th><th>What it is</th><th class="r">Cost</th></tr></thead>
    <tbody>
      <tr><td><a href="https://rapzilla.com/submit/" target="_blank" rel="noopener"><strong>Rapzilla</strong></a></td>
          <td class="muted">The genre's #1 discovery outlet. Merit-based, no pay-to-post. Email
          <code>me@rapzilla.com</code>, subject <code>SONG: BREED – Title</code>, with MP3, YouTube
          link, 1000×1000 art, photo and bio.</td>
          <td class="r"><span class="badge p-good">Free</span></td></tr>
      <tr><td><strong>Trackstarz</strong></td>
          <td class="muted">CHH media platform, free submission tier.</td>
          <td class="r"><span class="badge p-good">Free</span></td></tr>
      <tr><td><strong>Holy Culture Radio</strong></td>
          <td class="muted">SiriusXM's CHH channel. Long lead time. Terms unconfirmed — check first.</td>
          <td class="r"><span class="badge p-good">Free</span></td></tr>
      <tr><td><strong>Amazon Music for Artists</strong></td>
          <td class="muted">Self-serve pitching — the pitch door nobody uses.</td>
          <td class="r"><span class="badge p-good">Free</span></td></tr>
      <tr><td><strong>Spotify editorial pitch</strong></td>
          <td class="muted">14+ days pre-release, one song at a time.</td>
          <td class="r"><span class="badge p-good">Free</span></td></tr>
      <tr><td><strong>Release Radar</strong></td>
          <td class="muted">Auto-served to followers — the payoff for pitching early.</td>
          <td class="r"><span class="badge p-good">Free</span></td></tr>
      <tr><td><strong>Independent CHH playlists</strong></td>
          <td class="muted">Curator-run Spotify lists; contact curators directly.</td>
          <td class="r"><span class="badge p-good">Free</span></td></tr>
      <tr><td><strong>YouTube Official Artist Channel</strong></td>
          <td class="muted">Consolidates fragmented catalog signals. Via DistroKid Goodies.</td>
          <td class="r"><span class="badge p-good">Free</span></td></tr>
      <tr><td><strong>HyperFollow + Meta pixel</strong></td>
          <td class="muted">Turns every link click into a retargetable person.</td>
          <td class="r"><span class="badge p-good">Free</span></td></tr>
    </tbody>
  </table>`)}

${card(`
  <h3>Structural fixes worth real money</h3>
  <p class="muted sm">Not promotion — plumbing. These change what every future release is worth.</p>
  <table class="sm" style="margin-top:8px">
    <thead><tr><th>Fix</th><th>Why it pays</th><th class="r">Cost</th></tr></thead>
    <tbody>
      <tr><td><strong>DistroKid Ultimate</strong></td>
          <td class="muted">5+ artists under one label account, custom label name, Playlister contacts.</td>
          <td class="r">$89.99/yr</td></tr>
      <tr><td><strong>DistroKid Splits</strong></td>
          <td class="muted">Auto-pays JayThaRealist and King Konnect their share. No manual
          disbursement, no resentment.</td>
          <td class="r">+$10/yr each</td></tr>
      <tr><td><strong>Fixer artist consolidation</strong></td>
          <td class="muted">Merges split follower counts into one Release Radar reach.</td>
          <td class="r"><span class="badge p-good">Free</span></td></tr>
      <tr><td><strong>One canonical title format</strong></td>
          <td class="muted">Stops three channels splitting one song's view count three ways.</td>
          <td class="r"><span class="badge p-good">Free</span></td></tr>
      <tr><td><strong>Own ticketed show</strong></td>
          <td class="muted">Converts 237K attention into a bookable, provable draw.</td>
          <td class="r">Venue cost</td></tr>
    </tbody>
  </table>`)}

${card(`
  <h3>Things to be honest about</h3>
  <table class="sm">
    <thead><tr><th style="width:210px">Claim</th><th>Reality</th></tr></thead>
    <tbody>
      <tr><td><strong>Buying playlist placements</strong></td>
          <td class="muted">Playlist Push starts at $250–450 — most of the budget. Playlist-sourced
          streams show ~2% 30-day return-listener rate vs ~11% for algorithmic. Anything guaranteeing
          stream counts is a distribution risk under current fraud enforcement. <strong>Don't.</strong></td></tr>
      <tr><td><strong>YouTube Content ID on leased beats</strong></td>
          <td class="muted">DistroKid's Social Media Pack excludes beats, loops and sample-library
          audio. Enabling it on ineligible tracks produces false claims against other creators and
          against the label's own uploads. <strong>Don't.</strong></td></tr>
      <tr><td><strong>Spotify Discovery Mode</strong></td>
          <td class="muted">Requires 25,000+ monthly listeners and costs a 30% royalty commission.
          Not available at the label's current scale — not worth budgeting for.</td></tr>
      <tr><td><strong>TikTok Spark Ads</strong></td>
          <td class="muted">Cheapest CPM on the market, but the campaign floor is ~$50/day. Out of
          reach at $500/mo. Post organically instead.</td></tr>
      <tr><td><strong>Spotify Ad Studio</strong></td>
          <td class="muted">$250 campaign minimum and 3–5× worse cost-per-stream than Meta. Skip entirely.</td></tr>
      <tr><td><strong>100,000 streams</strong></td>
          <td class="muted">Pays roughly $300–400 in recording royalties. A credibility milestone,
          not a revenue one. Merch and live are where the money is at this scale.</td></tr>
      <tr><td><strong>"Getting on tour"</strong></td>
          <td class="muted">Bookers buy draw, not streams. One sold-out hometown room beats 100K
          streams in every booking conversation.</td></tr>
    </tbody>
  </table>
  <p class="sm muted" style="margin-top:10px">Ad CPM/CPV benchmarks and curator conversion rates come
  from third-party industry sources, not vendor documentation — treat as directional.</p>`)}`;
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
