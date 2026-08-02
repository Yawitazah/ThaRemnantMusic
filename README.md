# Tha Remnant Music Group — Label Command Center

A live, team-visible dashboard for the label. Everything the handoff brief diagnosed, turned into
something you update once a week instead of a document that goes stale.

- **You edit. The team reads.** Anyone with the link sees current numbers. Only signed-in admins
  can change them.
- **Shared data.** Numbers live in Postgres (Supabase), not in browser memory. No more
  "export before you close the tab."
- **No build step to run it.** Plain ES modules, no framework, no bundler required for local use.

---

## Run it locally

```bash
cd remnant-dashboard
node server.js
```

Then open <http://localhost:3000>. That is the whole setup — Node 18 or newer, nothing to install.

The dashboard reads from the shared Supabase project, so what you see locally is the same data
the team sees.

---

## The nine tabs

| Tab | What it holds |
|---|---|
| **Diagnosis** | The five findings, the accidental A/B test, the Yawitazah pattern |
| **Roster** | Each artist, their channel, and the honest read on where they stand |
| **Player** | Inline YouTube player across the full catalog |
| **Catalog** | All 77 tracks — filter by artist, sort by any column, search |
| **Album Ledger** | The 9 album tracks; log Spotify/Apple/other streams per track |
| **90-Day Playbook** | 28 tasks across three phases, with notes and live progress |
| **Opportunity Board** | 14 moves ranked by impact, each with an editable status |
| **Budget & Goal** | The $500/mo allocation plus a goal model you can drag |
| **Weekly Tracker** | Monday snapshots and the trend line they produce |

---

## Editing

Click **Sign in to edit** (top right). Without an account you get a full read-only view — that is
what you share with the team.

To create or add an admin account, go to the Supabase dashboard →
**Authentication → Users → Add user**, then sign in with that email and password.

Everything saves the moment you change it. There is no save button and nothing to export.

---

## Layout

```
remnant-dashboard/
├── server.js                 zero-dependency static server (local + Railway)
├── package.json
├── public/
│   ├── index.html
│   ├── css/app.css
│   └── js/
│       ├── config.js         Supabase URL + publishable key
│       ├── data.js           client, store, CRUD, derived stats
│       ├── ui.js             formatting, SVG charts, toasts
│       ├── app.js            auth, routing, tab shell
│       └── tabs/             one file per tab
├── scripts/
│   └── build-edge-function.js
└── supabase/
    ├── migrations/           schema + seed, replayable from scratch
    └── functions/dashboard/  generated deploy artifact
```

Edit files in `public/`. They are the source. `supabase/functions/dashboard/index.ts` is generated —
do not edit it by hand.

---

## Deploying

### Option A — Railway (nicer URL, auto-deploys on push)

1. Create a GitHub repo and push this folder to it.
2. Railway → **New Project → Deploy from GitHub repo** → pick it.
3. Railway detects Node and runs `npm start`. No environment variables are required — the Supabase
   publishable key is already in `public/js/config.js` and is safe to expose.
4. **Settings → Networking → Generate Domain.**

To point at a different Supabase project instead, set `SUPABASE_URL` and `SUPABASE_ANON_KEY` as
Railway variables and add `<script src="/config.js"></script>` above the module script in
`index.html`.

### Option B — Supabase Edge Function (no GitHub needed)

```bash
npm install          # esbuild, for the bundle step
npm run build        # → supabase/functions/dashboard/index.ts
supabase functions deploy dashboard --no-verify-jwt
```

Served at `https://<project-ref>.supabase.co/functions/v1/dashboard/`.

---

## Database

Schema and seed data live in `supabase/migrations/`. To rebuild the project from nothing:

```bash
supabase db push
```

Eleven tables: `channels`, `roster`, `catalog`, `album_tracks`, `prior_catalog`, `playbook_items`,
`opportunities`, `budget_lines`, `weekly_snapshots`, `settings`, `admins`.

Row Level Security is on for all of them. `select` is open to everyone; every write requires a
signed-in account **whose email is in the `admins` table**. Signing up alone is not enough — that
matters because Supabase allows public sign-up by default, so "any logged-in user can write" would
have meant "anyone at all can write".

To add another admin:

```sql
insert into admins (email, note) values ('someone@example.com', 'who they are');
```

Then create their login under **Authentication → Users**. To remove one, delete the row — their
account survives but drops to read-only.

---

## Keeping the numbers honest

YouTube figures were scraped live on **2 August 2026**. Re-pull anything older than a couple of
weeks before quoting it. Ad benchmarks and curator conversion rates in the Opportunity Board came
from third-party industry sources, not vendor documentation — they are directional, not promises.

Weekly, five minutes, from the Weekly Tracker tab:

| Number | Where |
|---|---|
| Channel subs & views | YouTube Studio → Analytics → Overview → last 28 days |
| Spotify monthly listeners | Spotify for Artists → Home |
| Spotify followers | Spotify for Artists → Audience → Followers |
| Total streams, all DSPs | DistroKid → Bank → Stats |
| Revenue | DistroKid Bank + YT Studio Revenue + store dashboard |
