# Build list — from Zah, 2026-08-04

Everything he asked for in one pass, grouped.

**Status: A through G are built, tested and deployed.** Migrations `0010` and `0011`
are applied to production. Three decisions at the bottom are still open, and none
of them block anything that shipped.

---

## A. Artist page analytics (Command Center → Artists tab → Growth card)

| # | Item | Where it lives now |
|---|---|---|
| A1 | Add a **24 hour / daily** window alongside 7 days, 28 days, all time | `public/js/tabs/artists.js:56-58` — only `7d`, `28d`, `all` exist |
| A2 | Make **All time** actually mean all time | same file, line 58: `all` is hard-capped at `days: 56`, so the daily chart silently truncates |
| A3 | Show **how many times each item was viewed and clicked**, per release, per track, per link, per button — not just artist-level totals | only `Clicks by destination` bars exist (`artists.js:202`); there are no per-release view counts anywhere |
| A4 | Fix **Latest activity** so it reads clearly. Right now it is a raw event dump (`view / click / capture` + "3h ago") with no counts and no context, which is why it does not make sense | `artists.js:140-151` |
| A5 | Show **growth as growth**: each window compared to the one before it, with up/down direction, so "7 days" means "up 12% vs the previous 7" | does not exist |

---

## B. Navigation for signed-in artists

| # | Item |
|---|---|
| B1 | Add real **navigation in the topbar**, near the notification bell, so an artist can move between pages instead of typing URLs |
| B2 | A signed-in artist can reach: **their link hub**, **their artist page**, and **the Command Center** |
| B3 | The **Command Center link is artist/team only**. A fan must never see it |
| B4 | From `/a/{slug}` (link hub) and `/artist/{slug}` (profile), a signed-in artist can **navigate back to the Command Center** |
| B5 | We have sign in and sign out, but no way to move around once you are in. Make signed-in state and the available destinations **visible, not hidden** |
| B6 | Admin (Zah) can jump to **any** artist's hub and page; an artist gets their own |

Current state: the topbar holds only sync status, the bell, and the light/dark toggle (`public/index.html:34-41`). No account menu, no page switcher.

---

## C. New public landing page for Tha Remnant Music Group

| # | Item |
|---|---|
| C1 | Build a **public, audience-facing landing page**. Not the existing dashboard, not "Now Pushing", no internal data on it |
| C2 | Highlight **what is happening right now** and **what just dropped** |
| C3 | Highlight **the artists**, all four |
| C4 | Make it **look amazing**. This is the front door for fans |
| C5 | **Scroll-driven animation**: background images scroll into place and animate as you move down the page |
| C6 | Generate the backgrounds in **Higgsfield**: ruddy, dark, shadowy. Room almost dark, one shaft of light hitting the subject |
| C7 | Subject list he named: **Bible open on a nightstand**, **a nice watch**, **an ashtray**, **a microphone**, **a phone sitting with a notification lit**, **a gold crown**. More in the same language as we go |
| C8 | Built so **we keep developing it together**, section by section |

---

## D. Music playback on every artist page

| # | Item |
|---|---|
| D1 | Clicking a **music thumbnail opens that track in the bottom player bar**, so browsing continues while it plays |
| D2 | Clicking **Spotify / Apple / other DSP buttons** goes straight to that platform instead |
| D3 | The bottom bar plays **whatever that platform allows**: full song or preview |
| D4 | Same behavior on the **link hub**, the **artist profile page**, and the **new landing page** |

Current state: the bottom dock exists but is **YouTube only** (`public/js/profile.js:258-336`), and **22 of 32 releases have no YouTube URL**, so most of the catalog is unplayable today.

---

## E. Artist page hero

| # | Item |
|---|---|
| E1 | Make the **hero image taller so faces land centered** in the frame instead of cropped |

---

## F. CRM access for the team — RESOLVED 2026-08-04

Zah logged in, the look is approved as-is. **No restyle. The A/B question is closed: keep the
Remnant workspace exactly as it is, and every artist and team member sees that same workspace.**
That already happens by design, because the whole team shares the single `remnant` CRM account.

What is left is access, not looks:

| # | Item |
|---|---|
| F1 | A signed-in team member gets **one obvious button into the CRM that just works**. No second password, no extra step, no detour |
| F2 | That button belongs in the **new topbar navigation** from section B, so it is visible from anywhere in the Command Center |
| F3 | Confirm the **SSO handoff holds for a non-admin artist account**, not just Zah. Nobody has tested it with a real invite-code user, since **zero of the 5 codes have been claimed** |

## G. New team member — Byron "Breakout" Davis, artist manager

| # | Item | Done |
|---|---|---|
| G1 | Profile created. New `team_members` table, not `artist_profiles` — listing a manager as a recording artist would have given him a public artist page and a growth chart with no music behind it | ✅ |
| G2 | Invite code **`REMNANT-BYRON-3D8P`**, single use, `artist` null so he gets full team visibility and no artist page of his own | ✅ |
| G3 | Socials | ❌ not found |

His bio, nine career highlights and his base cities are live in the new **Management** section on `/label`.

**Socials could not be confirmed.** The searches turned up a different company (Breakout Artist
Management in Chesapeake VA, owned by someone else) and one possible `slideshare.net/breakoutyear`
handle that is old and unverifiable. Nothing was attached rather than guess. Send his handles and
they go straight on the card. A photo would also fill the empty portrait slot the layout already
supports.

---

## Decisions still open

1. **Landing page URL.** It shipped at **`/label`**, which changes nothing for anyone already using the
   Command Center at `/`. Moving the public page to `/` and the Command Center to `/command` is a
   three-line change whenever you want it. Now is the cheapest moment, since none of the 6 invite
   codes have been claimed.
2. **"Daily" definition.** Built as a **rolling last 24 hours**. Say so if you meant calendar day.
3. **Spotify and Apple previews.** Confirmed on the real page: a signed-out visitor gets a **30 second
   preview** with a "Preview" badge, someone signed into that service gets the whole song. Their rule.

## Data gaps that limit what is on screen

- **King Konnect has no portrait.** His roster card falls back to a video still, which reads as
  cover art rather than a photo. Every other artist has a real one.
- **Tour dates and playlist placements** are still empty, so those sections stay hidden.
- **22 of 32 releases have no YouTube URL.** They are all playable now through Spotify and Apple, so
  this is no longer blocking, but a video is still the better experience where one exists.
