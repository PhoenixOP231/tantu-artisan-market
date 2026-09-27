# Tantu · Artisan market linkage and smart cataloguing

Tantu is a runnable SIH 26090 demonstration for Indian artisans and buyers. An artisan can use a photo and spoken or typed notes to prepare a listing, inspect an explainable price, publish a QR-linked craft passport, receive enquiries and orders, and save changes during connectivity loss. Buyers can search products and match a bulk brief to makers using visible business constraints.

The demo is deliberately honest: provenance starts **artisan-declared**, demand charts use **synthetic data**, price and matching are **deterministic**, and speech availability depends on the browser. With `OPENAI_API_KEY`, catalogue suggestions can use image and text understanding; without a key, local craft rules keep the flow usable.

## Quick start

Requires Node.js 24 or newer and npm.

```powershell
npm ci
npm run db:migrate
npm run db:seed
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). The API runs on port 3001 through Vite's proxy. `npm run build` followed by `npm run server` serves the production build at [http://127.0.0.1:3001](http://127.0.0.1:3001).

Demo accounts use password `Demo@26090`:

| Role | Email |
| --- | --- |
| Artisan | `savita@tantu.demo` |
| Buyer | `buyer@tantu.demo` |
| Admin | `admin@tantu.demo` |

The sign-in screen also has one-click demo buttons. These accounts are seeded only by the explicit `db:seed` command. Do not seed them in a real deployment.

## What works

- React marketplace, product pages, artisan profiles, search and category filters.
- Artisan registration, role-based workspaces, catalogue management, stock, orders and enquiries.
- Photo upload with gentle in-browser exposure/contrast adjustment and a before/after choice.
- Marathi, Hindi and English speech input where the browser supports Web Speech; typed input always works.
- Catalogue fields from local craft rules, with an optional OpenAI Responses API image/text provider.
- Cost-based pricing with labour, materials, packaging, logistics, overhead, artisan margin and an optional user-supplied market reference.
- Public QR craft passports that show maker, material, technique, origin and review status.
- Buyer brief parsing, scored matching with reasons and capacity gaps, saved requirements and enquiries.
- Synthetic demand projections with method and data-quality labels.
- Installable PWA shell, cached public pages, IndexedDB draft queue, retry and version conflicts.
- Admin activity and passport record review.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | API and Vite development client |
| `npm run db:migrate` | Create/update the configured SQLite or Postgres schema |
| `npm run db:seed` | Add demo data and accounts |
| `npm test` | Pricing, matching, catalogue, auth and API integration tests |
| `npm run build` | Production React build |
| `npm run server` | API and built client on port 3001 |
| `npm run check` | Tests and production build |
| `npm run deploy:vercel` | Check and deploy to the linked Vercel project |

## Configuration

Copy `.env.example` to `.env` if you need different ports, database path or an optional AI provider. Node loads `.env` through `--env-file-if-exists`. Never put real secrets in source control. Locally, the default SQLite file is `data/tantu.db` and product uploads are in `uploads/`. Setting `DATABASE_URL` selects Postgres; setting `USE_BLOB_STORAGE=1` uses Vercel Blob for photos.

`OPENAI_API_KEY` and `OPENAI_MODEL` are optional. When the key is set, the artisan's notes and newly uploaded photo are sent to the [OpenAI Responses API](https://developers.openai.com/api/docs/guides/images-vision) for structured catalogue suggestions. The default `gpt-4o-mini` supports image inputs and structured outputs. This provider path was coded against official documentation but was not exercised without a key. The application falls back to local rules on missing credentials, API errors and timeouts.

## Architecture

React/Vite client → Node HTTP API → SQLite and local photos during local development, or Postgres and Vercel Blob when hosted. The client uses native IndexedDB and a service worker for offline drafts and cached public content. The API uses password hashing through `scrypt`, signed-in sessions and role checks. A configured model only suggests catalogue fields; it does not set prices, certify origin or make buyer commitments.

See [architecture](docs/ARCHITECTURE.md), [AI decisions](docs/AI_ARCHITECTURE.md), [schema](docs/DATABASE_SCHEMA.md), [API](docs/API.md), [offline sync](docs/OFFLINE_SYNC.md), [security](docs/SECURITY.md), [setup](docs/SETUP.md), [demo script](docs/DEMO_SCRIPT.md), [features](docs/FEATURES.md), [future scope](docs/FUTURE_SCOPE.md), [judge pitch](docs/SIH_JUDGE_PITCH.md), and [image assets](docs/ASSETS.md).

## Deployment

The [live SIH demo](https://tantu-artisan-market.vercel.app) runs on Vercel Functions with Neon Postgres and Vercel Blob. It uses the explicit demo seed and should hold demo data only. The linked project can be updated with `npm run deploy:vercel` after the Vercel CLI is installed and authenticated. For a self-hosted single process, keep persistent volumes for `data/` and `uploads/`, run migrations before startup, and use the included `Dockerfile` as a starting point. See [setup](docs/SETUP.md).

## Limits

The current photo editor adjusts exposure/contrast; it does not remove backgrounds or perform generative editing. Browser speech recognition may depend on connectivity and browser support. The optional model path needs your own API key and a real integration test. Demand data is synthetic. No payment gateway, shipping integration, external government certificate check or independent authenticity audit is implemented. Admin review only checks the platform record. The deployed site is a public demo, not a production marketplace for real customer data.
