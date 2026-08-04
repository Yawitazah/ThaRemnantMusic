# Tha Remnant Music Group — handoff

Everything a new session needs to continue. Written 2026-08-04.

---

## The two things that exist

**1. Label Command Center** — the dashboard + public artist pages.
- Source: `D:\downloads\remnant-handoff\remnant-dashboard`
- Repo: `Yawitazah/ThaRemnantMusic`, branch `main`
- Live: https://command-center-production-cc6b.up.railway.app
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
| **Label landing page (fans)** | `/label` |
| BREED | `/a/breed` · `/artist/breed` |
| King Konnect | `/a/kingkonnect` · `/artist/kingkonnect` |
| JayThaRealist | `/a/jay` · `/artist/jay` |
| Yawitazah | `/a/yawitazah` · `/artist/yawitazah` |

`/label` = the audience-facing front door, added 2026-08-04. Hero, what is being
pushed right now, latest releases, the roster, most played, Management, email
capture. Ruddy dark Higgsfield plates that drift on scroll (`public/img/scenes/`).
Deliberately carries **no internal numbers**. Still at `/label` rather than `/`
because that call is Zah's; moving it is a three-line change in `server.js` and
`app.js`.

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

**Navigation exists now.** The topbar carries quick "My hub" and "My page" links
plus an account menu (Command Center, ZAH CRM, the artist's own public pages, sign
out). The Command Center and CRM entries render **only when `is_team()` is true**,
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
- **Byron Davis's social handles and a photo.** His card on `/label` has a portrait
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
