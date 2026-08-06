# Tha Remnant Music Group — handoff

Everything a new session needs to continue. Written 2026-08-04.

---

## The two things that exist

**1. Label Command Center** — the dashboard + public artist pages.
- Source: `D:\downloads\remnant-handoff\remnant-dashboard`
- Repo: `Yawitazah/ThaRemnantMusic`, branch `main`
- Live: https://tharemnant.com (custom domain, added 2026-08-05) — also still on
  https://command-center-production-cc6b.up.railway.app
- Domain: registered at **GoDaddy**, DNS at **Cloudflare** (free plan, account
  `zahbrandsolutions@gmail.com`). GoDaddy cannot put a CNAME on a bare domain, so
  the nameservers point at `izabella.ns.cloudflare.com` / `trevor.ns.cloudflare.com`
  and Cloudflare flattens the apex CNAME to Railway's `zpv9lj0u.up.railway.app`.
  Both the apex and `www` are **proxied** (orange cloud), and SSL/TLS is pinned to
  **Full** — Full (Strict) breaks Railway, so never "upgrade" it.
- Railway project `tha-remnant-command-center`, service `command-center`, auto-deploys from `main` (~1 min)
- Data: Supabase project `tha-remnant-command-center`, ref `upfqppdfckqehzgsosdi`
- **At commit `9f034fd`, local = GitHub = deployed.**

**2. ZAH CRM** — the same product Zah sells, with a Remnant workspace inside it.
- Source: `D:\travel-leads` (legacy folder name; it is not travel-only)
- Repo: `Yawitazah/travel-leads`, branch `main` → Railway → https://zahcrm.com
- **At commit `ea31256`, local = GitHub = deployed.**
- Read `D:\travel-leads\CLAUDE.md` before touching it. That file is accurate and detailed.

---

## Public pages (live)

| Page | URL |
|---|---|
| **Label landing page (fans)** | `/` (and `/label`, kept as an alias) |
| **Command Center (team sign-in required)** | `/command` |
| BREED | `/a/breed` · `/artist/breed` |
| King Konnect | `/a/kingkonnect` · `/artist/kingkonnect` |
| JayThaRealist | `/a/jay` · `/artist/jay` |
| Yawitazah | `/a/yawitazah` · `/artist/yawitazah` |

`/` = the audience-facing front door, added 2026-08-04. Hero, what is being
pushed right now, latest releases, the roster, most played, email capture.
Deliberately carries **no internal numbers and no management** — this is the
artists' page.

**It moved from `/label` to `/` on 2026-08-05**, when tharemnant.com was connected,
so that a fan typing the domain does not land on the budget and ledger. The
Command Center moved to `/command`. Two rules came out of that move:
- **`/command` is the ONLY path that serves the dashboard.** Everything
  unrecognised falls through to the label page, so a typo or a stale link can
  never expose internal numbers. Routing lives at the bottom of `app.js`.
- **The internal title and description exist only on `/command`.** `index.html`
  now ships the public copy as its default, because that default is what any
  unrecognised path returns. Putting "budget and ledger" back in `index.html`
  would leak it into the share preview for tharemnant.com itself.

## The Command Center is closed to the public (2026-08-05)

It used to render for anyone who typed the URL. `/command` now requires a signed-in
account that `is_team()` recognises. **The lock has two halves and both must stay:**

1. **UI** — `public/js/gate.js`, called from the `/command` branch of `app.js`.
   `hub-mode` hides the dashboard chrome until the check passes, and it **fails
   closed**: the gate only stands down on an explicit `true`, so a hung or failed
   auth call shows the sign-in screen rather than the dashboard. No dashboard data
   is fetched at all until the check passes — `loadAll()` sits behind it.
2. **RLS** — migration `0014_lock_internal_tables.sql`. This is the half that
   matters, because **the Supabase anon key ships inside the page**: a screen you
   cannot see is not data you cannot fetch. Ten internal tables moved from
   `SELECT` for `anon` to `is_team()`: `budget_lines`, `weekly_snapshots`,
   `opportunities`, `playbook_items`, `album_tracks`, `prior_catalog`, `platforms`,
   `roster`, `zah_tracks`, `name_collisions`. Anon now gets **401** on all ten.

Verified three ways: anon → 401 internal / 200 public; signed-in non-team → 0 rows
internal, public intact; `zahbrandsolutions@gmail.com` (in `admins`) → all ten
readable, so the dashboard still loads fully.

**Left public on purpose**, because the label page, hubs and artist pages read them:
`artist_profiles`, `releases`, `projects`, `catalog`, `channels`, `hub_links`,
`settings`, `tour_dates`, `discovered_on`, `team_members`. `projects` was checked
column by column and holds no money — **if financial columns are ever added to
`projects`, revisit that.**

