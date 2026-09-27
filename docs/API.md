# HTTP API

All responses are JSON. Mutations require `Content-Type: application/json`. Auth uses an HTTP-only same-site cookie. Errors return `{ "error": "..." }`. Role checks happen on the server.

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/api/health` | Public | Health |
| POST | `/api/auth/register` | Public | Buyer or artisan registration |
| POST | `/api/auth/login`, `/api/auth/logout` | Public / signed-in | Session |
| GET | `/api/session` | Public | Current account |
| GET | `/api/products`, `/api/products/:id` | Public | Published catalogue; owner can see own draft |
| POST, PUT | `/api/products`, `/api/products/:id` | Artisan | Create or versioned edit |
| GET | `/api/artisans/:id`, `/api/passports/:id` | Public | Profile and provenance record |
| POST | `/api/catalog/suggest` | Artisan | Model or local-rule catalogue suggestion |
| POST | `/api/price`, `/api/match` | Public | Cost calculation and buyer matching |
| GET, POST | `/api/requirements` | Buyer; admin reads | Saved bulk brief |
| GET, POST | `/api/enquiries` | Buyer creates; involved users read | Direct enquiry |
| PATCH | `/api/enquiries/:id` | Artisan | Mark replied/closed |
| GET, POST | `/api/orders` | Buyer creates; involved users read | Stock-checked order |
| PATCH | `/api/orders/:id` | Artisan | Update fulfilment status |
| GET | `/api/dashboard`, `/api/demand` | Artisan/admin as applicable | Workspace and demo projection |
| GET | `/api/admin` | Admin | Activity and review queue |
| PATCH | `/api/admin/passports/:id` | Admin | Mark platform record reviewed |

`POST /api/products` accepts a `client_id` for replay-safe offline sync. Image uploads are a JPEG, PNG or WebP data URL with a 3 MB decoded limit; the API stores them under `/uploads`. `PUT /api/products/:id` requires `version`; a stale version returns `409` and leaves the local queue item for review.

Example price request:

```json
{"material":1400,"labourHours":20,"labourRate":60,"packaging":150,"logistics":250,"marginPercent":20}
```

The response separates base costs, artisan margin, cost-based price, optional user-supplied market reference and rounded suggested price.
