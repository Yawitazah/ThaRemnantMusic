// Team gate for /command.
//
// The Command Center used to render for anyone who typed the URL: budget, album
// ledger, opportunities and weekly numbers, to the whole internet. This stands in
// front of it. Nobody sees the dashboard, or even its chrome, without a signed-in
// account that `is_team()` recognises.
//
// This is the UI half of the lock. The other half is RLS: migration 0013 revokes
// anon SELECT on the internal tables, because the Supabase anon key ships inside
// this page and a screen you cannot see is not a screen you cannot fetch. Both
// halves have to stay in place — removing either one re-opens the numbers.

import { store, initSession, signInPassword, signIn, signOut } from './data.js';
import { esc } from './ui.js';

const view = () => document.getElementById('view');

const shell = inner => `
<div class="hub join">
  <header class="hub-head">
    <img src="/img/logo-mark-180.png" alt="" style="width:64px;height:64px;object-fit:contain;margin:0 auto 12px;display:block">
    <h1>Command Center</h1>
    <p class="hub-role">Tha Remnant Music Group</p>
  </header>
  ${inner}
  <footer class="hub-foot"><span><a href="/">← Back to tharemnant.com</a></span></footer>
</div>`;

/* A hung auth call must not leave the gate spinning forever, and must never fall
   open. Whatever happens here, the caller only proceeds on an explicit `true`. */
const withTimeout = (p, ms) =>
  Promise.race([p, new Promise(r => setTimeout(r, ms))]);

/** Resolves true only for a signed-in team member. Paints the gate otherwise. */
export async function requireTeam() {
  try { await withTimeout(initSession(), 8000); } catch { /* fail closed below */ }
  if (store.isTeam) return true;
  if (store.session) notOnTeam();
  else signInScreen();
  return false;
}

/* Signed in, but the account is not in admins / artist_users / team_members. Say
   so plainly rather than showing an empty dashboard that looks broken. */
function notOnTeam() {
  const who = store.session?.user?.email || 'this account';
  view().innerHTML = shell(`
  <section class="hub-capture">
    <h2>Not on the team yet</h2>
    <p class="muted sm">You are signed in as <strong>${esc(who)}</strong>, but that account
    has not been linked to the label yet.</p>
    <p class="muted sm">If Zah gave you an invite code, claim it on
    <a href="/join">the join page</a> and this unlocks straight away.</p>
    <div class="row" style="margin-top:14px">
      <a class="btn" href="/join">Claim an invite code</a>
      <button class="btn ghost" id="gate-out" type="button">Sign out</button>
    </div>
  </section>`);
  view().querySelector('#gate-out').addEventListener('click', async () => {
    await signOut();
    signInScreen();
  });
}

function signInScreen(msg = '') {
  view().innerHTML = shell(`
  <section class="hub-capture" style="text-align:left">
    <h2 style="text-align:center">Team sign in</h2>
    <p class="muted sm" style="text-align:center;margin:0 0 14px">
      This part of the site is for the label. Fans want <a href="/">tharemnant.com</a>.</p>
    ${msg ? `<p class="err" style="margin:0 0 10px">${esc(msg)}</p>` : ''}
    <form id="gate-form">
      <label>Email
        <input type="email" name="email" required autocomplete="email" placeholder="you@example.com"></label>
      <label>Password
        <input type="password" name="password" required autocomplete="current-password"></label>
      <button class="btn" type="submit">Sign in</button>
    </form>
    <p class="muted sm" style="margin:12px 0 0">
      <button class="btn ghost" id="gate-link" type="button" style="margin-right:8px">Email me a link instead</button>
      <a href="/join">I have an invite code</a></p>
  </section>`);

  view().querySelector('#gate-form').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target, btn = f.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = 'One moment…';
    try {
      await signInPassword(f.email.value.trim(), f.password.value);
      // signInPassword already re-ran initSession, so the verdict is current.
      if (store.isTeam) location.reload();   // clean boot with the real session
      else notOnTeam();
    } catch (err) {
      signInScreen(err?.message || 'That did not work. Check the email and password.');
    }
  });

  view().querySelector('#gate-link').addEventListener('click', async () => {
    const email = view().querySelector('input[name=email]').value.trim();
    if (!email) return signInScreen('Put your email in first, then ask for the link.');
    try {
      await signIn(email);
      view().innerHTML = shell(`
        <section class="hub-capture">
          <h2>Check your email</h2>
          <p class="muted sm">A sign-in link is on its way to <strong>${esc(email)}</strong>.
          Opening it on this device brings you straight back here.</p>
        </section>`);
    } catch (err) {
      signInScreen(err?.message || 'Could not send the link.');
    }
  });
}
