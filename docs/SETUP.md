# Setup and deployment

## Local development

Install Node.js 24 or newer. In the project directory:

```powershell
npm ci
npm run db:migrate
npm run db:seed
npm run dev
```

Visit `http://127.0.0.1:5173`. Stop the development command with Ctrl+C. Seed is safe to rerun because demo rows use stable IDs and `INSERT OR IGNORE`.

Optional `.env` values:

| Variable | Default | Use |
| --- | --- | --- |
| `PORT` | `3001` | Node HTTP port |
| `HOST` | `127.0.0.1` | Bind address; use `0.0.0.0` behind a reverse proxy |
| `DATABASE_PATH` | `./data/tantu.db` | Persistent SQLite file |
| `DATABASE_URL` | absent | Postgres connection; selects hosted database mode |
| `USE_BLOB_STORAGE` | absent | Set to `1` locally to upload photos to Vercel Blob |
| `OPENAI_API_KEY` | absent | Enable optional image/text catalogue suggestions |
| `OPENAI_MODEL` | `gpt-4o-mini` | Structured-output vision model |
| `DEMO_PASSWORD` | `Demo@26090` | Password when explicitly seeding demo accounts |
| `ALLOW_DEMO_SEED` | absent | Must be `1` to seed under `NODE_ENV=production` |

`PUBLIC_BASE_URL` is not required; QR links use the address the visitor opened in the browser.

## Production process

```powershell
npm ci
npm run db:migrate
npm run build
$env:NODE_ENV='production'
$env:HOST='0.0.0.0'
npm run server
```

Put the Node service behind HTTPS. Persist `data/` and `uploads/`; back them up together. Set a restrictive filesystem owner and monitoring. Do not run `db:seed` for a real deployment. A container example is in `Dockerfile`; container startup still needs a migration and persistent volumes. The container build was not executed here.

## Vercel demo deployment

The linked `tantu-artisan-market` Vercel project uses a Neon Postgres resource (`DATABASE_URL`) and a public Blob store (`BLOB_READ_WRITE_TOKEN`). `vercel.json` routes the Vite client and Node API. The current public URL is [tantu-artisan-market.vercel.app](https://tantu-artisan-market.vercel.app).

After installing and authenticating the Vercel CLI, deploy a checked revision from this workspace:

```powershell
npm run deploy:vercel
```

For a new Vercel project, link the project, connect a persistent Postgres database and a public Blob store, pull its environment variables, then run the Postgres migration before deployment. Only seed the fixed demo accounts in a deliberate demo environment (`ALLOW_DEMO_SEED=1` when `NODE_ENV=production`). Keep `.env*` files out of source control. Vercel Functions cannot persist the local SQLite file or uploaded files; the hosted adapters must have their environment variables connected.

## Verification

Run `npm run check`. API integration tests use a temporary SQLite database and cover roles, publishing, passports, matching, stale edits and orders. With the connected production environment pulled to an ignored local file, `node --env-file=.env.vercel.production.local scripts/verify-hosted.js https://tantu-artisan-market.vercel.app` verifies hosted database and Blob operations, then removes its test records. Inspect the app in a desktop and mobile browser. Speech recognition support varies; typed input is the fallback.
