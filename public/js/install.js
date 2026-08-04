// Install + notifications, as two buttons rather than a list of instructions.
//
// Chrome, Edge and Android fire `beforeinstallprompt`, which we hold onto so a
// real "Install the app" button can trigger the native installer. iOS Safari
// has no such API — Add to Home Screen is a manual Share-sheet action — so
// there we show the one line that actually matters instead of pretending a
// button exists. Notifications on iOS only work once the app is installed,
// which the UI states plainly rather than failing silently.

import { sb, store } from './data.js';

let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  document.dispatchEvent(new CustomEvent('install-availability'));
});
window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  document.dispatchEvent(new CustomEvent('install-availability'));
});

export const isStandalone = () =>
  (typeof window.matchMedia === 'function'
    && window.matchMedia('(display-mode: standalone)').matches)
  || window.navigator.standalone === true;

export const isIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent || '') ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export const canInstall = () => !!deferredPrompt;

export async function promptInstall() {
  if (!deferredPrompt) return 'unavailable';
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  if (outcome === 'accepted') deferredPrompt = null;
  return outcome;
}

/* ---------- notifications ---------- */

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window;

export async function pushState() {
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return sub ? 'on' : 'off';
  } catch { return 'off'; }
}

const urlBase64ToUint8Array = base64 => {
  const padded = (base64 + '='.repeat((4 - base64.length % 4) % 4))
    .replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
};

export async function enablePush() {
  if (!pushSupported()) throw new Error('This browser cannot do notifications.');
  if (isIOS() && !isStandalone()) {
    throw new Error('On iPhone, install the app first — then turn notifications on from inside it.');
  }
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error(permission === 'denied'
      ? 'Notifications are blocked for this site in your browser settings.'
      : 'Notifications were not enabled.');
  }

  const reg = await navigator.serviceWorker.ready;
  const { key } = await (await fetch('/api/push/key')).json();
  const sub = await reg.pushManager.getSubscription()
    || await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key),
    });

  const json = sub.toJSON();
  const { error } = await sb.from('push_subscriptions').upsert({
    endpoint: sub.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
    email: store.session?.user?.email || null,
  }, { onConflict: 'endpoint' });
  if (error) throw new Error(error.message);

  // Prove it works immediately rather than leaving them wondering.
  await fetch('/api/push/test', { method: 'POST' }).catch(() => {});
  return 'on';
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return 'off';
  await sb.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
  await sub.unsubscribe();
  return 'off';
}

/* ---------- shared UI ---------- */

/** Markup for the install + notifications pair. Call wireSetupButtons after. */
export function setupButtonsHtml() {
  const installed = isStandalone();
  const install = installed
    ? `<div class="setup-row done"><span class="setup-ic">✓</span>
         <span><strong>App installed</strong><small>You are running it as an app.</small></span></div>`
    : isIOS()
      ? `<div class="setup-row"><span class="setup-ic">1</span>
           <span><strong>Add to your Home Screen</strong>
           <small>Tap the Share button in Safari, then "Add to Home Screen".</small></span></div>`
      : `<button class="setup-row" id="btn-install" type="button" disabled>
           <span class="setup-ic">1</span>
           <span><strong>Install the app</strong><small id="install-note">Checking…</small></span>
           <span class="setup-go">→</span></button>`;

  return `<div class="setup-grid">
    ${install}
    <button class="setup-row" id="btn-push" type="button">
      <span class="setup-ic">2</span>
      <span><strong>Turn on notifications</strong><small id="push-note">Get a ping when a fan joins.</small></span>
      <span class="setup-go">→</span>
    </button>
  </div>`;
}

export function wireSetupButtons(root) {
  const installBtn = root.querySelector('#btn-install');
  const note = root.querySelector('#install-note');

  const refreshInstall = () => {
    if (!installBtn) return;
    if (canInstall()) {
      installBtn.disabled = false;
      note.textContent = 'One tap. No app store.';
    } else {
      installBtn.disabled = true;
      note.textContent = isStandalone()
        ? 'Already installed.'
        : 'Your browser will offer this shortly — or use its menu, "Install app".';
    }
  };
  refreshInstall();
  document.addEventListener('install-availability', refreshInstall);

  installBtn?.addEventListener('click', async () => {
    const outcome = await promptInstall();
    if (outcome === 'accepted') {
      installBtn.disabled = true;
      note.textContent = 'Installed. Open it from your home screen.';
    }
  });

  const pushBtn = root.querySelector('#btn-push');
  const pushNote = root.querySelector('#push-note');

  const paint = state => {
    pushBtn.classList.toggle('done', state === 'on');
    pushBtn.querySelector('.setup-ic').textContent = state === 'on' ? '✓' : '2';
    pushBtn.querySelector('strong').textContent =
      state === 'on' ? 'Notifications are on' : 'Turn on notifications';
    pushNote.textContent = {
      on: 'Tap again to turn them off.',
      off: 'Get a ping when a fan joins.',
      blocked: 'Blocked in your browser settings for this site.',
      unsupported: 'This browser cannot do notifications.',
    }[state] || '';
    pushBtn.disabled = state === 'unsupported' || state === 'blocked';
  };
  pushState().then(paint);

  pushBtn.addEventListener('click', async () => {
    const current = await pushState();
    pushNote.textContent = 'One moment…';
    try {
      paint(current === 'on' ? await disablePush() : await enablePush());
    } catch (err) {
      pushNote.textContent = err.message;
    }
  });
}
