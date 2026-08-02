// Shared UI helpers: formatting, escaping, charts, toasts.

export const $  = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export const fmt = n =>
  (n === null || n === undefined || isNaN(n)) ? '—' : Math.round(n).toLocaleString('en-US');

export const money = n =>
  (n === null || n === undefined || isNaN(n)) ? '—' : '$' + Number(n).toLocaleString('en-US');

export const esc = s => String(s ?? '').replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const cvar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

/* ---------- tooltip ---------- */
const tipEl = () => $('#tip');
export function showTip(e, html) {
  const t = tipEl(); if (!t) return;
  t.innerHTML = html; t.hidden = false;
  t.style.left = Math.min(e.clientX + 14, window.innerWidth - 290) + 'px';
  t.style.top  = Math.min(e.clientY + 14, window.innerHeight - 90) + 'px';
}
export function hideTip() { const t = tipEl(); if (t) t.hidden = true; }

/* ---------- toast ---------- */
let toastTimer;
export function toast(msg, kind = 'ok') {
  let el = $('#toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.style.cssText =
      'position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:120;' +
      'padding:10px 18px;border-radius:8px;font-size:.85rem;font-weight:550;' +
      'box-shadow:0 6px 24px rgba(0,0,0,.35);transition:opacity .2s;';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.background = kind === 'err' ? cvar('--critical') : cvar('--series-3');
  el.style.color = '#fff';
  el.style.opacity = '1';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.style.opacity = '0'; }, 2200);
}

/* ---------- horizontal bar chart ---------- */
/**
 * rows: [{ k: label, v: value, color?, note? }]
 * opts: { rowH, padL, ref, refLabel, aria }
 */
export function hbar(rows, opts = {}) {
  if (!rows.length) return '<p class="muted sm">No data.</p>';
  const W = opts.width || 720;
  const rowH = opts.rowH || 30;
  const padL = opts.padL || 168, padR = 76, padT = 6, padB = opts.ref ? 22 : 6;
  const H = padT + rows.length * rowH + padB;
  const vals = rows.map(r => r.v).concat(opts.ref ? [opts.ref] : []);
  const max = Math.max(...vals) * 1.08 || 1;
  const plotW = W - padL - padR;
  const sc = v => (v / max) * plotW;

  const axisH = opts.axis === false ? 0 : 16;
  const H2 = H + axisH;
  const baseY = padT + rows.length * rowH;

  let s = `<svg viewBox="0 0 ${W} ${H2}" role="img" aria-label="${esc(opts.aria || 'bar chart')}">`;
  for (let i = 0; i <= 4; i++) {
    const gx = padL + (plotW / 4) * i;
    if (i > 0) s += `<line class="grid-line" x1="${gx}" y1="${padT}" x2="${gx}" y2="${baseY}"/>`;
    if (axisH) {
      s += `<text class="axis-tick" x="${gx}" y="${H2 - 3}" text-anchor="${i === 0 ? 'start' : 'middle'}">${fmt((max / 4) * i)}</text>`;
    }
  }
  rows.forEach((r, i) => {
    const y = padT + i * rowH, bh = 14, by = y + (rowH - bh) / 2;
    const w = Math.max(sc(r.v), 2);
    const col = r.color || cvar('--series-1');
    s += `<text class="bar-label" x="${padL - 8}" y="${by + 11}" text-anchor="end">${esc(r.k)}</text>`;
    s += `<rect x="${padL}" y="${by}" width="${w}" height="${bh}" rx="3" fill="${col}"
            data-i="${i}" style="cursor:default"/>`;
    s += `<text class="bar-val" x="${padL + w + 7}" y="${by + 11}">${fmt(r.v)}</text>`;
  });
  if (opts.ref) {
    const rx = padL + sc(opts.ref);
    s += `<line x1="${rx}" y1="${padT}" x2="${rx}" y2="${padT + rows.length * rowH}"
            stroke="${cvar('--warning')}" stroke-width="1.5" stroke-dasharray="4 3"/>`;
    s += `<text class="bar-label" x="${rx}" y="${H - 6}" text-anchor="middle"
            fill="${cvar('--warning')}">${esc(opts.refLabel || fmt(opts.ref))}</text>`;
  }
  return s + '</svg>';
}

/** Attach hover tooltips to bars rendered by hbar(). */
export function bindBars(container, rows) {
  $$('rect[data-i]', container).forEach(rect => {
    rect.addEventListener('mousemove', e => {
      const r = rows[+rect.dataset.i]; if (!r) return;
      showTip(e, `<strong>${esc(r.k)}</strong><br>${fmt(r.v)}` +
        (r.note ? `<br><span class="muted">${esc(r.note)}</span>` : ''));
    });
    rect.addEventListener('mouseleave', hideTip);
  });
}

/* ---------- line chart (weekly trend) ---------- */
export function line(points, opts = {}) {
  const pts = points.filter(p => p.v !== null && p.v !== undefined && !isNaN(p.v));
  if (pts.length < 2) return '<p class="muted sm">Log at least two weeks to see a trend.</p>';
  const W = 720, H = opts.height || 210, padL = 56, padR = 14, padT = 12, padB = 30;
  const max = Math.max(...pts.map(p => p.v)) * 1.1 || 1;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const x = i => padL + (plotW * i) / (pts.length - 1);
  const y = v => padT + plotH - (v / max) * plotH;

  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.aria || 'trend')}">`;
  for (let i = 0; i <= 3; i++) {
    const gy = padT + (plotH / 3) * i;
    s += `<line class="grid-line" x1="${padL}" y1="${gy}" x2="${W - padR}" y2="${gy}"/>`;
    s += `<text class="bar-label" x="${padL - 8}" y="${gy + 4}" text-anchor="end">${fmt(max - (max / 3) * i)}</text>`;
  }
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  s += `<path d="${d}" fill="none" stroke="${cvar('--series-1')}" stroke-width="2.5"
          stroke-linejoin="round" stroke-linecap="round"/>`;
  pts.forEach((p, i) => {
    s += `<circle cx="${x(i).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="3.5" fill="${cvar('--series-1')}"/>`;
    if (i === 0 || i === pts.length - 1 || pts.length <= 8) {
      s += `<text class="bar-label" x="${x(i).toFixed(1)}" y="${H - 10}" text-anchor="middle">${esc(p.k)}</text>`;
    }
  });
  return s + '</svg>';
}

/* ---------- small builders ---------- */
export const stat = (k, v, note, cls = '') =>
  `<div class="stat ${cls}"><div class="k">${esc(k)}</div><div class="v">${v}</div>` +
  (note ? `<div class="n">${note}</div>` : '') + '</div>';

export const card = (inner, cls = '') => `<section class="card ${cls}">${inner}</section>`;
