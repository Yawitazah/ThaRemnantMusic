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

import { store, sb, initSession, signInPassword, signIn, signOut,
         requestPasswordReset, setNewPassword } from './data.js';
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

/* A recovery link lands back here with `type=recovery` in the URL hash. This has
   to be checked BEFORE the team test, because the link itself establishes a
   session — so the team test would pass and drop them straight into the dashboard
   with the forgotten password still set, which is the one thing they came to fix.
   supabase-js consumes the hash on load (detectSessionInUrl), so read it early. */
const RECOVERY = /(?:^|&)type=recovery(?:&|$)/.test(location.hash.replace(/^#/, ''));

/* Reading the hash is the fast path, but not a guarantee: supabase-js consumes it
   asynchronously, so it can be gone before this module runs, and the PKCE variant
   returns `?code=` with no hash at all. PASSWORD_RECOVERY fires either way, so it
   is the reliable trigger. Kept as a listener rather than a replacement because it
   also catches the case where the dashboard has already booted. */
sb.auth.onAuthStateChange((event) => {
  if (event === 'PASSWORD_RECOVERY') {
    document.body.classList.add('hub-mode');
    newPasswordScreen();
  }
});

/** Resolves true only for a signed-in team member. Paints the gate otherwise. */
export async function requireTeam() {
  try { await withTimeout(initSession(), 8000); } catch { /* fail closed below */ }
  if (RECOVERY) { newPasswordScreen(); return false; }
  if (store.isTeam) return true;
  if (store.session) notOnTeam();
  else signInScreen();
  return false;
}

/* Set a new password, on the recovery session the emailed link created. */
function newPasswordScreen(msg = '') {
  view().innerHTML = shell(`
  <section class="hub-capture" style="text-align:left">
    <h2 style="text-align:center">Set a new password</h2>
    <p class="muted sm" style="text-align:center;margin:0 0 14px">
      Pick something only you know. This replaces the old one straight away.</p>
    ${msg ? `<p class="err" style="margin:0 0 10px">${esc(msg)}</p>` : ''}
    <form id="gate-newpw">
      <label>New password <span class="muted sm">(8+ characters)</span>
        <input type="password" name="password" required minlength="8"
          autocomplete="new-password"></label>
      <label>Again, to be sure
        <input type="password" name="confirm" required minlength="8"
          autocomplete="new-password"></label>
      <button class="btn" type="submit">Save my new password</button>
    </form>
  </section>`);

  view().querySelector('#gate-newpw').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target, btn = f.querySelector('button[type=submit]');
    if (f.password.value !== f.confirm.value) {
      return newPasswordScreen('Those two do not match. Try again.');
    }
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      // Same reasoning as sign-in: never let the button sit spinning.
      await withTimeout(setNewPassword(f.password.value), 9000);
      // Drop the recovery hash so a reload does not re-enter this screen.
      history.replaceState(null, '', '/command');
      location.reload();
    } catch (err) {
      newPasswordScreen(err?.message || 'Could not save that password.');
    }
  });
}

function forgotScreen(msg = '') {
  view().innerHTML = shell(`
  <section class="hub-capture" style="text-align:left">
    <h2 style="text-align:center">Reset your password</h2>
    <p class="muted sm" style="text-align:center;margin:0 0 14px">
      We email you a link that lets you set a new one.</p>
    ${msg ? `<p class="err" style="margin:0 0 10px">${esc(msg)}</p>` : ''}
    <form id="gate-forgot">
      <label>Email
        <input type="email" name="email" required autocomplete="email"
          placeholder="you@example.com"></label>
      <button class="btn" type="submit">Send the reset link</button>
    </form>
    <div class="gate-alt">
      <button class="gate-link" id="gate-back" type="button">Back to sign in</button>
    </div>
  </section>`);

  view().querySelector('#gate-back').addEventListener('click', () => signInScreen());
  view().querySelector('#gate-forgot').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target, btn = f.querySelector('button[type=submit]');
    const email = f.email.value.trim();
    btn.disabled = true; btn.textContent = 'Sending…';
    try {
      await requestPasswordReset(email);
      view().innerHTML = shell(`
        <section class="hub-capture">
          <h2>Check your email</h2>
          <p class="muted sm">A reset link is on its way to <strong>${esc(email)}</strong>.
          Open it on this device and you can set a new password.</p>
          <p class="muted sm" style="margin-top:12px">Nothing after a few minutes? The label's
          auth email is rate limited to a couple of sends an hour. You can also set a new
          password from the Supabase dashboard under Authentication → Users, which does not
          use email at all.</p>
        </section>`);
    } catch (err) {
      forgotScreen(err?.message || 'Could not send the reset link.');
    }
  });
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
    <div class="row" style="margin-top:14px;justify-content:center">
      <a class="btn" href="/join">Claim an invite code</a>
    </div>
    <div class="gate-alt">
      <button class="gate-link" id="gate-out" type="button">Sign out</button>
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
    <div class="gate-alt">
      <button class="gate-link" id="gate-forgot-btn" type="button">Forgot my password</button>
      <button class="gate-link" id="gate-link" type="button">Email me a link instead</button>
      <a href="/join">I have an invite code</a>
    </div>
  </section>`);

  view().querySelector('#gate-forgot-btn').addEventListener('click', () => forgotScreen());

  view().querySelector('#gate-form').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target, btn = f.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = 'One moment…';
    try {
      /* Time-boxed on purpose. signInPassword re-runs initSession, which fires
         three RPCs with no timeout of their own — on a phone that could sit there
         forever and the button just read "One moment…" until the page was
         refreshed by hand. A wrong password still rejects fast and lands below. */
      await withTimeout(signInPassword(f.email.value.trim(), f.password.value), 9000);
      /* Reload on the session existing, NOT on store.isTeam. isTeam depends on
         those same RPCs having finished; the reload re-runs the gate check, which
         is authoritative and has its own timeout. getSession reads local storage,
         so it cannot hang here. */
      const { data: { session } } = await sb.auth.getSession();
      if (session) location.reload();
      else signInScreen('Could not sign in. Check the email and password, then try again.');
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
