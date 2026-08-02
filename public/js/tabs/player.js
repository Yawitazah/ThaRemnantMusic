import { store } from '../data.js';
import { fmt, esc, card, $$ } from '../ui.js';

let current = null;

export function render() {
  const list = [...store.catalog].sort((a, b) => b.views - a.views);
  if (!current) current = list[0];

  const items = list.map(t => `
    <button data-vid="${esc(t.video_id)}" class="${current && t.video_id === current.video_id ? 'on' : ''}">
      <strong>${esc(t.title)}</strong><br>
      <span class="muted sm">${esc(t.credit || '')} · ${fmt(t.views)} views</span>
    </button>`).join('');

  return `
${card(`
  <h2>Player</h2>
  <div class="callout crit">
    <strong>Heads up:</strong> "Allow embedding" is currently OFF on these videos, so the inline
    player will show <code>Error 153</code> until that is fixed. Use "Open on YouTube" meanwhile —
    and treat every grey box here as the same grey box a blog, an EPK or a Rapzilla feature would show.
  </div>`)}

<div class="grid g2" style="grid-template-columns:1.5fr 1fr">
  <section class="card">
    <div class="player-wrap">
      <iframe id="yt" src="https://www.youtube-nocookie.com/embed/${esc(current?.video_id || '')}"
        title="Player" allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
        allowfullscreen loading="lazy"></iframe>
    </div>
    <div class="spread" style="margin-top:14px">
      <div>
        <h3 id="np-title" style="margin:0">${esc(current?.title || '—')}</h3>
        <p class="muted sm" id="np-credit" style="margin:.2em 0 0">${esc(current?.credit || '')}</p>
      </div>
      <a class="btn sm" id="np-link" target="_blank" rel="noopener"
         href="${esc(current?.url || '#')}">Open on YouTube</a>
    </div>
    <p class="sm muted" id="np-meta" style="margin-top:10px">
      ${fmt(current?.views)} views · ${esc(current?.channel || '')} · ${esc(current?.era || '')}
    </p>
  </section>

  <section class="card">
    <h3>Catalog — ${list.length} tracks</h3>
    <input type="text" class="search" id="p-search" placeholder="Filter tracks…" style="margin-bottom:10px">
    <div class="track-list" id="p-list">${items}</div>
  </section>
</div>`;
}

export function bind(mount) {
  const listEl = mount.querySelector('#p-list');
  const search = mount.querySelector('#p-search');

  search?.addEventListener('input', () => {
    const q = search.value.toLowerCase();
    $$('button[data-vid]', listEl).forEach(b => {
      b.style.display = b.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  });

  listEl?.addEventListener('click', e => {
    const btn = e.target.closest('button[data-vid]');
    if (!btn) return;
    const t = store.catalog.find(x => x.video_id === btn.dataset.vid);
    if (!t) return;
    current = t;
    $$('button[data-vid]', listEl).forEach(b => b.classList.toggle('on', b === btn));
    mount.querySelector('#yt').src = `https://www.youtube-nocookie.com/embed/${t.video_id}`;
    mount.querySelector('#np-title').textContent = t.title;
    mount.querySelector('#np-credit').textContent = t.credit || '';
    mount.querySelector('#np-link').href = t.url;
    mount.querySelector('#np-meta').textContent =
      `${fmt(t.views)} views · ${t.channel || ''} · ${t.era || ''}`;
  });
}
