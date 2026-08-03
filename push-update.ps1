# Pushes the current working tree to https://github.com/Yawitazah/ThaRemnantMusic
#
#   Right-click this file -> "Run with PowerShell"
#   (or: cd to this folder and run  .\push-update.ps1 )
#
# Non-destructive. Unlike push-to-github.ps1, this does NOT wipe history or
# force-push. It repairs the stale local repo, re-points it at the real remote
# history, commits your files on top, and pushes normally.

param([string]$Message = "Hero: logo as left/right background watermark")

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
$Remote = "https://github.com/Yawitazah/ThaRemnantMusic.git"

function Say($m, $c = "Cyan") { Write-Host "`n$m" -ForegroundColor $c }

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Say "Git isn't installed: https://git-scm.com/download/win" "Red"; exit 1
}

# 1. Clear stale lock files left behind by the mounted-drive session.
Say "Clearing stale git locks..."
Get-ChildItem .git -Recurse -Filter "*.lock" -ErrorAction SilentlyContinue |
  Remove-Item -Force -ErrorAction SilentlyContinue

# 2. Identity + remote.
if (-not (git config user.email)) { git config user.email "zahbrandsolutions@gmail.com" }
if (-not (git config user.name))  { git config user.name  "Zah" }
if (-not (git remote | Select-String -Quiet '^origin$')) { git remote add origin $Remote }
else { git remote set-url origin $Remote }

# 3. Adopt the real remote history, keeping every file on disk exactly as is.
Say "Fetching remote history..."
git fetch origin main
if ($LASTEXITCODE -ne 0) { Say "Fetch failed - check your internet / GitHub sign-in." "Red"; exit 1 }

git branch -M main
git reset --mixed origin/main          # moves HEAD only; working tree untouched
git branch --set-upstream-to=origin/main main 2>$null

# 4. Commit whatever actually differs from the remote.
git add -A
$staged = git diff --cached --name-only
if (-not $staged) { Say "Nothing to push - remote is already up to date." "Green"; exit 0 }

Say "Committing:"
$staged | ForEach-Object { Write-Host "  $_" }
git commit -q -m $Message

# 5. Push.
Say "Pushing to $Remote ..."
git push -u origin main
if ($LASTEXITCODE -ne 0) {
  Say "Push failed. Usually a sign-in issue - git should open a browser window. If not, install https://cli.github.com and run: gh auth login" "Red"
  exit 1
}

Say "Done. https://github.com/Yawitazah/ThaRemnantMusic" "Green"
Say "Railway will pick this up and redeploy automatically." "Cyan"
Read-Host "`nPress Enter to close"
