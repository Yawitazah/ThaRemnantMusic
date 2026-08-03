// Team onboarding — /join.
//
// Three steps, driven by where the visitor already is:
//   1. Create an account (their own email + password) or sign in.
//   2. Claim the invite code Zah handed them — this links the login to their
//      artist page and unlocks team visibility.
//   3. Set up the phone: install the dashboard as an app, know where
//      notifications live, open the CRM.

import { store, initSession, signUpPassword, signInPassword, claimInvite, isAdmin, sb } from './data.js';
import { esc } from './ui.js';

const view = () => document.getElementById('view');

const shell = inner => `
<div class="hub join">
  <header class="hub-head">
    <img src="/img/logo-mark-180.png" alt="" style="width:64px;height:64px;object-fit:contain;margin:0 auto 12px;display:block">
    <h1>Join the team</h1>
    <p class="hub-role">Tha Remnant Music Group</p>
  </header>
  ${inner}
  <footer class="hub-foot"><span>Label Command Center</span></footer>
</div>`;

const stepBadge = n => `
  <div class="join-steps">
    ${['Account', 'Invite', 'Set up'].map((s, i) => `
      <span class="join-step ${i + 1 < n ? 'done' : ''} ${i + 1 === n ? 'now' : ''}">${i + 1}. ${s}</span>`).join('')}
  </div>`;

/* ---------- step 1: account ---------- */

function authStep(mode = 'signup', msg = '') {
  view().innerHTML = shell(`
  ${stepBadge(1)}
  <section class="hub-capture" style="text-align:left">
    <div class="row" style="margin-bottom:14px">
      <button class="chip ${mode === 'signup' ? 'on' : ''}" data-mode="signup">Create account</button>
      <button class="chip ${mode === 'signin' ? 'on' : ''}" data-mode="signin">I already have one</button>
    </div>
    ${msg ? `<p class="err" style="margin:0 0 10px">${esc(msg)}</p>` : ''}
    <form id="auth-form">
      <label>Email
        <input type="email" name="email" required autocomplete="email" placeholder="you@example.com"></label>
      <label>Password ${mode === 'signup' ? '<span class="muted sm">(your choice, 8+ characters)</span>' : ''}
        <input type="password" name="password" required minlength="8"
          autocomplete="${mode === 'signup' ? 'new-password' : 'current-password'}"></label>
      <button class="btn" type="submit">${mode === 'signup' ? 'Create my account' : 'Sign in'}</button>
    </form>
    <p class="muted sm" style="margin:12px 0 0">You set your own password — nobody else ever knows it.
    ${mode === 'signup' ? 'You may need to confirm your email, then come straight back to this page.' : ''}</p>
  </section>`);

  view().querySelectorAll('.chip[data-mode]').forEach(c =>
    c.addEventListener('click', () => authStep(c.dataset.mode)));

  view().querySelector('#auth-form').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target, btn = f.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = 'One moment…';
    try {
      if (mode === 'signup') {
        const r = await signUpPassword(f.email.value.trim(), f.password.value);
        if (!r.session) {
          view().innerHTML = shell(`${stepBadge(1)}
            <section class="hub-capture">
              <h2>Check your email</h2>
              <p class="muted sm">We sent a confirmation link to <strong>${esc(f.email.value.trim())}</strong>.
              Tap it, and it brings you right back here to finish up.</p>
            </section>`);
          return;
        }
      } else {
        await signInPassword(f.email.value.trim(), f.password.value);
      }
      await initSession();
      route();
    } catch (err) {
      authStep(mode, err.message || 'That did not work — try again.');
    }
  });
}

/* ---------- step 2: invite ---------- */

