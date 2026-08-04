// Data layer — one Supabase client, one in-memory store, small CRUD helpers.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { SUPABASE_URL, SUPABASE_ANON_KEY, FALLBACK_BENCHMARKS } from './config.js';

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});

export const store = {
  channels: [],
  roster: [],
  catalog: [],
  album: [],
  prior: [],
  playbook: [],
  opps: [],
  budget: [],
  weeks: [],
  platforms: [],
  collisions: [],
  zahTracks: [],
  projects: [],
  profiles: [],
  releases: [],
  settings: {},
  session: null,
  hub: {},        // per-artist link-hub analytics, from hub_summary()
  hubRecent: [],  // sanitised recent activity feed, from hub_recent()
  loadErrors: [], // tables that failed this load, surfaced in the top bar
  isAdminUser: false,
  isTeam: false,  // admin or any claimed-invite account
  myArtist: null, // artist this signed-in account belongs to, if any
};

// Viewing stays open to everyone. Signing in (magic link) unlocks editing:
// admins edit everything, an artist account edits its own link hub.
export const isAdmin = () => store.isAdminUser;
export const canEditHub = artist => store.isAdminUser || store.myArtist === artist;

export async function initSession() {
  try {
    const { data: { session } } = await sb.auth.getSession();
    store.session = session;
    if (session) {
      const [{ data: adm }, { data: mine }, { data: team }] = await Promise.all([
        sb.rpc('is_admin'), sb.rpc('my_artist'), sb.rpc('is_team'),
      ]);
      store.isAdminUser = !!adm;
      store.myArtist = mine || null;
      store.isTeam = !!team;
    } else {
      store.isAdminUser = false;
      store.myArtist = null;
      store.isTeam = false;
    }
  } catch { /* auth is optional — the public dashboard works without it */ }
}

export async function signIn(email) {
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: location.origin + location.pathname },
  });
  if (error) throw error;
}

/* Password flow — the team sets their own credentials on /join. */
export async function signUpPassword(email, password) {
  const { data, error } = await sb.auth.signUp({
    email, password,
    options: { emailRedirectTo: location.origin + '/join' },
  });
  if (error) throw error;
  return data;
}

export async function signInPassword(email, password) {
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  await initSession();
  return data;
}

/* One login for everything: the CRM trusts our Supabase session. The bridge
   at zahcrm.com verifies the token and opens the shared label account. */
export const crmSsoUrl = () => store.session?.access_token
  ? `https://zahcrm.com/sso/remnant?token=${encodeURIComponent(store.session.access_token)}`
  : 'https://zahcrm.com';

export async function claimInvite(code) {
  const { data, error } = await sb.rpc('claim_invite', { invite_code: code });
  if (error) throw error;
  await initSession();
  return data;
}

export async function signOut() {
  try { await sb.auth.signOut(); } catch {}
  store.session = null; store.isAdminUser = false; store.myArtist = null;
}

const TABLES = [
  ['channels',        'channels',         'sort_order'],
  ['roster',          'roster',           'sort_order'],
  ['catalog',         'catalog',          'views.desc'],
  ['album',           'album_tracks',     'sort_order'],
  ['prior',           'prior_catalog',    'sort_order'],
  ['playbook',        'playbook_items',   'sort_order'],
  ['opps',            'opportunities',    'sort_order'],
  ['budget',          'budget_lines',     'sort_order'],
  ['weeks',           'weekly_snapshots', 'week_of.desc'],
  ['platforms',       'platforms',        'sort_order'],
  ['collisions',      'name_collisions',  'sort_order'],
  ['zahTracks',       'zah_tracks',       'sort_order'],
  ['projects',        'projects',         'sort_order'],
  ['profiles',        'artist_profiles',  'sort_order'],
  ['releases',        'releases',         'sort_order'],
];

/* A stale sign-in used to take the whole dashboard down: supabase-js sends the
   stored access token instead of the anon key, and once that token is rejected
   every table read fails with it. Detect that case and fall back to signed-out
   reading rather than showing an empty app. */
const isAuthFailure = msg => /jwt|token|expired|unauthor/i.test(msg || '');

async function readTable(key, table, order) {
  const [col, dir] = order.split('.');
  const { data, error } = await sb.from(table).select('*')
    .order(col, { ascending: dir !== 'desc' });
  if (error) throw new Error(`${table}: ${error.message}`);
  store[key] = data || [];
}

