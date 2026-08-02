import { store } from '../data.js';
import { fmt, esc, hbar, bindBars, card, cvar } from '../ui.js';

const STAGE_CLASS = {
  established: 'p-good',
  declining:   'p-crit',
  developing:  'p-info',
  stray:       'p-warn',
};
const stageClass = s => STAGE_CLASS[(s || '').toLowerCase()] || 'p-mute';

const withChannel = () => store.channels.filter(c => c.subs > 0 || c.videos > 0);

const subsRows = () => withChannel().map(c => ({
  k: c.name.length > 24 ? c.name.slice(0, 23) + '…' : c.name,
  v: c.subs,
  color: c.subs > 100000 ? cvar('--series-1')
       : c.subs > 10000  ? cvar('--series-2')
       : cvar('--text-muted'),
  note: `${fmt(c.videos)} videos · ~${fmt(c.recent_avg)} views each`,
}));

const reachRows = () => withChannel().filter(c => c.recent_avg > 0).map(c => ({
  k: c.name.length > 24 ? c.name.slice(0, 23) + '…' : c.name,
  v: c.recent_avg,
  color: c.recent_avg > 10000 ? cvar('--good') : cvar('--series-2'),
  note: `${fmt(c.subs)} subscribers`,
}));

/* A label/value row — the readable alternative to a wall of stat blocks. */
const kv = (label, value, wrap = false) =>
  `<tr><td>${esc(label)}</td><td class="${wrap ? 'wrap' : ''}">${value}</td></tr>`;

export function render() {
  const cards = store.roster.map(a => {
    const own = store.channels.find(c => c.artist_name === a.name && c.subs > 0);
    const stage = own?.stage || (a.subs ? '' : 'feature / ops');
    return `
    <section class="card">
      <div class="spread" style="align-items:center">
        <span class="artist-name">${esc(a.name)}</span>
        ${stage ? `<span class="badge ${stageClass(stage)}">${esc(stage)}</span>` : ''}
      </div>
      <p class="muted sm" style="margin:.35em 0 .9em">${esc(a.role || '')}</p>
      <table class="kv"><tbody>
        ${kv('Primary channel', `<strong>${esc(a.channel_name || '—')}</strong>`)}
        ${kv('Subscribers', a.subs ? fmt(a.subs) : '—')}
        ${kv('Videos', a.videos ? fmt(a.videos) : '—')}
        ${kv('Recent avg views', a.recent_avg ? fmt(a.recent_avg) : '—')}
        ${a.secondary ? kv('Also', esc(a.secondary), true) : ''}
      </tbody></table>
      <p class="verdict">${esc(a.verdict || '')}</p>
    </section>`;
  }).join('');

  const standings = store.channels.map(c => `
    <tr>
      <td><strong>${esc(c.artist_name || '—')}</strong></td>
      <td class="muted">${esc(c.name)}</td>
      <td class="r num">${c.subs ? fmt(c.subs) : '—'}</td>
      <td class="r num">${c.videos ? fmt(c.videos) : '—'}</td>
      <td class="r num">${c.recent_avg ? fmt(c.recent_avg) : '—'}</td>
      <td><span class="badge ${stageClass(c.stage)}">${esc(c.stage || '—')}</span></td>
      <td class="muted sm">${esc(c.milestone || '')}</td>
    </tr>`).join('');

  const gt = store.channels.find(c => c.stage === 'established');
  const mus = store.channels.find(c => c.stage === 'declining');
  const ratio = gt && mus && mus.subs ? Math.round(gt.subs / mus.subs) : null;

  return `
${card(`
  <h2>Reach by channel</h2>
  <p class="muted sm">Subscribers, linear scale — the disparity is the point.</p>
  <div id="subs-chart">${hbar(subsRows(), { rowH: 32, padL: 200, aria: 'Subscribers by channel' })}</div>
  ${ratio ? `<div class="callout" style="margin-top:14px">
    The commentary channel is <strong>${ratio}× larger</strong> than the channel the music goes out on.
    Nothing else on this page matters as much as that one line.
  </div>` : ''}`)}

${card(`
  <h3>What each channel actually reaches</h3>
  <p class="muted sm">Average views per recent upload — the number that matters more than
  subscriber count, because it is what a new release can expect on day one.</p>
  <div id="reach-chart">${hbar(reachRows(), { rowH: 32, padL: 200, aria: 'Average views by channel' })}</div>`)}

<h2 style="margin:26px 0 14px">The roster</h2>
<div class="grid g2" style="grid-template-columns:repeat(auto-fit,minmax(330px,1fr))">
  ${cards}
</div>

${card(`
  <h3>Where each channel actually stands</h3>
  <p class="muted sm">Every channel the label controls, what condition it is in, and the single
  next move for each.</p>
  <div class="tbl-wrap" style="max-height:none;margin-top:10px">
    <table>
      <thead><tr>
        <th>Artist</th><th>Channel</th>
        <th class="r">Subs</th><th class="r">Videos</th><th class="r">Recent avg</th>
        <th>Stage</th><th>Next milestone</th>
      </tr></thead>
      <tbody>${standings}</tbody>
    </table>
  </div>`)}`;
}

export function bind(mount) {
  bindBars(mount.querySelector('#subs-chart'),
    withChannel().map(c => ({ k: c.name, v: c.subs,
      note: `${fmt(c.videos)} videos · ~${fmt(c.recent_avg)} views each` })));
  bindBars(mount.querySelector('#reach-chart'),
    withChannel().filter(c => c.recent_avg > 0)
      .map(c => ({ k: c.name, v: c.recent_avg, note: `${fmt(c.subs)} subscribers` })));
}
