# Roval GitHub Setup

This archive contains the complete source for Roval version 9. It intentionally
excludes `node_modules`, generated build output, temporary caches, Git history,
and credentials.

## Included

- Responsive routine tracker and Persian calendar
- Installable PWA manifest, service worker, icons, and shortcuts
- Habit schedules, custom labels, reminders, notes, weekly planning, and reports
- Light, dark, and system themes
- Gemini API route
- Account profile and account-isolated cloud sync
- D1 schema and migration
- Production Worker entry point
- Locked Node dependencies and validation tests
- GitHub Actions build workflow

## Upload through the GitHub website

1. Extract `roval-github-package.zip` on your computer.
2. On GitHub, create a new empty repository. Do not add a README or `.gitignore`.
3. Select **uploading an existing file**.
4. Drag the **contents** of the extracted folder into GitHub. Include hidden
   folders such as `.github` and `.openai`.
5. Commit the uploaded files to the `main` branch.
6. Open the repository's **Actions** tab. The included workflow will install,
   lint, build, and test the project.

## Upload with Git

```bash
git init
git add .
git commit -m "Initial Roval source"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

## Requirements

- Node.js 22.13 or newer
- npm
- A Linux environment for the bundled production validation scripts

Basic validation:

```bash
npm ci
npm run lint
npm test
```

## Important hosting note

GitHub stores and validates the source, but GitHub Pages cannot run this full
application. Roval uses server API routes, a Cloudflare Worker runtime, D1,
dispatch-owned account sign-in, and authenticated identity headers.

The included `.openai/hosting.json` keeps this repository associated with the
existing Roval Site. The current live application can continue to be deployed
through OpenAI Sites while GitHub acts as the source repository and backup.

For a completely independent deployment outside OpenAI Sites, replace these two
platform-specific parts:

1. `app/chatgpt-auth.ts` and the sign-in routes with an external authentication
   provider such as Google OAuth, Supabase Auth, or Firebase Auth.
2. The Sites-managed D1 binding with your own hosted database and environment
   configuration.

The frontend PWA can then be deployed with a compatible full-stack host. A
static GitHub Pages deployment alone is insufficient.

## Data and secrets

- No Gemini API key is included. Users enter it in their own browser session.
- No OAuth secret, database credential, session cookie, or deployment token is
  included.
- User records are keyed by authenticated email in `app/api/sync/route.ts`.
- The D1 schema is in `db/schema.ts` and the generated migration is in
  `drizzle/`.

## Main source locations

| Path | Purpose |
| --- | --- |
| `app/page.tsx` | Main tracker and interactions |
| `app/globals.css` | Responsive light/dark visual system |
| `app/api/` | Gemini, account, and sync endpoints |
| `app/manifest.ts` | PWA metadata and shortcuts |
| `public/sw.js` | Offline service worker |
| `db/` | D1 schema and database helper |
| `drizzle/` | Database migration files |
| `worker/` | Production Worker entry point |
| `.github/workflows/ci.yml` | GitHub validation workflow |

## Install as an app

After deployment over HTTPS:

- Android: browser menu → **Install app** or **Add to Home screen**
- iPhone: Safari Share menu → **Add to Home Screen**
- Windows: Edge or Chrome menu → **Install Roval**

