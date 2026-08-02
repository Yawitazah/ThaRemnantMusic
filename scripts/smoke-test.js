// Headless smoke test: renders every tab against mock data and fails on any
// runtime error, so a broken tab is caught before anyone opens the dashboard.
//
//   npm test

import { JSDOM } from 'jsdom';
import { readFile, writeFile, mkdir, rm, cp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
// Built outside the project tree: the working folder may be read-only or synced.
const TMP  = join(tmpdir(), 'remnant-smoke-' + process.pid);

/* ---------- mock data layer (no network, no Supabase) ---------- */
const MOCK = `
export const store = {
  channels: [
    { id:1, name:'Nubreed Global Truth', handle:'@gt', url:'#', subs:237000, videos:2200, recent_avg:17140, kind:'commentary' },
    { id:2, name:'Nubreed Universal Ent.', handle:'@nu', url:'#', subs:18400, videos:245, recent_avg:1406, kind:'music' },
  ],
  roster: [{ id:1, name:'BREED', role:'Lead artist', channel_name:'Global Truth', handle:'@gt',
             subs:237000, videos:2200, recent_avg:17140, secondary:'x', verdict:'y' }],
  catalog: [
    { id:1, video_id:'a1', url:'#', title:'Here Comes Judah', credit:'Shy B.B.D', artists:['breed'], views:132411, era:'Back catalog', channel:'NU', note:null },
    { id:2, video_id:'a2', url:'#', title:'Ring The Alarm', credit:'Nubreed x Yawitizah', artists:['breed','zah'], views:21233, era:'2 years ago', channel:'NU', note:null },
    { id:3, video_id:'a3', url:'#', title:'Filthy Coon', credit:'NuBreed feat. Yawitazah', artists:['breed','zah','album'], views:3471, era:'2026', channel:'NU', note:'best album track' },
    { id:4, video_id:'a4', url:'#', title:'HIGH ALERT', credit:'King Konnect', artists:['king','zah'], views:2018, era:'2y', channel:'KK', note:null },
    { id:5, video_id:'a5', url:'#', title:'Ghetto Blvd', credit:'JayThaRealist', artists:['jay'], views:631, era:'old', channel:'UN', note:null },
  ],
  album: [
    { id:1, track_no:1, title:'Filthy Coon', features:'Yawitazah', released:'2 Jul', video_id:'a3', yt_views:3471, alt_views:null, alt_label:null, spotify:100, apple:50, other:10 },
    { id:2, track_no:2, title:'NO REMEDY', features:'—', released:'12 Jul', video_id:'a6', yt_views:972, alt_views:4797, alt_label:'4,797 on Global Truth', spotify:0, apple:0, other:0 },
  ],
  prior: [{ id:1, title:'Mentions', age:'~1 yr ago', views:14000, format:'Music video' }],
  playbook: [
    { id:1, week:'W1', phase:'Phase 1 — stop the bleeding', task:'Turn on embedding', done:false, note:null },
    { id:2, week:'W1', phase:'Phase 1 — stop the bleeding', task:'Lock the name', done:true, note:'done' },
    { id:3, week:'W3', phase:'Phase 2 — build the engine', task:'Film Sermon-to-Song #1', done:false, note:null },
  ],
  opps: [
    { id:1, move:'Turn ON embedding', owner:'Zah', cost:'$0', timeframe:'1 hour', impact:'critical', status:'Not started' },
    { id:2, move:'Merch line', owner:'Zah', cost:'POD', timeframe:'30 days', impact:'high', status:'In progress' },
  ],
  budget: [
    { id:1, label:'YouTube remarketing', amount:250, rationale:'cheap' },
    { id:2, label:'Meta ads', amount:150, rationale:'efficient' },
  ],
  weeks: [
    { id:1, week_of:'2026-07-27', gt_subs:237000, music_subs:18400, yt_views_28d:400000, spotify_listeners:900, spotify_followers:400, total_streams:5000, revenue:20 },
    { id:2, week_of:'2026-08-03', gt_subs:237500, music_subs:18450, yt_views_28d:410000, spotify_listeners:950, spotify_followers:420, total_streams:6100, revenue:25 },
  ],
  settings: { benchmarks:{ gtAvg:17140, musicAvg:1406, priorAvg:8109, noRemedyBig:4797, noRemedySmall:972, featureAvg:10514, topTenAvg:50245 },
              goal_model:{ perMonth:2, reach:17140, ctr:6, streamsPerListener:3, target:100000 } },
  session: null,
};
export const sb = { auth:{ getSession:async()=>({data:{session:null}}), signOut:async()=>{}, signInWithPassword:async()=>({data:{},error:null}) } };
export let ADMIN = false;
export const __setAdmin = v => { ADMIN = v; };
export const isAdmin = () => ADMIN;
export const loadAll = async () => store;
export const updateRow = async (t,id,patch,list) => { const r=list?.find(x=>x.id===id); if(r) Object.assign(r,patch); return r; };
export const insertRow = async (t,row,list) => { const r={id:Date.now(),...row}; list?.push(r); return r; };
export const deleteRow = async (t,id,list) => { const i=list?.findIndex(x=>x.id===id); if(i>-1) list.splice(i,1); };
export const saveSetting = async (k,v) => { store.settings[k]=v; };
export const bench = () => store.settings.benchmarks;
export const albumTotals = () => { const t={yt:0,spotify:0,apple:0,other:0,streams:0};
  for(const a of store.album){t.yt+=a.yt_views||0;t.spotify+=a.spotify||0;t.apple+=a.apple||0;t.other+=a.other||0;}
  t.streams=t.spotify+t.apple+t.other; return t; };
export const playbookProgress = () => { const done=store.playbook.filter(p=>p.done).length;
  return {done,total:store.playbook.length,pct:store.playbook.length?done/store.playbook.length*100:0}; };
export const catalogStats = () => { const c=store.catalog; const by=t=>c.filter(x=>(x.artists||[]).includes(t));
  const sum=l=>l.reduce((s,t)=>s+(t.views||0),0); const avg=l=>l.length?Math.round(sum(l)/l.length):0;
  const top10=[...c].sort((a,b)=>b.views-a.views).slice(0,10);
  return { total:c.length, totalViews:sum(c), breed:by('breed').length, king:by('king').length, jay:by('jay').length,
           featureAvg:avg(by('zah')), albumAvg:avg(by('album')), top10Avg:avg(top10), top10 }; };
`;

/* ---------- build an isolated copy with the mock swapped in ---------- */
await rm(TMP, { recursive: true, force: true });
await mkdir(TMP, { recursive: true });
await cp(join(ROOT, 'public', 'js'), join(TMP, 'js'), { recursive: true });
await writeFile(join(TMP, 'js', 'data.js'), MOCK, 'utf8');

/* ---------- fake browser ---------- */
const html = await readFile(join(ROOT, 'public', 'index.html'), 'utf8');
const dom = new JSDOM(html, { url: 'http://localhost/', pretendToBeVisual: true });
for (const k of ['window', 'document', 'HTMLElement', 'Node', 'Event', 'CustomEvent',
                 'getComputedStyle', 'localStorage', 'history']) {
  try { globalThis[k] = dom.window[k]; } catch { /* read-only global in this Node build */ }
}
globalThis.confirm = () => true;

const TABS = ['diagnosis', 'roster', 'player', 'catalog', 'ledger', 'playbook', 'opps', 'budget', 'tracker'];
const data = await import(pathToFileURL(join(TMP, 'js', 'data.js')).href);

let failed = 0;
for (const mode of ['read-only', 'admin']) {
  data.__setAdmin(mode === 'admin');
  for (const name of TABS) {
    try {
      const mod = await import(pathToFileURL(join(TMP, 'js', 'tabs', `${name}.js`)).href + `?m=${mode}`);
      const mount = dom.window.document.querySelector('#view');
      const out = mod.render();
      if (typeof out !== 'string' || out.length < 50) throw new Error('render() returned nothing useful');
      mount.innerHTML = out;
      mod.bind?.(mount, () => {});
      if (/undefined|\[object Object\]|NaN/.test(out.replace(/undefined:/g, ''))) {
        const hit = out.match(/.{0,45}(undefined|\[object Object\]|NaN).{0,45}/);
        throw new Error(`suspicious output near: …${hit?.[0].trim()}…`);
      }
      console.log(`  ok   ${mode.padEnd(9)} ${name}`);
    } catch (err) {
      failed++;
      console.error(`  FAIL ${mode.padEnd(9)} ${name}: ${err.message}`);
    }
  }
}

await rm(TMP, { recursive: true, force: true });
console.log(failed ? `\n${failed} tab render(s) failed.` : '\nAll tabs render in both modes.');
process.exit(failed ? 1 : 0);
