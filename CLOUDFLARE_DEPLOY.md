# Deploy Roval on Cloudflare Workers

Roval can run independently on Cloudflare Workers with D1 for cloud sync while
remaining compatible with the existing ChatGPT Sites deployment.

## What is already prepared

- `wrangler.jsonc` defines the Worker entry point and the `DB` D1 binding.
- The D1 binding intentionally has no database ID. Wrangler can automatically
  provision it on the first permanent deployment and write the ID back to the
  config.
- `vite.config.ts` now lets the Cloudflare Vite plugin read the root Wrangler
  config instead of forcing the old ChatGPT Sites placeholder database ID.
- `app/chatgpt-auth.ts` supports both ChatGPT Sites identity and a verified
  Cloudflare Access application JWT.
- `app/api/sync/route.ts` keys cloud data only by the verified signed-in email.
- The installed PWA remains the same web application; users normally do not
  reinstall it after a deployment.

## Temporary preview without Cloudflare login

Cloudflare supports claimable temporary Workers accounts in Wrangler 4.102.0+
with `wrangler deploy --temporary`. Cloudflare requires the person creating the
temporary account to accept its Terms and Privacy Policy, so an automated agent
must not accept that legal agreement for you.

After accepting those terms yourself, run:

```bash
npm ci
npm run deploy:temporary
```

The script builds Roval with vinext/Vite and runs the latest Wrangler with the
`--temporary` flag. Wrangler prints:

- a temporary `workers.dev` preview URL;
- a private claim URL.

Treat the claim URL like a password. Claim it within the time window shown by
Wrangler if you want to keep the Worker and supported resources.

The temporary preview can validate the UI and Worker runtime. Account cloud sync
will remain unavailable until Cloudflare Access is configured and the D1
migration is applied.

### If Wrangler says `reused` and then `Invalid access token`

Wrangler caches the temporary preview account in the current operating-system
user's global Wrangler configuration. If that temporary token expires or becomes
invalid, a later `--temporary` deploy can try to reuse the stale account and fail
with Cloudflare API authentication errors such as code `9109` or `10000`.

Clear the cached temporary account and create a fresh one:

```bash
npm run deploy:temporary:fresh
```

This runs `wrangler logout` first, which clears Wrangler's cached temporary
account, then rebuilds and runs `wrangler deploy --temporary` again. A successful
retry should say the temporary account was **created** rather than **reused** and
print a new private claim URL.

If you manually run the recovery commands instead, use:

```bash
npx wrangler@latest logout
npm run deploy:temporary
```

Do not post claim URLs in chats, issues, logs, screenshots, or source control.
Anyone who has a valid claim URL can claim the temporary Cloudflare account.

## Permanent deployment

After you have a permanent Cloudflare account:

```bash
npm ci
npx wrangler login
npm run deploy:cloudflare
npm run db:migrate:cloudflare
```

On first deployment, Wrangler can automatically create the D1 resource declared
by the `DB` binding. Check the resulting `wrangler.jsonc` into GitHub after
Wrangler writes the provisioned database information into it.

`npm run db:migrate:cloudflare` applies the SQL migrations in `drizzle/` to the
remote D1 database. The current migration creates `user_states`, which is the
table used by Roval cloud sync.

## Secure sign-in with Cloudflare Access

Protect the production Worker/custom domain with a Cloudflare Access self-hosted
application. Configure an identity provider you prefer.

Add these Worker variables after Access is created:

- `CF_ACCESS_TEAM_DOMAIN` — for example `your-team.cloudflareaccess.com`
- `CF_ACCESS_AUD` — the Access application's Audience (AUD) tag

Roval reads the `Cf-Access-Jwt-Assertion` request header and validates the JWT
signature, key ID, issuer, audience, expiry, and not-before value before using
its email claim. It fetches the current Access public signing keys from the
team's `/cdn-cgi/access/certs` endpoint, so signing-key rotation does not require
hard-coded certificates.

The Worker translates Roval's existing profile sign-out path to Cloudflare
Access logout on an independent deployment. ChatGPT Sites continues to own the
same sign-out path on the original hosted Site.

## GitHub-to-Cloudflare after the first deployment

Once the Worker has been claimed/configured, you can connect the
`Atrin001/Daily-Tracker` repository in the Cloudflare dashboard and deploy from
Git. Use the `main` branch only after the draft PR has been tested and merged.

For a protected production deployment, keep tokens and secrets in Cloudflare or
GitHub secret storage. Never commit API tokens, Huawei client secrets, OAuth
refresh tokens, or `.env` files.

## Install as an app

After the permanent HTTPS deployment is live, open Roval in Chrome/Edge or
Safari and choose **Install app** / **Add to Home Screen**. The manifest and
service worker make the same hosted Roval interface installable as a PWA.
