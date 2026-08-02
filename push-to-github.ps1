# Puts this folder on GitHub in one step.
#
#   .\push-to-github.ps1
#
# Defaults to your repo: https://github.com/Yawitazah/ThaRemnantMusic
# Safe to re-run — it resets local git history and force-pushes a clean tree.

param(
  [string]$RemoteUrl = "https://github.com/Yawitazah/ThaRemnantMusic.git",
  [switch]$Force
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

function Say($msg, $colour = "Cyan") { Write-Host "`n$msg" -ForegroundColor $colour }

# --- 1. Make sure git exists -------------------------------------------------
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Say "Git isn't installed. Get it from https://git-scm.com/download/win then re-run this." "Red"
  exit 1
}

# --- 2. Clean start ----------------------------------------------------------
# This folder was prepared on a mounted drive, which left stale lock files and a
# throwaway commit behind. A fresh repo is the simplest fix — nothing is lost.
if (Test-Path .git) {
  Say "Resetting local git history for a clean start..."
  Remove-Item .git -Recurse -Force
}

git init -q
git branch -M main

if (-not (git config user.email)) { git config user.email "zahbrandsolutions@gmail.com" }
if (-not (git config user.name))  { git config user.name  "Zah" }

git add -A
git commit -q -m "Label Command Center - team dashboard for Tha Remnant Music Group"

$tracked = (git ls-files).Count
Say "Committed $tracked files (node_modules excluded)." "Green"

# --- 3. Push -----------------------------------------------------------------
git remote remove origin 2>$null
git remote add origin $RemoteUrl

Say "Pushing to $RemoteUrl ..."
if ($Force) { git push -u origin main --force } else { git push -u origin main }

if ($LASTEXITCODE -ne 0) {
  Say @"
Push failed. Two common reasons:

  - Not signed in to GitHub. Git should open a browser window; if it didn't,
    install the GitHub CLI (https://cli.github.com) and run: gh auth login

  - The repo already has commits in it. Re-run with -Force to overwrite:
      .\push-to-github.ps1 -Force
"@ "Red"
  exit 1
}

$webUrl = $RemoteUrl -replace '\.git$',''
Say "Done. Code is at $webUrl" "Green"

# --- 4. What's next ----------------------------------------------------------
Write-Host @"

Heads up: that repo is PUBLIC. Nothing secret is in it - the only key committed is
the Supabase publishable key, which is designed to be visible and cannot write
anything on its own. If you'd rather it were private:
Settings -> General -> Danger Zone -> Change visibility.

Next: put it on a URL for the team.

  1. Open https://railway.com/project/afb2e67c-71ad-46d1-a6d6-37652ff9ee04
  2. Create -> GitHub Repo -> pick ThaRemnantMusic
  3. When the build goes green: Settings -> Networking -> Generate Domain

From then on, 'git push' redeploys automatically.

"@ -ForegroundColor Cyan
