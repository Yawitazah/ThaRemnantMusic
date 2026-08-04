// Team navigation bar for the public pages.
//
// /a/{slug} and /artist/{slug} are fan-facing and deliberately do not load the
// dashboard shell or the auth client, so they had no way back to anything. This
// adds a slim bar across the top for signed-in team members only, and nothing
// at all for a fan.
//
// Membership is confirmed by the is_team() RPC rather than assumed from the
// presence of a token, so the Command Center and CRM links can never appear for
// someone who merely has a stale session in this browser.

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { esc } from './ui.js';

/* supabase-js persists the session under sb-<project-ref>-auth-token. Reading it
   directly keeps these pages off the 100KB auth bundle they otherwise do not
   need. Storage throws in some private modes, so every access is guarded. */
function storedSession() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (!/^sb-.*-auth-token$/.test(key)) continue;
      const raw = JSON.parse(localStorage.getItem(key) || 'null');
      const s = raw?.access_token ? raw : raw?.currentSession;
      if (!s?.access_token) continue;
      if (s.expires_at && s.expires_at * 1000 < Date.now()) continue;
      return { token: s.access_token, email: s.user?.email || '' };
    }
  } catch { /* no storage, no bar */ }
  return null;
}

const BAR_CSS = `
.team-bar {
  position:sticky; top:0; z-index:60; display:flex; align-items:center; gap:10px;
  padding:7px 16px; font-size:.79rem; background:var(--surface-1);
  border-bottom:1px solid var(--line); flex-wrap:wrap;
}
.team-bar-who { color:var(--text-muted); margin-right:auto; }
.team-bar-who strong { color:var(--text-secondary); font-weight:650; }
.team-bar a {
  text-decoration:none; color:var(--text-secondary); font-weight:650;
  border:1px solid var(--line); border-radius:99px; padding:3px 11px; white-space:nowrap;
}
.team-bar a:hover { color:var(--series-2); border-color:var(--series-2); }
.team-bar a.is-here { color:var(--series-2); border-color:var(--series-2); background:transparent; }
@media (max-width:520px) { .team-bar-who { flex:1 0 100%; margin-bottom:4px; } }`;

/**
 * Render the bar if, and only if, this browser holds a valid team session.
 * @param {object} opts - { artist, slug, here: 'hub' | 'profile' }
 */
export async function mountTeamBar({ artist, slug, here }) {
  const session = storedSession();
  if (!session) return;

  let team = false;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/is_team`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        authorization: `Bearer ${session.token}`,
        'content-type': 'application/json',
      },
      body: '{}',
    });
    team = r.ok && (await r.json()) === true;
  } catch { /* offline or rejected token: show a fan the fan page */ }
  if (!team) return;

  const style = document.createElement('style');
  style.textContent = BAR_CSS;
  document.head.appendChild(style);

  const bar = document.createElement('nav');
  bar.className = 'team-bar';
  bar.setAttribute('aria-label', 'Team navigation');
  bar.innerHTML = `
    <span class="team-bar-who">Signed in as <strong>${esc(session.email || 'team')}</strong>
      · viewing ${esc(artist)}</span>
    <a href="/#artists/${encodeURIComponent(artist)}">← Command Center</a>
    <a href="/a/${esc(slug)}"${here === 'hub' ? ' class="is-here"' : ''}>Link hub</a>
    <a href="/artist/${esc(slug)}"${here === 'profile' ? ' class="is-here"' : ''}>Artist page</a>
    <a href="https://zahcrm.com/sso/remnant?token=${encodeURIComponent(session.token)}"
       target="_blank" rel="noopener">ZAH CRM</a>`;
  document.body.prepend(bar);
}
