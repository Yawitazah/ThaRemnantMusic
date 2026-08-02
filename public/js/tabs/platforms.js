import { store, isAdmin, updateRow } from '../data.js';
import { fmt, esc, hbar, bindBars, stat, card, cvar, toast, banner } from '../ui.js';

const STATUS = ['verified', 'needs check', 'unverified', 'action required', 'claimed'];
const STATUS_CLASS = {
  verified:          'p-good',
  claimed:           'p-good',
  'needs check':     'p-warn',
  unverified:        'p-warn',
  'action required': 'p-crit',
};

const GROUPS = [
  { key: 'YouTube',  match: p => p.platform === 'YouTube' },
  { key: 'Spotify',  match: p => p.platform === 'Spotify' },
  { key: 'Owned web & social', match: p => !['YouTube', 'Spotify'].includes(p.platform) },
];

const linkCell = p => p.url
  ? `<a href="${esc(p.url)}" target="_blank" rel="noopener"><strong>${esc(p.label)}</strong></a>`
  : `<strong>${esc(p.label)}</strong>`;

export function render() {
  const admin = isAdmin();
  const ours = store.collisions.find(c => c.is_ours);
  const biggest = store.collisions
    .filter(c => !c.is_ours && c.monthly_listeners)
    .sort((a, b) => b.monthly_listeners - a.monthly_listeners)[0];
  const ratio = ours && biggest && ours.monthly_listeners
    ? Math.round(biggest.monthly_listeners / ours.monthly_listeners) : null;

  const collisionRows = store.collisions
    .filter(c => c.monthly_listeners !== null && c.monthly_listeners !== undefined)
    .map(c => ({
      k: c.name_used.length > 24 ? c.name_used.slice(0, 23) + '…' : c.name_used,
      v: c.monthly_listeners,
      color: c.is_ours ? cvar('--critical') : cvar('--text-muted'),
      note: `${c.genre} · ${c.is_ours ? 'OURS' : 'not ours'}`,
    }));

  const sections = GROUPS.map(g => {
    const rows = store.platforms.filter(g.match);
    if (!rows.length) return '';
    return `
${banner({ id: 'Ew8a4T182Vw', title: 'Platforms & identity', sub: 'Every place the label exists, with the link and the ID so anything here can be checked.' })}
    <section class="card">
      <h3>${esc(g.key)}</h3>
      <div class="tbl-wrap" style="max-height:none;margin-top:10px">
        <table>
          <thead><tr>
            <th style="width:28%">Asset</th><th>ID</th><th class="r">Metric</th>
            <th>Owner</th><th>Status</th><th style="width:30%">Notes</th>
          </tr></thead>
          <tbody>
            ${rows.map(p => `
              <tr data-id="${p.id}">
                <td>${linkCell(p)}${p.url ? `<br><span class="muted sm">${esc(p.url.replace(/^https?:\/\//, ''))}</span>` : ''}</td>
                <td class="muted sm"><code>${esc(p.identifier || '—')}</code></td>
                <td class="r num">${p.metric_value !== null && p.metric_value !== undefined
                    ? `<strong>${fmt(p.metric_value)}</strong><br><span class="muted sm">${esc(p.metric || '')}</span>`
                    : '—'}</td>
                <td class="muted sm">${esc(p.owner || '—')}</td>
                <td>${admin
                    ? `<select data-status>${STATUS.map(s =>
                        `<option ${p.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select>`
                    : `<span class="badge ${STATUS_CLASS[p.status] || 'p-mute'}">${esc(p.status)}</span>`}</td>
                <td class="muted sm">${esc(p.note || '')}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </section>`;
  }).join('');

  return `
${card(`
  <h2>Platforms &amp; identity</h2>
  <p class="muted sm">Every place the label exists, with the link and the ID, so anything here can be
  opened and checked rather than taken on trust. Verified live 2 August 2026.</p>
  <div class="grid g4" style="margin-top:14px">
    ${stat('Assets tracked', fmt(store.platforms.length), 'across all platforms')}
    ${stat('Verified', fmt(store.platforms.filter(p => p.status === 'verified').length), 'confirmed live', 'good')}
    ${stat('Need action', fmt(store.platforms.filter(p => p.status === 'action required' || p.status === 'needs check').length), 'unclaimed or unchecked', 'crit')}
    ${stat('Name collisions', fmt(store.collisions.filter(c => !c.is_ours).length), 'other acts using the name', 'warn')}
  </div>`)}

${card(`
  <h3>Two things to fix today</h3>
  <div class="callout crit">
    <strong>1 — Tracks were removed from DistroKid.</strong> Breed set up the Spotify page and
    didn't finish it, and several songs that were on it are gone. That is why the canonical artist
    page shows almost nothing. Nobody knows why they came down. Until that is answered, every
    distribution decision is being made on an incomplete catalog.
  </div>
  <div class="callout crit">
    <strong>2 — The one live single may be geo-blocked.</strong> The page metadata for the
    <a href="https://open.spotify.com/album/0LbQ39Z6Sap4qZ0r3p4p2M" target="_blank" rel="noopener">Nubreed single</a>
    lists its allowed territory as <code>XK</code> — Kosovo — and nothing else. That field is not
    always reliable, so treat it as a lead rather than a fact. But if it is real it would explain
    11 monthly listeners on its own, and it is a ten-minute check in DistroKid.
  </div>`)}

${card(`
  <h3>The name collision, measured</h3>
  <p class="muted sm">Four separate acts release under this name on Spotify. Monthly listeners,
  side by side.</p>
  <div id="col-chart">${hbar(collisionRows, { rowH: 32, padL: 210, aria: 'Name collision by monthly listeners' })}</div>
  ${ratio ? `<div class="callout crit" style="margin-top:14px">
    The country-rap act is roughly <strong>${fmt(ratio)}×</strong> larger than the label's own page.
    Anyone searching the name finds them. This is why the naming decision is not cosmetic.
  </div>` : ''}
  <div class="tbl-wrap" style="max-height:none;margin-top:14px">
    <table>
      <thead><tr>
        <th>Name used</th><th>Genre</th><th class="r">Monthly listeners</th>
        <th class="r">Followers</th><th>Biggest track</th><th>Whose</th>
      </tr></thead>
      <tbody>
        ${store.collisions.map(c => `
          <tr${c.is_ours ? ' style="background:var(--surface-2)"' : ''}>
            <td>${c.url ? `<a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.name_used)}</a>`
                        : `<strong>${esc(c.name_used)}</strong>`}
                <br><span class="muted sm"><code>${esc(c.identifier || '—')}</code></span></td>
            <td class="muted sm">${esc(c.genre || '')}</td>
            <td class="r num">${c.monthly_listeners !== null ? fmt(c.monthly_listeners) : '—'}</td>
            <td class="r num">${c.followers !== null ? fmt(c.followers) : '—'}</td>
            <td class="muted sm">${esc(c.biggest_track || '—')}
                ${c.biggest_plays ? `<br>${fmt(c.biggest_plays)} plays` : ''}</td>
            <td>${c.is_ours ? '<span class="badge p-crit">OURS</span>'
                            : '<span class="badge p-mute">not ours</span>'}</td>
          </tr>`).join('')}
      </tbody>
    </table>
  </div>
  <p class="sm muted" style="margin-top:12px">Note the breakbeat producer's page also carries a 2010
  Christian rap album — a real example of unrelated releases landing on the wrong artist profile,
  which is the same failure the DistroKid Fixer work is meant to prevent.</p>`)}

${sections}

${card(`
  <h3>Claim checklist</h3>
  <p class="muted sm">In order. All free, all doable this week.</p>
  <table class="kv"><tbody>
    <tr><td>1</td><td class="wrap">Find out why tracks were pulled from DistroKid and get them back</td></tr>
    <tr><td>2</td><td class="wrap">Check the Nubreed single for territory restrictions</td></tr>
    <tr><td>3</td><td class="wrap">Claim <code>0CX5ps3otNFIPijHKVwcod</code> in Spotify for Artists — that is the canonical page</td></tr>
    <tr><td>4</td><td class="wrap">Claim the Yawitazah page, add an image and a bio</td></tr>
    <tr><td>5</td><td class="wrap">Audit King Konnect and JayThaRealist for duplicate profiles the same way</td></tr>
    <tr><td>6</td><td class="wrap">Point every YouTube description and the Shopify store at the canonical page</td></tr>
    <tr><td>7</td><td class="wrap">File DistroKid Fixer requests for anything landing on the wrong profile</td></tr>
  </tbody></table>
  <p class="sm muted" style="margin-top:12px">Tell Claude what has been claimed and the statuses update.</p>`)}`;
}

export function bind(mount) {
  const rows = store.collisions
    .filter(c => c.monthly_listeners !== null && c.monthly_listeners !== undefined)
    .map(c => ({ k: c.name_used, v: c.monthly_listeners,
                 note: `${c.genre} · ${c.is_ours ? 'OURS' : 'not ours'}` }));
  bindBars(mount.querySelector('#col-chart'), rows);

  if (!isAdmin()) return;
  mount.addEventListener('change', async e => {
    const sel = e.target.closest('select[data-status]');
    if (!sel) return;
    const id = +sel.closest('tr').dataset.id;
    sel.disabled = true;
    try {
      await updateRow('platforms', id, { status: sel.value }, store.platforms);
      toast('Status updated');
    } catch (err) {
      toast('Save failed: ' + err.message, 'err');
    } finally { sel.disabled = false; }
  });
}
