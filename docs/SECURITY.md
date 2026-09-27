# Security and trust boundaries

- Passwords use salted `scrypt` hashes. Session tokens are random 256-bit values; only token hashes are stored in the selected database. Cookies are HTTP-only and same-site, with `Secure` in production.
- The API enforces roles and ownership for products, orders, enquiries, requirements and admin review. UI role checks are only presentation.
- JSON is required for mutations. Cross-origin JSON requests have no permissive CORS policy; browser form CSRF cannot submit the accepted content type. Add an explicit CSRF token if future integrations require cross-origin credentials.
- Sign-in has a per-IP in-memory attempt cap. Production deployments should use a shared rate limiter and reverse-proxy IP controls.
- Photo uploads are limited to JPEG, PNG or WebP, checked against file signatures and limited to 3 MB decoded. They receive random filenames and are stored locally or in the public Blob store. Published photos are public.
- Product creates use client IDs for idempotency; edits check versions. Orders reserve stock in a database transaction.
- Offline queue items are scoped to the account that created them before display or sync. IndexedDB drafts and the cached profile are still readable to someone with access to the same browser profile; use a dedicated browser profile on shared devices until local encryption and device access controls are added.
- If the server is unreachable during sign-out, the UI removes the local account immediately and records a pending server sign-out. The next online event or app load retries session revocation. A shared device should stay under the artisan's control until that retry completes.
- The optional OpenAI request keeps its API key server-side. Uploaded image and notes are sent only when the key is configured; the request uses `store: false`. Read the provider's data policies before enabling it for real artisans.
- A craft passport documents an artisan's claim. Admin “reviewed” means a platform record was reviewed, not that origin, material or craftsmanship was independently certified. Demo IDs are marked `TANTU-DEMO-*`.

The implementation is a hackathon prototype. Before production: add password reset and email verification, formal artisan evidence workflow, stronger account recovery, shared rate limiting, upload malware/content scanning, monitoring, database backups, TLS and deployment-specific security review.
