// Team — label staff who are not recording artists.
//
// They get the same three things an artist gets: a profile, the growth numbers
// from their own link hub, and an editor for that hub. What they deliberately
// do not get is a slot on the public label page, which belongs to the artists.

import { store, canEditHub, isAdmin, sb } from '../data.js';
import { fmt, esc, stat, card, toast } from '../ui.js';

let current = null;
let editorOpen = false;

export function setArg(name) { if (name) current = name; }

/* Named to match the Artists tab so app.js's draw() can read back whichever
   person a tab is showing and write it into the URL, without knowing which tab
   it is talking to. Here it is a team member rather than a recording artist. */
export const currentArtist = () => current;

const list = () => (store.team || []);

const ago = iso => {
  if (!iso) return '—';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 90) return 'just now';
  if (s < 5400) return Math.round(s / 60) + 'm ago';
  if (s < 129600) return Math.round(s / 3600) + 'h ago';
  return Math.round(s / 86400) + 'd ago';
};

export function render() {
  const people = list();
  if (!people.length) {
    return card(`<h3 style="margin:0 0 6px">Team</h3>
      <p class="muted">No staff profiles yet. Managers, engineers and anyone else who is not a
      recording artist lives here rather than on the roster.</p>`);
  }
  if (!current || !people.some(p => p.name === current)) current = people[0].name;
  const m = people.find(p => p.name === current);

  const hubUrl = `${location.origin}/a/${m.slug || ''}`;
  const h = (store.hub || {})[m.name];
  const canEdit = isAdmin() || canEditHub(m.name);
  const linkRows = (store.hubLinks || []).filter(l => l.artist === m.name);

  const chips = people.length > 1 ? `
    <div class="row" style="margin-bottom:16px">
      ${people.map(p => `<button class="chip ${p.name === current ? 'on' : ''}"
        data-member="${esc(p.name)}">${esc(p.name)}</button>`).join('')}
    </div>` : '';

  const initials = m.name.replace(/"[^"]*"/g, '').trim().split(/\s+/)
    .map(w => w[0]).slice(0, 2).join('').toUpperCase();

  const profile = card(`
    <div class="tm-head">
      <div class="tm-photo">
        ${m.image_url
          ? `<img src="${esc(m.image_url)}" alt="${esc(m.name)}">`
          : `<span class="tm-initials">${esc(initials)}</span>`}
      </div>
      <div class="tm-head-body">
        <h3>${esc(m.name)}</h3>
        <p class="tm-role">${esc(m.title)}</p>
        ${m.based ? `<p class="tm-based">${esc(m.based)}</p>` : ''}
        ${m.short ? `<p class="tm-short">${esc(m.short)}</p>` : ''}
        <div class="row" style="margin-top:14px">
          ${m.slug ? `<a class="btn sm" href="${esc(hubUrl)}" target="_blank" rel="noopener">View hub</a>
            <button class="btn sm ghost" id="tm-copy" data-url="${esc(hubUrl)}" type="button">Copy link</button>` : ''}
        </div>
        ${linkRows.length ? `<div class="tm-links">
          ${linkRows.map(l => `<a href="${esc(l.url)}" target="_blank" rel="noopener"
             class="${/store|merch|chariot/i.test(l.label + l.url) ? 'is-store' : ''}"
             >${esc(l.label)}</a>`).join('')}
        </div>` : ''}
        ${!m.image_url ? `<p class="muted sm" style="margin-top:14px">
          No photo on file yet. Add one and it appears here and on the hub.</p>` : ''}
      </div>
    </div>
    ${m.bio ? `<p class="tm-bio">${esc(m.bio)}</p>` : ''}
    ${(m.highlights || []).length ? `
      <h4 class="tm-h">Track record</h4>
      <ul class="tm-list">${m.highlights.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}`);

  const growth = card(`
    <div class="spread" style="flex-wrap:wrap;gap:10px">
      <div>
        <h3 style="margin:0">Hub growth</h3>
        <p class="muted sm" style="margin:.3em 0 0">Every visit and tap on ${esc(m.name)}'s link hub.</p>
      </div>
      ${canEdit ? `<button class="btn sm ghost" id="tm-edit-toggle" type="button">${
        editorOpen ? 'Close editor' : 'Edit hub'}</button>` : ''}
    </div>

    <div class="grid g4" style="margin-top:14px">
      ${stat('Hub views', fmt(h?.views_total || 0), `${fmt(h?.views_7d || 0)} in 7 days`)}
      ${stat('Clicks out', fmt(h?.clicks_total || 0), `${fmt(h?.clicks_7d || 0)} in 7 days`)}
      ${stat('Links live', fmt(linkRows.filter(l => l.active).length), `${linkRows.length} total`)}
      ${stat('Last activity', h?.last_at ? esc(ago(h.last_at)) : '—', 'newest recorded event')}
    </div>

    ${!h ? `<div class="callout" style="margin-top:14px"><strong>No traffic yet.</strong>
      ${m.slug ? 'Share the hub link and every visit lands here the moment it happens.'
        : 'This profile has no slug yet, so it has no public hub.'}</div>` : ''}

    ${!canEdit ? '' : `
    <div id="tm-editor" ${editorOpen ? '' : 'hidden'}>
      <h4 style="margin:22px 0 4px">Hub links</h4>
      <p class="muted sm" style="margin:0 0 10px">Label, destination, on or off. This order is the
        order on the page.</p>
      <div id="tm-editor-rows">
        ${linkRows.map(l => `
          <div class="hub-edit-row" data-id="${l.id}">
            <input type="text" class="he-label" value="${esc(l.label)}" placeholder="Label">
            <input type="text" class="he-url" value="${esc(l.url)}" placeholder="https://…">
            <label class="he-active" title="Show on the hub"><input type="checkbox" ${l.active ? 'checked' : ''}></label>
            <button class="btn sm ghost he-del" type="button" title="Remove">×</button>
          </div>`).join('')}
      </div>
      <div class="row" style="margin-top:10px">
        <button class="btn sm ghost" id="tm-add" type="button">+ Add link</button>
        <button class="btn sm" id="tm-save" type="button">Save changes</button>
      </div>
    </div>`}`);

  return chips + profile + growth;
}

export function bind(mount, rerender) {
  const deleted = new Set();

  mount.addEventListener('click', async e => {
    const chip = e.target.closest('.chip[data-member]');
    if (chip) { current = chip.dataset.member; editorOpen = false; rerender(); return; }

    if (e.target.id === 'tm-edit-toggle') { editorOpen = !editorOpen; rerender(); return; }

    if (e.target.id === 'tm-copy') {
      try {
        await navigator.clipboard.writeText(e.target.dataset.url);
        toast('Hub link copied');
      } catch { toast('Could not copy', 'err'); }
      return;
    }

    if (e.target.id === 'tm-add') {
      const row = document.createElement('div');
      row.className = 'hub-edit-row';
      row.dataset.id = 'new';
      row.innerHTML = `
        <input type="text" class="he-label" placeholder="Label">
        <input type="text" class="he-url" placeholder="https://…">
        <label class="he-active" title="Show on the hub"><input type="checkbox" checked></label>
        <button class="btn sm ghost he-del" type="button" title="Remove">×</button>`;
      mount.querySelector('#tm-editor-rows').appendChild(row);
      return;
    }

    const del = e.target.closest('.he-del');
    if (del) {
      const row = del.closest('.hub-edit-row');
      if (row.dataset.id !== 'new') deleted.add(+row.dataset.id);
      row.remove();
      return;
    }

    if (e.target.id === 'tm-save') {
      const btn = e.target;
      btn.disabled = true; btn.textContent = 'Saving…';
      try {
        const rows = [...mount.querySelectorAll('#tm-editor-rows .hub-edit-row')];
        for (const id of deleted) await sb.from('hub_links').delete().eq('id', id);
        deleted.clear();

        for (const [i, row] of rows.entries()) {
          const patch = {
            artist: current,
            label: row.querySelector('.he-label').value.trim(),
            url: row.querySelector('.he-url').value.trim(),
            active: row.querySelector('.he-active input').checked,
            sort_order: (i + 1) * 10,
            updated_at: new Date().toISOString(),
          };
          if (!patch.label || !patch.url) continue;
          if (row.dataset.id === 'new') await sb.from('hub_links').insert(patch);
          else await sb.from('hub_links').update(patch).eq('id', +row.dataset.id);
        }

        const { data } = await sb.from('hub_links').select('*').order('sort_order');
        store.hubLinks = data || [];
        toast('Hub saved');
        rerender();
      } catch (err) {
        toast(err.message || 'Could not save', 'err');
        btn.disabled = false; btn.textContent = 'Save changes';
      }
    }
  });
}