Who can get in today: **only `zahbrandsolutions@gmail.com`** (the one row in
`admins`). `artist_users` is empty and Byron's `team_members` row has no
`owner_email`, so everyone else is locked out until they claim an invite code at
`/join`, which is the intended path.

Anything that used to point at `/` for the dashboard had to move to `/command`:
the account menu, `teambar.js`, the manifest `start_url`, the push notification
URLs (`/command#fans`), the service worker offline shell, and both reset paths
(which now reload `location.pathname` rather than `/`).

**The plates are scroll-driven film.** Each section holds a still (`.jpg`) and a
short silent clip (`.mp4`) in `public/img/scenes/`: bible pages turning,
microphone, phone blinking, crown rotating, watch ticking, TR pendant on a chain.
Scrolling scrubs the clip frame by frame; stop scrolling and it plays on by
itself. Built in `bindFilm()` in `label.js`.
- **The plate is PINNED (`position:sticky`) while you scroll its section.**
  Travelling with the section, a clip left the screen long before it had played
  and nobody ever saw the pages turn. Sections run `200svh`, so each clip plays
  across one full viewport of scroll while the plate is stationary and
  full-screen. `.lb-inner` pins with it so the scene holds together.
- **`scrub()` measures the SECTION rect, never the video's.** The plate is
  sticky, so its own rect stops moving the instant it pins and scrubbing off it
  freezes the clip on one frame.
- `.lb { overflow-x:clip }` is deliberate. `clip` does not create a scroll
  container; `hidden` would, and sticky would silently stop working.
- The scrims were re-tuned when the plates went full-height. At the old strength
  a full-screen plate composited to almost black.
- **The server must support HTTP byte ranges or none of this works.** Without a
  206 response a browser reports the file unseekable, `video.seekable` is empty,
  and assigning `currentTime` silently does nothing. `server.js` streams ranges
  for `.mp4`/`.webm`.
- **Clips are encoded all-intra** (`-g 1`), 1280x720 at 18fps CRF 30 (phones get
  854x480 CRF 33), so every seek is a direct frame fetch with no forward
  decoding. Measured in the page: median seek **~12ms against a 16.7ms frame
  budget**, against 18.6ms at `-g 8` where seeks overran the budget and the
  scrub visibly stuttered. **Do not "optimise" these back to a long GOP** — it
  looks like an obvious size win and it is what caused the stutter.
- **Seek cost scales with pixel count, not file size.** 1280x720 CRF 27 seeks
  faster than 1440x810 CRF 29 despite being the larger file. Resolution is the
  lever for seek time; CRF is the lever for weight. 1280x720 is the ceiling that
  still leaves frame-budget headroom.
- **The clip maps to a capped slice of the hold, not all of it** (`SPAN` in
  `label.js`). Section heights are content-driven and varied wildly: on a phone
  one section gave the clip 3100px of scroll and another 162px, so the same
  eight seconds crawled in one and vanished in a flick in the other. `SPAN` must
  match the hold the stylesheet guarantees — 100svh desktop, 65svh mobile
  (`min-height` 200svh / 165svh). **Change one and change both.**
- **Scroll sets a target; an animation frame eases the playhead toward it.**
  A wheel scrolls in ~100px jumps, which is about a second of clip, so mapping
  scroll straight onto `currentTime` was a slide show no matter how well the
  video decoded. Seeks are quantised to the frame grid and skipped while one is
  in flight, because assigning `currentTime` again cancels the seek in progress.
- Clips are ~1MB each, loaded only when their section is near.
- **Phones run it too**, on a 640px `-sm.mp4` cut (~300KB each). What makes that
  safe is the **release step**: any clip more than ~2 viewports away has its
  `src` dropped and `load()` called, handing the decoder back. iOS keeps only a
  few video elements decoding at once, and six live ones starve each other until
  nothing paints. At most three are ever armed.
- **iOS will not paint a frame from a video that has never played**, so a seek
  alone leaves the poster up. One muted `play()`/`pause()` on the first touch
  unlocks it.
- Skipped entirely only on **Data Saver or a 2G connection**.
- Under `prefers-reduced-motion` the **drift, rotation and idle playback stop but
  scrubbing stays**, because the reader is driving every frame of it. Killing it
  outright would leave still photographs on a page built around them moving —
  and Zah's own machine reports reduced motion.

Hub = link-tree style. Profile = DSP-shaped (cover header, monthly listeners,
Follow, Popular, Artist pick, discography, tour, About, bottom player dock).

All three track into `hub_events`. `/join` is team onboarding.

**The player is no longer YouTube-only.** `public/js/dock.js` is shared by the hub,
the profile and the label page: artwork plays in the bottom dock via YouTube,
Spotify or Apple embeds, and the platform buttons leave for the platform. This
matters because 22 of 32 releases have no YouTube URL and used to be unplayable.
Spotify and Apple serve a 30 second preview to a signed-out visitor and the full
song to a subscriber — their rule, not a bug.

