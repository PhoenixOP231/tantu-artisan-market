# Tantu · SIH 26090 judge pitch

**Problem.** Indian artisans often need to translate a photo and their own spoken knowledge into a sellable catalogue, explain a sustainable price and reach buyers who can place meaningful orders. Connectivity and language add friction.

**Gap.** A conventional listing form or marketplace does not make cost reasoning, provenance and bulk production capacity visible to both sides.

**Solution.** Tantu lets artisans photograph and describe a piece, review catalogue suggestions, calculate a cost-based price and publish a QR-linked craft passport. Buyers submit a plain-language bulk brief and see makers ranked by capacity, cost and timing, with reasons. Offline drafts protect work during network loss.

**Innovation with restraint.** Models assist in interpreting photos and language when configured. Deterministic engines handle money, matching constraints and transparent demo demand estimates. The product states which claims are artisan-declared and which data is synthetic.

**Architecture.** React PWA, Node HTTP API, SQLite and local photo storage for a portable one-machine demo. Optional OpenAI Responses API can be enabled without changing core flows.

**Social impact.** A maker can speak in Marathi, Hindi or English, explain the value of labour and show a buyer the person and place behind a product. Matching emphasizes production feasibility over keyword popularity.

**Scalability and sustainability.** The pilot uses low infrastructure and can replace SQLite and local media when usage warrants it. Pricing includes an artisan margin. Demand guidance needs verified sales before real economic decisions.

**Live sequence.** Artisan photo and Marathi description → reviewed catalogue → fair price → published QR passport → buyer brief for 100 jute bags → explainable match and enquiry → synthetic demand dashboard → offline save and reconnect sync.

**Next evidence.** Validate catalogue accuracy with artisans, run usability tests on low-end phones, acquire trusted provenance partners and measure actual fulfilment outcomes.
