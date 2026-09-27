PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('artisan','buyer','admin')),
  language TEXT NOT NULL DEFAULT 'en', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS artisans (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  craft TEXT NOT NULL, region TEXT NOT NULL, story TEXT NOT NULL DEFAULT '',
  experience_years INTEGER NOT NULL DEFAULT 0, capacity INTEGER NOT NULL DEFAULT 20,
  lead_days INTEGER NOT NULL DEFAULT 14, customisation INTEGER NOT NULL DEFAULT 0,
  verified INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY, artisan_id TEXT NOT NULL REFERENCES artisans(user_id),
  client_id TEXT UNIQUE, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL, craft TEXT NOT NULL, material TEXT NOT NULL DEFAULT '',
  colors TEXT NOT NULL DEFAULT '', technique TEXT NOT NULL DEFAULT '',
  region TEXT NOT NULL DEFAULT '', care TEXT NOT NULL DEFAULT '', story TEXT NOT NULL DEFAULT '',
  image TEXT NOT NULL DEFAULT '', price INTEGER NOT NULL DEFAULT 0 CHECK(price >= 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK(stock >= 0), capacity INTEGER NOT NULL DEFAULT 20,
  lead_days INTEGER NOT NULL DEFAULT 14, status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published')),
  price_breakdown TEXT NOT NULL DEFAULT '{}', version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS products_market ON products(status, category, created_at);
CREATE TABLE IF NOT EXISTS passports (
  certificate_id TEXT PRIMARY KEY, product_id TEXT NOT NULL UNIQUE REFERENCES products(id) ON DELETE CASCADE,
  review_status TEXT NOT NULL DEFAULT 'artisan_declared' CHECK(review_status IN ('artisan_declared','reviewed')),
  issued_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, reviewed_by TEXT REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS requirements (
  id TEXT PRIMARY KEY, buyer_id TEXT NOT NULL REFERENCES users(id), text TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '', material TEXT NOT NULL DEFAULT '',
  quantity INTEGER NOT NULL, budget INTEGER NOT NULL DEFAULT 0,
  location TEXT NOT NULL DEFAULT '', deadline TEXT NOT NULL DEFAULT '',
  customisation INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS enquiries (
  id TEXT PRIMARY KEY, buyer_id TEXT NOT NULL REFERENCES users(id),
  artisan_id TEXT NOT NULL REFERENCES artisans(user_id),
  product_id TEXT REFERENCES products(id), requirement_id TEXT REFERENCES requirements(id),
  message TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','replied','closed')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY, buyer_id TEXT NOT NULL REFERENCES users(id),
  product_id TEXT NOT NULL REFERENCES products(id), quantity INTEGER NOT NULL CHECK(quantity > 0),
  unit_price INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'placed' CHECK(status IN ('placed','accepted','shipped','completed')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sales_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT, category TEXT NOT NULL, month TEXT NOT NULL,
  units INTEGER NOT NULL, synthetic INTEGER NOT NULL DEFAULT 1,
  UNIQUE(category, month)
);
