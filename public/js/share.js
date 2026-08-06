// One share control, used by the artist page and the link hub.
//
// The point is an artist handing out their own link from their phone in two taps.
// On a phone that means the real OS share sheet (navigator.share), which puts the
// link straight into Instagram, WhatsApp, Messages or wherever they actually post.
// Desktop browsers mostly have no share sheet, so there it copies to the clipboard
// and says so, which is what someone at a keyboard was going to do anyway.
//
// Nothing here throws into the page: a share the user cancels is not an error, and
// a browser with neither API still shows the link so it can be copied by hand.

const ABS = path => new URL(path, location.origin).href;

/** Wire every [data-share-url] inside `root`. Safe to call more than once. */
export function wireShare(root, onShared) {
  for (const btn of root.querySelectorAll('[data-share-url]')) {
    if (btn.dataset.shareWired) continue;
    btn.dataset.shareWired = '1';

    btn.addEventListener('click', async () => {
      const url = ABS(btn.dataset.shareUrl);
      const title = btn.dataset.shareTitle || document.title;
      const label = btn.querySelector('.share-label') || btn;
      const original = label.textContent;
      const say = (msg, ms = 1800) => {
        label.textContent = msg;
        setTimeout(() => { label.textContent = original; }, ms);
      };

      // The OS sheet, where it exists. AbortError just means they backed out.
      if (navigator.share) {
        try {
          await navigator.share({ title, url });
          onShared?.(url);
          return;
        } catch (err) {
          if (err?.name === 'AbortError') return;
          // Anything else falls through to copying rather than dead-ending.
        }
      }

      try {
        await navigator.clipboard.writeText(url);
        say('Link copied');
        onShared?.(url);
      } catch {
        // No clipboard permission (or an insecure context): show the link so it
        // can still be copied by hand instead of failing silently.
        say(url, 6000);
      }
    });
  }
}