**Cover art fills itself in.** `hydrateArt()` in `dock.js` pulls real sleeves from
Spotify's public oEmbed and the iTunes lookup API (both CORS-open, no key) and
prefers them over YouTube stills, which are 16:9 and get cropped in a square tile.

---

## Team access

Onboarding is **`/join`** — create account (own email + password) → **enter invite
code on step 2** → set-up screen (install app, notifications, CRM).

**Unused invite codes** (single use each, none claimed yet):

| Person | Code |
|---|---|
| BREED | `REMNANT-BREED-7K2M` |
| King Konnect | `REMNANT-KING-4T9X` |
| JayThaRealist | `REMNANT-JAY-8R3W` |
| Yawitazah | `REMNANT-ZAH-5N6Q` |
| Byron "Breakout" Davis | `REMNANT-BYRON-3D8P` |
| Spare team member | `REMNANT-TEAM-2J7V` |

**Byron "Breakout" Davis is management, not an artist.** He lives in the
**Team tab** of the Command Center (profile, track record, hub growth, hub editor)
and has his own link hub at **`/a/byron`**. He is deliberately absent from
`/`. `team_members` carries `slug` and `owner_email`; `is_team()` and
`my_artist()` recognise a team member the same way they recognise an artist, so
he can edit his own hub once he claims his code.

**Navigation exists now.** The topbar carries quick "Link hub" and "Artist page"
links (generic labels, targeting whichever artist the Artists tab is showing) plus
an account menu (Command Center, Label page, ZAH CRM, the artist's own public
pages, sign out). The Command Center and CRM entries render **only when `is_team()` is true**,
so a fan never sees either. On `/a/{slug}` and `/artist/{slug}`, `teambar.js` adds
a slim bar back to the Command Center — it confirms membership through the
`is_team()` RPC rather than trusting a stored token, so a stale session in a
browser cannot expose those links.

**Nobody has claimed a code yet, so the SSO handoff has never been exercised by a
non-admin.** Zah skips the invite step because he is in `admins`. Worth watching
the first time a real artist signs in.

Zah (`zahbrandsolutions@gmail.com`) is in the `admins` table, so he skips the invite
step entirely and can edit every artist. That is expected, not a bug.

**One login for both products.** The dashboard session opens the CRM through
`zahcrm.com/sso/remnant?token=<supabase access token>` (`server/remnantSso.js`). It
verifies the token, checks `is_team()`, and issues a CRM session for the shared
`remnant` account. Nobody has a CRM password.

---

## Current data state

| Thing | Count |
|---|---|
| Dashboard accounts | 1 (Zah) |
| Unclaimed invite codes | 5 |
| Fans captured | 0 |
| Follows | 0 |
| Tour dates | 0 — section hidden until populated |
| Discovered-on playlists | 0 — section hidden until populated |
| Push devices registered | 0 |
| Releases with no YouTube link | 22 of 32 |
| Tracked hub events | 52 (mostly my testing) |

---

## Open items, in priority order

### 1. CRM visual quality — CLOSED 2026-08-04
Zah logged in, looked at it, and approved the current design as-is for the whole
team. **No restyle. Neither option A nor B.** The whole team shares the single
`remnant` CRM account, so everyone already lands in the workspace he approved.
What was left was access, and that is now the CRM entry in the topbar account menu.

### 2. Data Zah still owes
- **Byron Davis's social handles and a photo.** His card on `/` has a portrait
  slot the layout already supports, and no links. Web search only found a different
  company with a similar name, so nothing was attached rather than guessed.
- **A portrait for King Konnect.** He is the only artist with no `image_url`, so his
  roster card falls back to a video still that reads as cover art, not a photo.
- **YouTube URLs** for releases missing them. 22 of 32 have none. They are all
  playable through Spotify or Apple now, so this is no longer blocking.
- **Tour dates** → `tour_dates` table
- **Playlist placements** → `discovered_on` table

### 3. Two findings he has not acted on
- **Spotify identity fragmentation.** BREED has **three** separate Spotify artist
  profiles, King Konnect **two**. Every release mints a new zero-follower page
  instead of accruing. Needs Spotify for Artists claim + merge per artist. This is
  the single biggest thing suppressing streaming numbers.
- **41K stranded YouTube views.** *Ring The Alarm* (21K) and *Musick Industry* (20K)
  are the label's two best-performing records anywhere, roughly 10× anything on any
  DSP across all four artists — and they exist **only on YouTube**.

---

## How he wants to be worked with

- **Report completed work as a `✅` checklist**, bold the details that matter, keep
  next steps in their own clearly separated section. He said plainly: *"I'm tired of
  you skipping steps."*
