# Roval Daily Tracker

Roval is an installable Persian-calendar planner and habit tracker with weighted
goals, cloud sync, AI coaching, reports, reminders, and a separate wearable
Health dashboard.

## Current capabilities

- recurring habits with schedules and progress history
- one-day planner items for any selected date
- remove a recurring habit from one day without deleting it everywhere
- editable past dates
- wearable Health dashboard with manual entry and JSON/CSV import
- PWA installation on supported browsers
- ChatGPT Sites identity/cloud sync
- Cloudflare Workers + D1 groundwork for independent hosting
- Cloudflare Access JWT validation for independent account identity

## Start here

- [`DEPLOYMENT_GUIDE.md`](DEPLOYMENT_GUIDE.md) — GitHub, ChatGPT Sites, Cloudflare, and PWA deployment
- [`CLOUDFLARE_DEPLOY.md`](CLOUDFLARE_DEPLOY.md) — independent Workers + D1 deployment
- [`HUAWEI_SETUP.md`](HUAWEI_SETUP.md) — Huawei Band / Huawei Health integration options
- [`GITHUB_SETUP.md`](GITHUB_SETUP.md) — repository workflow and source layout

Automatic Huawei Health synchronization is not active yet. The current app
supports manual health entry/import; direct Huawei Health Kit sync requires the
Huawei developer setup and approved health scopes described in
`HUAWEI_SETUP.md`.

## Development

Requirements:

- Node.js `>=22.13.0`
- npm
- Linux is recommended for the bundled validation scripts

Common commands:

```bash
npm ci
npm run dev
npm run lint
npm test
```

Cloudflare commands:

```bash
npm run build:cloudflare
npm run deploy:cloudflare
npm run db:migrate:cloudflare
```

A claimable Cloudflare preview can be started with:

```bash
npm run deploy:temporary
```

That temporary flow uses the latest Wrangler because the repository's pinned
Wrangler version is older than the version that introduced temporary claimable
deployments.

## Hosting configuration

- `.openai/hosting.json` keeps the existing ChatGPT Sites project association.
- `wrangler.jsonc` defines the independent Cloudflare Worker and `DB` D1 binding.
- `vite.config.ts` uses the Cloudflare Vite plugin for Worker builds.
- `worker/index.ts` is the Worker entry point.
- `db/` and `drizzle/` contain cloud-sync storage and migrations.
- `app/chatgpt-auth.ts` accepts ChatGPT Sites identity or a verified Cloudflare
  Access JWT.

Do not commit `.env` files, API tokens, Huawei client secrets, refresh tokens,
or other credentials.
