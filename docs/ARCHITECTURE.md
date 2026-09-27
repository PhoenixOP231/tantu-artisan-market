# Architecture

```mermaid
flowchart LR
  A[Artisan and buyer browser] --> B[React PWA]
  B --> C[Node HTTP API]
  B --> D[IndexedDB draft queue]
  B --> E[Service worker cache]
  C --> F[(SQLite local / Neon Postgres hosted)]
  C --> G[Local photos / Vercel Blob]
  C -. Optional catalogue request .-> H[OpenAI Responses API]
```

Development runs Vite on 5173 with an API proxy to a Node server on 3001. SQLite WAL mode and local uploads keep the app runnable on one machine. On Vercel, the built client is static, the Node API runs as a Function, and Neon Postgres and Vercel Blob keep records and photos persistent. The optional model is confined to catalogue suggestions.

## End-to-end product flow

```mermaid
flowchart LR
  Photo --> Enhance[Gentle local enhancement]
  Notes[Voice or typed notes] --> Suggest[Model or local-rule suggestion]
  Enhance --> Review[Artisan reviews fields]
  Suggest --> Review
  Review --> Price[Cost-based price]
  Price --> Publish
  Publish --> Passport[Artisan-declared passport]
  Passport --> QR[Public QR page]
```

## Roles

The API checks each action server-side. Artisans can edit only their own products and see their own orders/enquiries. Buyers can place stock-checked orders, save briefs and send enquiries. Admins can inspect platform activity and mark a passport record reviewed. Public users can browse published products and passports.

## Folder map

| Path | Contents |
| --- | --- |
| `src/` | React pages, shared UI, offline queue, PWA registration |
| `server/` | HTTP API, schema, seed data, deterministic engines, optional AI adapter, tests |
| `public/images/` | Local demo craft photography |
| `public/sw.js` | Service worker cache |
| `data/` | SQLite file created at runtime |
| `uploads/` | Validated artisan photos created at runtime |
| `docs/` | Product and engineering documentation |

## Buyer matching

```mermaid
flowchart LR
  Brief --> Parse[Parse quantity and craft]
  Parse --> Constraints[Category, capacity, budget, lead time, material, location]
  Constraints --> Rank[Weighted transparent score]
  Rank --> Reasons[Fit reasons and gaps]
  Reasons --> Enquiry[Buyer enquiry]
```

Scores guide discovery; the maker and buyer confirm actual availability and terms directly.
