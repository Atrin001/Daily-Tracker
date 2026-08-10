# Roval deployment guide

Roval is a full-stack installable PWA. GitHub is the best place to keep the
source code, but GitHub Pages is not the right production host for the complete
app because Roval uses API routes, account identity, cloud synchronization, and
a D1 database.

## Recommended setup today

Use this combination:

1. **GitHub** — source code, version history, pull requests, and automated validation.
2. **ChatGPT Sites** — current production host. This preserves the existing
   ChatGPT sign-in headers and the D1 binding already used by Roval.
3. **PWA installation** — users install the same hosted website from their
   browser. There is no second web codebase to maintain.

The `.openai/hosting.json` file contains the existing Sites `project_id`. Keep
that file when publishing updates to the same Roval Site.

## Put the full source on GitHub

### Option A: GitHub website

1. Create a new empty repository. Do not initialize it with a README.
2. Extract the Roval ZIP.
3. Upload everything from the extracted folder, including hidden folders:
   `.github`, `.openai`, and `.gitignore`.
4. Commit the files to `main`.
5. Open the **Actions** tab. The included `Validate Roval` workflow runs install,
   lint, tests, and the production build on every push and pull request.

### Option B: Git command line

```bash
git init
git add .
git commit -m "Import Roval"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/roval.git
git push -u origin main
```

Never commit `.env` files, Huawei client secrets, refresh tokens, API keys, or
Cloudflare API tokens. `.env*` is already ignored.

## Deploy updates to the existing ChatGPT Site

This is currently the only path that preserves every existing Roval server
feature without changing the authentication layer.

1. Clone or download the GitHub repository to your computer.
2. Open that folder in ChatGPT Work/Codex Sites.
3. Keep `.openai/hosting.json` unchanged so the existing project ID remains
   attached.
4. Ask Sites to save a new version of the existing project.
5. Review the preview.
6. Deploy the saved version to production.
7. Re-open the installed Roval PWA. The service worker will update the web app.

For a normal UI update, users do not reinstall Roval. It is the same hosted PWA.

## Independent hosting: Cloudflare Workers

Roval is now prepared for an independent Cloudflare Workers + D1 deployment.
The root `wrangler.jsonc` declares the Worker entry point and the `DB` binding,
and the Vite configuration uses that root config for Cloudflare builds.

The independent identity layer supports Cloudflare Access without weakening the
existing ChatGPT Sites path. Roval validates the signed Access JWT before using
the email claim for cloud-sync ownership. Configure these Worker variables after
you create the Access application:

- `CF_ACCESS_TEAM_DOMAIN`
- `CF_ACCESS_AUD`

For a permanent account, the intended sequence is:

```bash
npm ci
npx wrangler login
npm run deploy:cloudflare
npm run db:migrate:cloudflare
```

Wrangler can automatically provision the D1 resource declared without an ID in
`wrangler.jsonc`. The migration directory is `drizzle/`.

For a claimable preview before Cloudflare login, current Wrangler supports
`--temporary`. Cloudflare requires you personally to accept its Terms and
Privacy Policy before creating that temporary account, so use:

```bash
npm ci
npm run deploy:temporary
```

after you have accepted those terms. Keep the printed claim URL private and
claim the deployment within Wrangler's stated window if you want to keep it.

See `CLOUDFLARE_DEPLOY.md` for the complete production and Access setup.

## Install Roval as an app

Roval is already a PWA. After deployment over HTTPS:

- Android/Chrome: open Roval and choose **Install app**.
- Desktop Chrome/Edge: use the browser's install control.
- iPhone/iPad Safari: use **Share → Add to Home Screen**.

The installed PWA and the website use the same code and data.

## Native Android version for Huawei Health Connect

A PWA cannot directly call Android Health Connect APIs. If you want the easiest
personal Huawei bridge on Android, the next phase should wrap Roval in a small
native Android shell (for example, a Capacitor-style shell) and add a native
Health Connect bridge. The web UI stays Roval; the native layer only reads
approved health records and sends normalized daily summaries into the existing
Roval Health dashboard.

For broader cross-platform Huawei access, use Huawei Health Service Kit/Health
Kit REST instead; that requires Huawei developer configuration, user consent,
and the relevant approved scopes.
