# Getting the dashboard live for the team

Everything below is already built and tested. This is the last mile: putting it on a URL your
team can open.

Total time: about ten minutes, most of it waiting on Railway.

---

## The short version

```powershell
cd remnant-dashboard
node server.js              # check it works locally, Ctrl+C when done
.\push-to-github.ps1        # resets git, commits, creates the repo, pushes
```

Then create your admin login (step 2) and point Railway at the repo (step 4). The rest of this
file is the same thing, explained.

---

## 1. Check it runs (1 minute)

```powershell
cd remnant-dashboard
node server.js
```

No `npm install` needed — the server has zero dependencies. (You only need `npm install` if you
want to run `npm test` or `npm run build`.)

Open <http://localhost:3000>. You should see the Diagnosis tab with the 4.8× chart, and the
badge in the top right should read **live** — that means it reached the database. Click through
all nine tabs before going further.

`Ctrl+C` to stop.

---

## 2. Make your admin login (2 minutes)

Right now nobody can edit, including you. Create your account:

1. Go to <https://supabase.com/dashboard/project/upfqppdfckqehzgsosdi/auth/users>
2. **Add user → Create new user**
3. Use `zahbrandsolutions@gmail.com` and a password you'll remember
4. Leave **Auto Confirm User** ticked

Back on the dashboard, click **Sign in to edit**, use those credentials, and you should see the
green *Edit mode* banner. Tick a playbook item to confirm it saves, then untick it.

Anyone who does **not** sign in gets the full read-only view. That's what the team gets.

> **Why only that email works:** Supabase lets anyone sign up by default. If write access simply
> meant "logged in", a stranger could create an account and edit your numbers. So writes are
> restricted to emails listed in the `admins` table — currently just yours. To add someone later,
> run `insert into admins (email, note) values ('them@example.com', 'who they are');` in the
> Supabase SQL editor, then create their login under Authentication → Users.
>
> Optional belt-and-braces: turn sign-ups off entirely under
> **Authentication → Sign In / Providers → Email → Allow new users to sign up**.

---

## 3. Push to GitHub (3 minutes)

```powershell
.\push-to-github.ps1
```

It's already pointed at <https://github.com/Yawitazah/ThaRemnantMusic>. The script wipes the
throwaway git history from when this folder was prepared, commits everything fresh, and pushes.

Safe to re-run. If the repo already has commits: `.\push-to-github.ps1 -Force`

> **That repo is public.** Nothing secret is committed — the only key in the code is the Supabase
> *publishable* key, which is designed to be visible in browsers and cannot write anything on its
> own (writes need a signed-in admin account). Your database is not exposed by this. If you'd
> still rather it were private: repo **Settings → General → Danger Zone → Change visibility**.

<details>
<summary>Doing it by hand instead</summary>

Create an empty repo at <https://github.com/new> — no README, no .gitignore. Then:

```powershell
Remove-Item .git -Recurse -Force
git init
git branch -M main
git config user.email "zahbrandsolutions@gmail.com"
git config user.name "Zah"
git add -A
git commit -m "Label Command Center"
git remote add origin https://github.com/YOUR-USERNAME/remnant-command-center.git
git push -u origin main
```

The `Remove-Item .git` line matters — the folder was prepared on a mounted drive, which left
stale lock files that block commits.

</details>

---

## 4. Deploy on Railway (3 minutes)

A project is already waiting for you:
**<https://railway.com/project/afb2e67c-71ad-46d1-a6d6-37652ff9ee04>**

1. Open it → **Create → GitHub Repo** → pick `remnant-command-center`
   (first time only, Railway will ask to connect your GitHub account)
2. Railway detects Node and runs `npm start` on its own. **No environment variables needed.**
3. When the build goes green: **Settings → Networking → Generate Domain**

That domain is the link you send the team.

From then on, every `git push` redeploys automatically.

---

## 5. Send it out

The team needs one line:

> Label dashboard — everything we know about where the music actually stands:
> `https://your-domain.up.railway.app`
> No login needed to look. Numbers update as I log them.

---

## Changing the dashboard later

Edit the files in `public/` — they're plain JavaScript, no build step, no framework:

| To change | Edit |
|---|---|
| Wording, layout of a tab | `public/js/tabs/<tabname>.js` |
| Colours, spacing, type | `public/css/app.css` |
| Charts, number formatting | `public/js/ui.js` |
| Which tabs exist | `public/index.html` and `public/js/app.js` |

Then:

```powershell
node scripts/smoke-test.js   # catches broken tabs before anyone sees them
git add -A
git commit -m "what changed"
git push                      # Railway redeploys itself
```

Data changes — stream counts, checklist ticks, weekly numbers — never need a deploy. Those go
straight into the database from the dashboard itself.

---

## If something breaks

**Badge says "offline"** — the Supabase project is paused. Free projects sleep after a week of no
traffic. Open <https://supabase.com/dashboard/project/upfqppdfckqehzgsosdi> and resume it.

**Sign-in fails** — the account doesn't exist yet, or the email wasn't confirmed. Redo step 2.

**A tab is blank after you edited it** — run `node scripts/smoke-test.js`; it will name the tab
and the error.

**Railway build fails** — check the deploy logs in Railway. The most common cause is pushing
`node_modules/`, which `.gitignore` already prevents.
