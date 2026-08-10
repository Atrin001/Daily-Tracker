# GitHub and hosting setup

Use GitHub for Roval's source code, version history, and validation. For the full
production app, use ChatGPT Sites today or complete the standalone Cloudflare
authentication adaptation described in [`DEPLOYMENT_GUIDE.md`](DEPLOYMENT_GUIDE.md).

## Upload this package

1. Extract the ZIP.
2. Create a new GitHub repository without an auto-generated README.
3. Upload every extracted file, including `.github`, `.openai`, and `.gitignore`.
4. Commit the files.
5. The included GitHub Action will install, lint, test, and build Roval on pushes
   and pull requests.

Do not commit secrets or `.env` files.

## Run locally

Requirements: Linux or WSL2, Node.js 22.13 or newer, Git, `flock`, `curl`, and GNU `timeout`.

```bash
npm ci
npm run lint
npm test
npm run dev
```

The existing production login and cloud account boundary are supplied by
ChatGPT Sites. Local development is intended for interface/code work; sign-in and
cloud sync should be verified on a hosted deployment.

## GitHub Pages warning

GitHub Pages cannot run Roval's API routes, D1 database, cloud sync, or server-side
Huawei integration. Publishing only the static frontend there would be an
incomplete version of Roval.

Read:

- `DEPLOYMENT_GUIDE.md` for GitHub → Sites and GitHub → Cloudflare options.
- `HUAWEI_SETUP.md` for Huawei Health import, Android Health Connect, and Health
  Kit REST options.