function inviteStep(msg = '') {
  const email = store.session?.user?.email || '';
  view().innerHTML = shell(`
  ${stepBadge(2)}
  <section class="hub-capture" style="text-align:left">
    <h2 style="text-align:center">Your invite code</h2>
    <p class="muted sm" style="text-align:center">Signed in as <strong>${esc(email)}</strong>.
    Enter the code Zah gave you — it links this account to your artist page.</p>
    ${msg ? `<p class="err" style="margin:10px 0 0">${esc(msg)}</p>` : ''}
    <form id="invite-form">
      <input type="text" name="code" required placeholder="REMNANT-XXXX-XXXX"
        autocomplete="off" autocapitalize="characters" style="text-align:center;letter-spacing:.08em">
      <button class="btn" type="submit">Claim my spot</button>
    </form>
    <p class="muted sm" style="margin:12px 0 0;text-align:center">No code? Ask Zah — each one works once.</p>
  </section>`);

  view().querySelector('#invite-form').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.disabled = true; btn.textContent = 'Claiming…';
    try {
      await claimInvite(e.target.code.value);
      route();
    } catch (err) { inviteStep(err.message || 'That code did not work.'); }
  });
}

/* ---------- step 3: set up ---------- */

function doneStep() {
  const who = store.myArtist || (isAdmin() ? 'Label admin' : 'Team member');
  const slugMap = Object.fromEntries((store.profiles || []).map(p => [p.artist, p.slug]));
  const mySlug = slugMap[store.myArtist];
  const ua = navigator.userAgent;
  const install = /iphone|ipad/i.test(ua)
    ? 'Open this site in Safari, tap the <strong>Share</strong> button, then <strong>Add to Home Screen</strong>.'
    : /android/i.test(ua)
      ? 'Tap the <strong>⋮ menu</strong> in Chrome, then <strong>Add to Home screen</strong> (or "Install app").'
      : 'In Chrome or Edge, click the <strong>install icon</strong> at the right end of the address bar.';

  view().innerHTML = shell(`
  ${stepBadge(3)}
  <section class="hub-capture" style="text-align:left">
    <h2 style="text-align:center">You're in, ${esc(who)}</h2>
    <ol class="join-list">
      <li><strong>Install the dashboard as an app.</strong><br>
        <span class="muted sm">${install}</span></li>
      <li><strong>Watch the bell.</strong><br>
        <span class="muted sm">The bell at the top of the dashboard shows every hub visit, link tap
        and new fan as it comes in. It refreshes itself while the app is open.</span></li>
      <li><strong>Your numbers live on the Artists tab.</strong><br>
        <span class="muted sm">Views, clicks and fans for your hub — 7 days, 28 days or all time.
        You can edit your own hub links there too.</span></li>
      <li><strong>Fans land in the Fans tab and the label CRM.</strong><br>
        <span class="muted sm">Every email captured on any hub shows up for the whole team, so
        together you decide who follows up. The CRM app (zahcrm.com) sends its own notifications —
        install it the same way and allow notifications when it asks.</span></li>
    </ol>
    <div class="hub-links" style="margin-top:16px">
      <a class="hub-btn" href="/#artists"><span class="hub-ic">DB</span><span>Open the dashboard</span><span class="hub-arrow">→</span></a>
      ${mySlug ? `<a class="hub-btn" href="/a/${esc(mySlug)}"><span class="hub-ic">HUB</span><span>See your public hub</span><span class="hub-arrow">→</span></a>` : ''}
      <a class="hub-btn" href="https://zahcrm.com" target="_blank" rel="noopener"><span class="hub-ic">CRM</span><span>Open the label CRM</span><span class="hub-arrow">→</span></a>
    </div>
  </section>`);
}

/* ---------- router ---------- */

function route() {
  if (!store.session) return authStep('signup');
  if (!store.isTeam) return inviteStep();
  doneStep();
}

export async function boot() {
  document.documentElement.dataset.theme = 'dark';
  // Profiles give the done-screen its hub link; session decides the step.
  try {
    const { data } = await sb.from('artist_profiles').select('artist,slug').order('sort_order');
    store.profiles = data || [];
  } catch {}
  await initSession();
  sb.auth.onAuthStateChange(async () => { await initSession(); route(); });
  route();
}
