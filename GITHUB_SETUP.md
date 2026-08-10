# GitHub and hosting setup

Use GitHub for Roval's source code and version history. For the full production
app, use the existing ChatGPT Site or the independent Cloudflare Workers + D1
path described in [`DEPLOYMENT_GUIDE.md`](DEPLOYMENT_GUIDE.md).

## Current repository workflow

1. Keep `main` as the stable branch.
2. Make changes on a feature/deployment branch.
3. Review the pull-request diff before merging.
4. Validate in an environment with npm registry access:

```bash
npm ci
npm run lint
npm test
```

5. Preview the hosted build, then merge/deploy when ready.

The repository may show GitHub Pages jobs, but Pages is static hosting and is not
a full Roval runtime test. Roval uses API routes, authenticated cloud sync, and
D1 storage.

## Run locally

Requirements: Node.js 22.13 or newer and npm. Linux/WSL2 is recommended for the
bundled Sites validation scripts.

```bash
npm ci
npm run dev
```

## Deployment files

- `.openai/hosting.json` keeps the existing ChatGPT Sites project association.
- `wrangler.jsonc` defines the independent Cloudflare Worker and D1 binding.
- `CLOUDFLARE_DEPLOY.md` contains Cloudflare preview, permanent deployment, D1,
  and Access instructions.
- `HUAWEI_SETUP.md` covers Huawei Health import, Android Health Connect, and
  Huawei Health Kit REST options.

## Secrets

Do not commit `.env` files, Cloudflare API tokens, Huawei client secrets, refresh
tokens, OAuth credentials, or other private keys.