- **Short answers** to quick operational questions until he asks for depth.
- **Verify on the real thing, not in code.** Two separate rounds of frustration came
  from reporting something fixed after checking only the source. The in-app browser
  pane cannot screenshot (it does not composite frames) — **use the Chrome extension
  (`mcp__claude-in-chrome__*`) to actually look at pages.** That is how the brown
  sidebar and the "Hey Tha!" bug were finally caught.
- No em dashes in generated content.

---

## Gotchas that have already bitten (do not rediscover these)

**Dashboard**
- `server.js` has an SPA fallback returning **HTTP 200 + index.html for missing
  files**. Verify deployed assets by `content_type`, never status code.
- `index.html` asset URLs must stay **root-absolute** (`/js/…`). Relative paths 404
  into HTML on nested routes like `/a/jay`.
- `draw()` swaps in a fresh `#view` node every render. Tab `bind()` handlers must
  assume a clean node — the old behaviour stacked listeners and made toggle buttons
  appear dead.
- CSS that sets `display` **beats the browser's `[hidden]` rule**. The lightbox
  covered the page from first paint because of this.
- Numbers that animate must carry the **real value in the markup**; the animation
  only replays it. A zero placeholder shows "0 monthly listeners" whenever the
  observer never fires.
- Many desktops report `prefers-reduced-motion` (Windows animation effects off).
  Do not delete an effect there — degrade it, or it looks broken.
- `hub.js` and `profile.js` must share **one** visitor-id key (`hub-sid`,
  localStorage) or follows break across pages.
- After a fresh clone run `npm install` on Windows, or the esbuild edge-bundle build
  fails.
- `npm test` renders all 14 tabs in read-only and admin modes. Run before every push.
  New `data.js` exports must be added to the mock in `scripts/smoke-test.js`.
- **`loading="lazy"` on a detached `new Image()` never fires `onload`.** The browser
  defers the fetch until the element is in the document, and code that waits for the
  load before inserting it deadlocks. This silently broke cover-art hydration.
- A page opened in a **background tab gets no animation frames** and unreliable
  IntersectionObserver callbacks, so scroll-reveal content sits at opacity 0 until it
  is focused. `label.js` sweeps the viewport directly on load, on `visibilitychange`
  and on scroll so nothing can stay invisible.
- Reveal effects are **not deleted** under `prefers-reduced-motion` (many Windows
  desktops report it). The parallax drift is dropped, the fade stays.
- **The in-app browser pane still cannot screenshot.** Use the Chrome extension.
  Both the cover-art deadlock and the squeezed Management column were only visible
  on the real page.

**Supabase**
- **A `DELETE` with a `WHERE` clause needs `SELECT` on those rows.** Team-only read
  policy made anonymous unfollow silently no-op (HTTP 200, zero rows). Fixed with a
  security-definer `unfollow()` RPC.
- PostgREST upsert is `ON CONFLICT DO UPDATE` and needs an anon UPDATE grant. Use a
  plain insert and treat `409` as success.
- **"Confirm email" is OFF** (Auth → Sign In/Providers). That was the
  "email rate limit exceeded" signup failure — the built-in mailer allows ~2-4/hour.
  Do not re-enable without wiring ZeptoMail SMTP first. The invite code is the gate.
- Supabase dashboard access is GitHub SSO (dvitatoe). Zah has no authenticator set
  up, so avoid flows that hard-require MFA.

**CRM**
- The shell paints its rail with `bg-brand-900/800/700`. A warm brand turns the whole
  left side brown. Branded workspaces get **neutral chrome + accent on the selected
  item only** (scoped by `[data-account-theme]`).
- Neutral greys and the whole dark palette now run through CSS variables
  (`--gray-*`, `--dm-*`) with defaults equal to the original values, so other
  accounts are pixel-identical. This is what makes per-account theming possible.
- Account branding (`themeColor`, `siteName`, `forceDark`) is re-asserted every boot
  from `REMNANT_FLAGS` in `server/remnantSso.js`. The shared account is
  `subscriptionOverride: 'active'` (free forever) and `role: 'admin'`.
- `travel-leads` has **unrelated uncommitted work in progress** (launch-plan files,
  db backends). Never `git add -A` there. Stage specific paths only.

---

## Useful references

- Project memory: `C:\Users\user\.claude\projects\D--\memory\project_remnant_dashboard.md`
- CRM architecture: `D:\travel-leads\CLAUDE.md`
- CRM API key (live credential): `C:\Users\user\.claude\projects\D--travel-leads\memory\zah-crm-api-access.md`
- Music industry template in CRM: id `1LndpXpODoOSlgOS`, **active**
- Migrations live in `supabase/migrations/` (through `0009_artist_reach.sql`) and are
  already applied to production.
