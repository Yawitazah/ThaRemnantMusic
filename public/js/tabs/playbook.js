import { store, isAdmin, updateRow, playbookProgress } from '../data.js';
import { esc, card, toast, $$, banner } from '../ui.js';

export function render() {
  const admin = isAdmin();
  const p = playbookProgress();

  const phases = [...new Set(store.playbook.map(i => i.phase))];
  const sections = phases.map(phase => {
    const items = store.playbook.filter(i => i.phase === phase);
    const done = items.filter(i => i.done).length;
    const weeks = [...new Set(items.map(i => i.week))];

    const groups = weeks.map(w => `
      <tr><td colspan="3" style="padding-top:14px">
        <span class="badge p-info">${esc(w)}</span></td></tr>
      ${items.filter(i => i.week === w).map(i => `
        <tr data-id="${i.id}" class="${i.done ? 'done' : ''}">
          <td style="width:34px"><input type="checkbox" ${i.done ? 'checked' : ''} ${admin ? '' : 'disabled'}></td>
          <td class="task">${esc(i.task)}</td>
          <td style="width:150px">
            <input type="text" class="note" placeholder="${admin ? 'note…' : ''}"
              value="${esc(i.note || '')}" ${admin ? '' : 'disabled'}>
          </td>
        </tr>`).join('')}`).join('');

    return `<section class="card">
      <div class="spread">
        <h3 style="margin:0">${esc(phase)}</h3>
        <span class="badge ${done === items.length ? 'p-good' : 'p-mute'}">${done}/${items.length}</span>
      </div>
      <table style="margin-top:8px"><tbody>${groups}</tbody></table>
    </section>`;
  }).join('');

  return `
${banner({ id: 'NYbj22DOSrU', title: '90-day playbook', sub: 'Twenty-eight moves across three phases. Almost all of them are free.' })}
${card(`
  <h2>90-day execution checklist</h2>
  <p class="muted sm">Nothing here had been started as of 2 August 2026. Tick items as they land —
  the whole team sees the same progress.</p>
  <div class="spread" style="margin:16px 0 8px">
    <strong id="pb-count">${p.done} of ${p.total} complete</strong>
    <span class="muted num" id="pb-pct">${Math.round(p.pct)}%</span>
  </div>
  <div class="progress"><i id="pb-bar" style="width:${p.pct}%"></i></div>
  <p class="sm muted" style="margin-top:12px">Tell Claude what is done and the checklist updates.</p>`)}

${card(`
  <h3>Do these first — and why</h3>
  <p class="muted sm">Two moves carry more weight than everything else on the list combined.
  Both cost nothing.</p>

  <div class="callout crit" style="margin-top:14px">
    <span class="badge p-crit">do first</span> <span class="badge p-mute">$0</span>
    <h4 style="margin:.5em 0 .3em">Kill the two-channel split for music</h4>
    <p class="sm">Music videos, visualisers and song-story content move to
    <strong>Nubreed Global Truth</strong>. Nubreed Universal Ent. stays alive as the catalog archive,
    but it stops being the primary release door. Cross-posting the same song under three titles on
    three channels stops entirely — one canonical upload, everything else links to it.</p>
    <p class="sm muted" style="margin:0"><strong>Why:</strong> the A/B test already ran, by accident.
    NO REMEDY did 4,797 on the big channel and 972 on the small one. That is not a theory,
    it is a result.</p>
  </div>

  <div class="callout crit">
    <span class="badge p-crit">do first</span> <span class="badge p-mute">$0</span>
    <h4 style="margin:.5em 0 .3em">Lock one name and one spelling, forever</h4>
    <p class="sm">Pick <strong>BREED</strong>. It is already on half the new uploads, it sidesteps the
    established country-rap act "Nu Breed" that owns the search results, and it is short enough to
    read on a thumbnail.</p>
    <p class="sm muted" style="margin:0">Then enforce it everywhere, zero variation:
    <strong>BREED</strong> — not Nubreed, NuBreed, Nu Breed, IamNubreed or Nubreed Universal.
    <strong>JayThaRealist</strong> — not JayTheRealest or Jay the Realist.
    <strong>Yawitazah</strong> — not Yawitizah or Yahwitizah.
    Title format every single time: <code>BREED – Song Name (feat. X)</code></p>
  </div>`)}
${sections}`;
}

export function bind(mount) {
  if (!isAdmin()) return;

  const refresh = () => {
    const p = playbookProgress();
    mount.querySelector('#pb-count').textContent = `${p.done} of ${p.total} complete`;
    mount.querySelector('#pb-pct').textContent = Math.round(p.pct) + '%';
    mount.querySelector('#pb-bar').style.width = p.pct + '%';
    // per-phase counters
    $$('.card', mount).forEach(c => {
      const h = c.querySelector('h3'); if (!h) return;
      const items = store.playbook.filter(i => i.phase === h.textContent);
      if (!items.length) return;
      const done = items.filter(i => i.done).length;
      const badge = c.querySelector('.badge');
      badge.textContent = `${done}/${items.length}`;
      badge.className = 'badge ' + (done === items.length ? 'p-good' : 'p-mute');
    });
  };

  mount.addEventListener('change', async e => {
    const tr = e.target.closest('tr[data-id]');
    if (!tr) return;
    const id = +tr.dataset.id;

    if (e.target.type === 'checkbox') {
      const done = e.target.checked;
      e.target.disabled = true;
      try {
        await updateRow('playbook_items', id, { done }, store.playbook);
        tr.classList.toggle('done', done);
        refresh();
        toast(done ? 'Ticked off' : 'Reopened');
      } catch (err) {
        e.target.checked = !done;
        toast('Save failed: ' + err.message, 'err');
      } finally { e.target.disabled = false; }
    }

    if (e.target.classList.contains('note')) {
      const note = e.target.value.trim() || null;
      try {
        await updateRow('playbook_items', id, { note }, store.playbook);
        toast('Note saved');
      } catch (err) { toast('Save failed: ' + err.message, 'err'); }
    }
  });
}
