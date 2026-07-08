# Cloudflare Production Runbook

## Production Architecture

The project runs on Cloudflare without a paid server:

- Frontend: Cloudflare Pages.
- API: Cloudflare Pages Functions in `functions/api/[[path]].js`.
- Database: Cloudflare D1, binding name `DB`.
- Production branch: `main`.

This replaces the old production dependency on an Express server plus PostgreSQL host.

## Live URLs

- Current Pages URL: `https://united-hatzalah-shoham-branch.pages.dev`
- Intended custom subdomain: `https://hatzalah-shoham.evyatarhazan.com`

The custom domain is already attached to the Pages project, but DNS still needs a proxied CNAME:

```text
type: CNAME
name: hatzalah-shoham
target: united-hatzalah-shoham-branch.pages.dev
proxied: true
```

The current Wrangler OAuth token does not have `zone:write`, so DNS creation must be done from the Cloudflare dashboard or with a token that has DNS edit permission.

## Database

D1 database:

```text
name: united-hatzalah-shoham-branch
id: d5ef1fe8-225c-4135-b6a5-3bfd0fb584a2
```

Migrations:

```bash
npm run d1:migrate:local
npm run d1:migrate:remote
```

The Pages Function also performs a safe schema bootstrap with `CREATE TABLE IF NOT EXISTS` and seed `INSERT OR IGNORE` statements so first run does not fail when the D1 store is empty.

## Local Cloudflare Runtime

```bash
npm install
npm run pages:dev
```

Then open:

```text
http://localhost:8788
```

## Manual Production Deploy

```bash
npm run pages:deploy
```

## Automatic Deploy On Main

GitHub workflow:

```text
.github/workflows/deploy-cloudflare.yml
```

Required GitHub secrets:

```text
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_API_TOKEN
```

`CLOUDFLARE_ACCOUNT_ID` has been set in GitHub. `CLOUDFLARE_API_TOKEN` still needs to be added. Create a Cloudflare API token with at least:

- Account: Cloudflare Pages: Edit
- Account: D1: Edit

If the same token should also create/fix DNS records, add:

- Zone: DNS: Edit for `evyatarhazan.com`

After the token is added, every push to `main` will build, apply D1 migrations, and deploy to Cloudflare Pages.