export async function loadAll() {
  // Auth is optional and must never hold the page hostage. Time-box it so a
  // hung token refresh cannot leave everyone staring at "Loading label data".
  await Promise.race([
    initSession(),
    new Promise(r => setTimeout(r, 6000)),
  ]).catch(() => {});

  const run = () => {
    const jobs = TABLES.map(([key, table, order]) => () => readTable(key, table, order));
    jobs.push(() => sb.from('settings').select('*').then(({ data, error }) => {
      if (error) throw new Error(`settings: ${error.message}`);
      store.settings = Object.fromEntries((data || []).map(r => [r.key, r.value]));
    }));
    return Promise.allSettled(jobs.map(j => j()));
  };

  let results = await run();
  let failed = results.filter(r => r.status === 'rejected');

  // Everything failed on an auth error → the session is the problem, not the
  // database. Drop it and read as a signed-out visitor so the app still works.
  if (failed.length === results.length && failed.some(f => isAuthFailure(f.reason?.message))) {
    console.warn('[data] stored session rejected — continuing signed out');
    await signOut();
    results = await run();
    failed = results.filter(r => r.status === 'rejected');
  }

  store.loadErrors = failed.map(f => f.reason?.message || String(f.reason));
  // Only a total failure is fatal; a single bad table should not blank the app.
  if (failed.length === results.length) {
    throw new Error(store.loadErrors[0] || 'Could not load any label data.');
  }

  // Link-hub analytics ride along but must never block the dashboard.
  await Promise.allSettled([
    sb.rpc('hub_summary').then(({ data }) => { store.hub = data || {}; }),
    sb.rpc('hub_recent', { n: 40 }).then(({ data }) => { store.hubRecent = data || []; }),
    sb.from('hub_links').select('*').order('sort_order')
      .then(({ data }) => { store.hubLinks = data || []; }),
  ]);

  if (!store.settings.benchmarks) store.settings.benchmarks = FALLBACK_BENCHMARKS;
  return store;
}

/** Patch one row and update the local copy in place. */
export async function updateRow(table, id, patch, localList) {
  const { data, error } = await sb.from(table)
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id).select().single();
  if (error) throw error;
  if (localList) {
    const i = localList.findIndex(r => r.id === id);
    if (i > -1) localList[i] = data;
  }
  return data;
}

export async function insertRow(table, row, localList) {
  const { data, error } = await sb.from(table).insert(row).select().single();
  if (error) throw error;
  if (localList) localList.push(data);
  return data;
}

export async function deleteRow(table, id, localList) {
  const { error } = await sb.from(table).delete().eq('id', id);
  if (error) throw error;
  if (localList) {
    const i = localList.findIndex(r => r.id === id);
    if (i > -1) localList.splice(i, 1);
  }
}

export async function saveSetting(key, value) {
  const { error } = await sb.from('settings')
    .upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw error;
  store.settings[key] = value;
}

/* ---------- derived numbers ---------- */

export const bench = () => ({ ...FALLBACK_BENCHMARKS, ...(store.settings.benchmarks || {}) });

export const albumTotals = () => {
  const t = { yt: 0, spotify: 0, apple: 0, other: 0, streams: 0 };
  for (const a of store.album) {
    t.yt += a.yt_views || 0;
    t.spotify += a.spotify || 0;
    t.apple += a.apple || 0;
    t.other += a.other || 0;
  }
  t.streams = t.spotify + t.apple + t.other;
  return t;
};

export const playbookProgress = () => {
  const done = store.playbook.filter(p => p.done).length;
  return { done, total: store.playbook.length, pct: store.playbook.length ? done / store.playbook.length * 100 : 0 };
};

export const catalogStats = () => {
  const c = store.catalog;
  const by = tag => c.filter(t => (t.artists || []).includes(tag));
  const sum = list => list.reduce((s, t) => s + (t.views || 0), 0);
  const avg = list => list.length ? Math.round(sum(list) / list.length) : 0;
  const feats = by('zah');
  const album = by('album');
  const top10 = [...c].sort((a, b) => b.views - a.views).slice(0, 10);
  return {
    total: c.length, totalViews: sum(c),
    breed: by('breed').length, king: by('king').length, jay: by('jay').length,
    featureAvg: avg(feats), albumAvg: avg(album), top10Avg: avg(top10), top10,
  };
};
