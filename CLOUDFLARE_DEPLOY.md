# Deploy Roval on Cloudflare Workers

Roval can be hosted independently on Cloudflare Workers with D1 for cloud sync.
The source remains compatible with the existing ChatGPT Sites deployment.

## Why Cloudflare

The project already runs on the Cloudflare Worker runtime and uses a D1 binding
named `DB`. Cloudflare Workers can also connect directly to GitHub and build on
push.

## Fastest path: deploy from GitHub

1. Push the current Roval source to GitHub.
2. In Cloudflare Dashboard open **Workers & Pages → Create → Import a repository**.
3. Select the Roval repository.
4. Use the default deploy command: `npx wrangler deploy`.
5. If Wrangler offers automatic framework configuration, let it create its
   configuration pull request and preview deployment.
6. Create a D1 database named `roval-db` and bind it to the Worker as `DB`.
7. Apply `drizzle/0000_marvelous_iron_fist.sql` to the production D1 database.

## Secure sign-in with Cloudflare Access

Protect the entire Worker/custom domain with Cloudflare Access. Roval supports
both the existing ChatGPT Sites identity and Cloudflare Access identity.

Set these Worker variables:

- `CF_ACCESS_TEAM_DOMAIN` — for example `your-team.cloudflareaccess.com`
- `CF_ACCESS_AUD` — the Access application's Audience (AUD) tag

Roval validates the signed `Cf-Access-Jwt-Assertion` token, including its issuer,
audience, expiry, signing key, and signature, before using the email claim for
cloud-sync ownership. Do not replace this with a client-supplied email header.

## Database

The Worker expects a D1 binding named `DB`. The existing migration creates the
`user_states` table used by cloud sync.

Example command after Cloudflare login:

```bash
npx wrangler d1 create roval-db
npx wrangler d1 execute roval-db --remote --file=./drizzle/0000_marvelous_iron_fist.sql
npx wrangler deploy
```

## Temporary deployment without Cloudflare login

Newer Wrangler versions support temporary deployments intended for agents and
development environments:

```bash
npx wrangler@latest deploy --temporary
```

Wrangler prints a temporary preview URL and a claim URL. This is useful for
checking the web UI before attaching your permanent database, Access policy,
and custom domain. A temporary preview is not the final production setup.

## Install as an app

Once the permanent deployment is available over HTTPS, open it in Chrome/Edge
or Safari and choose **Install app** / **Add to Home Screen**. Roval's manifest
and service worker make the hosted web application installable as a PWA.
