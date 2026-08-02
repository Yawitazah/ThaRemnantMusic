import { store } from '../data.js';
import { fmt, esc, hbar, bindBars, card, cvar } from '../ui.js';

const chanRows = () => store.channels.map(c => ({
  k: c.name.length > 26 ? c.name.slice(0, 25) + '…' : c.name,
  v: c.subs,
  color: c.subs > 100000 ? cvar('--good') : c.subs > 10000 ? cvar('--series-1') : cvar('--text-muted'),
  note: `${fmt(c.videos)} videos · ~${fmt(c.recent_avg)} views each · ${c.kind || ''}`,
}));

const reachRows = () => store.channels.filter(c => c.recent_avg > 0).map(c => ({
  k: c.name.length > 26 ? c.name.slice(0, 25) + '…' : c.name,
  v: c.recent_avg,
  color: c.recent_avg > 10000 ? cvar('--good') : cvar('--series-2'),
  note: `${fmt(c.subs)} subscribers`,
}));

export function render() {
  const cards = store.roster.map(a => `
    <section class="card">
      <div class="spread">
        <h3 style="margin:0">${esc(a.name)}</h3>
        <span class="badge ${a.subs > 100000 ? 'p-good' : a.subs > 500 ? 'p-info' : 'p-mute'}">
          ${a.subs ? fmt(a.subs) + ' subs' : 'features only'}
        </span>
      </div>
      <p class="muted sm" style="margin:.3em 0 .8em">${esc(a.role || '')}</p>
      <div class="grid g3" style="margin-bottom:12px">
        <div class="stat"><div class="k">Channel</div>
          <div class="n" style="font-size:.9rem;margin-top:4px">${esc(a.channel_name || '—')}<br>
          <span class="muted">${esc(a.handle || '')}</span></div></div>
        <div class="stat"><div class="k">Videos</div><div class="v">${a.videos ? fmt(a.videos) : '—'}</div></div>
        <div class="stat"><div class="k">Avg views</div><div class="v">${a.recent_avg ? fmt(a.recent_avg) : '—'}</div></div>
      </div>
      ${a.secondary ? `<p class="sm muted">${esc(a.secondary)}</p>` : ''}
      <div class="callout sm">${esc(a.verdict || '')}</div>
    </section>`).join('');

  return `
${card(`
  <h2>Reach by channel</h2>
  <p class="muted sm">Subscribers across every channel the label controls.</p>
  <div id="subs-chart">${hbar(chanRows(), { rowH: 30, padL: 200, aria: 'Subscribers by channel' })}</div>
  <h3 style="margin-top:22px">What each channel actually reaches</h3>
  <p class="muted sm">Average views per recent upload — the number that matters more than subscriber count.</p>
  <div id="reach-chart">${hbar(reachRows(), { rowH: 30, padL: 200, aria: 'Average views by channel' })}</div>`)}

<h2 style="margin:22px 0 12px">Where each artist stands</h2>
${cards}
`;
}

export function bind(mount) {
  bindBars(mount.querySelector('#subs-chart'),
    store.channels.map(c => ({ k: c.name, v: c.subs,
      note: `${fmt(c.videos)} videos · ~${fmt(c.recent_avg)} views each` })));
  bindBars(mount.querySelector('#reach-chart'),
    store.channels.filter(c => c.recent_avg > 0)
      .map(c => ({ k: c.name, v: c.recent_avg, note: `${fmt(c.subs)} subscribers` })));
}
