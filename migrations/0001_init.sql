-- 0001_init: the whole first schema.
-- RULE: never edit a migration after it has shipped. Every later change is a new
-- file (0002_..., 0003_...), backward compatible: add columns, do not drop them.
--
-- Additions to SISTEM_SPESIFIKASIYASI.md §4 (all optional, with defaults):
--   translations  JSON {"ru":{"name":"..."},"en":{...}} for shops that show
--                 RU/EN content; empty = main-language text is shown.
--   search_text   lower-cased, Azerbaijani-normalised name/sku/attributes,
--                 written by the API (SQLite LIKE only folds ASCII case).
--   sold_count    for sort=popular without scanning order_items.
--   product_variants.old_price / sort_order, rate_limits table.
-- Money is always an INTEGER in qəpik (1250 = 12.50 ₼).

-- 4.1 settings (key → value; JSON or plain text)
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Only structural values here. Shop defaults (name, colours, ...) live in the
-- Worker code, so a missing key always falls back and old shops keep working.
INSERT INTO settings (key, value) VALUES
  ('app.schema', '1'),
  ('setup.completed', 'false');

-- 4.2 admin (exactly one row) and sessions
CREATE TABLE admin (
  id            INTEGER PRIMARY KEY CHECK (id = 1),
  password_hash TEXT NOT NULL,
  salt          TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE sessions (
  token      TEXT PRIMARY KEY,   -- stored as SHA-256 of the cookie value
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

-- Fixed-window counters for order spam and login brute force.
-- key e.g. 'order:<ip-hash>', 'login:<ip-hash>'; window_end = unix seconds.
CREATE TABLE rate_limits (
  key        TEXT PRIMARY KEY,
  count      INTEGER NOT NULL DEFAULT 0,
  window_end INTEGER NOT NULL
);

-- 4.3 categories (nested)
CREATE TABLE categories (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_id    INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  name         TEXT NOT NULL,
  slug         TEXT NOT NULL UNIQUE,
  image        TEXT,
  sort_order   INTEGER DEFAULT 0,
  is_active    INTEGER DEFAULT 1,
  translations TEXT
);
CREATE INDEX idx_categories_parent ON categories(parent_id, sort_order);

-- 4.4 attributes (dynamic, defined by the owner)
CREATE TABLE attributes (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT NOT NULL,
  key          TEXT NOT NULL UNIQUE,
  type         TEXT NOT NULL CHECK (type IN ('text', 'number', 'select', 'multiselect', 'color', 'boolean')),
  options      TEXT,                -- JSON array for select/multiselect/color
  unit         TEXT,
  filterable   INTEGER DEFAULT 0,
  is_variant   INTEGER DEFAULT 0,
  category_ids TEXT,                -- JSON array, empty/NULL = all categories
  sort_order   INTEGER DEFAULT 0,
  translations TEXT
);

-- 4.5 products
CREATE TABLE products (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id  INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  name         TEXT NOT NULL,
  slug         TEXT NOT NULL UNIQUE,
  description  TEXT,
  price        INTEGER NOT NULL,
  old_price    INTEGER,
  stock        INTEGER,             -- NULL = stock not tracked
  sku          TEXT,
  images       TEXT,                -- JSON array of R2 keys, first is the main image
  attributes   TEXT,                -- JSON {"material":"pambıq"}
  is_active    INTEGER DEFAULT 1,
  is_featured  INTEGER DEFAULT 0,
  sort_order   INTEGER DEFAULT 0,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  translations TEXT,
  search_text  TEXT NOT NULL DEFAULT '',
  sold_count   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_products_category ON products(category_id, is_active);
CREATE INDEX idx_products_featured ON products(is_featured, is_active);
CREATE INDEX idx_products_created ON products(is_active, created_at);
CREATE INDEX idx_products_price ON products(is_active, price);

-- 4.6 product_variants (optional per product)
CREATE TABLE product_variants (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  options    TEXT NOT NULL,         -- JSON {"size":"M","color":"Qırmızı"}
  price      INTEGER,               -- NULL = product price
  old_price  INTEGER,
  stock      INTEGER,               -- NULL = stock not tracked
  sku        TEXT,
  image      TEXT,
  sort_order INTEGER DEFAULT 0
);
CREATE INDEX idx_variants_product ON product_variants(product_id, sort_order);

-- 4.7 orders and order_items
CREATE TABLE orders (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number   TEXT NOT NULL UNIQUE,
  customer_name  TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_data  TEXT,
  total          INTEGER NOT NULL,
  status         TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'confirmed', 'shipped', 'completed', 'cancelled')),
  admin_note     TEXT,
  notified       INTEGER DEFAULT 0,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  lang           TEXT
);
CREATE INDEX idx_orders_status ON orders(status, created_at);
CREATE INDEX idx_orders_created ON orders(created_at);

CREATE TABLE order_items (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id     INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id   INTEGER,             -- kept even if the product is deleted
  variant_id   INTEGER,
  product_name TEXT NOT NULL,
  variant_text TEXT,
  price        INTEGER NOT NULL,
  quantity     INTEGER NOT NULL
);
CREATE INDEX idx_order_items_order ON order_items(order_id);

-- 4.8 pages
CREATE TABLE pages (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  slug         TEXT NOT NULL UNIQUE,
  title        TEXT NOT NULL,
  content      TEXT,
  is_active    INTEGER DEFAULT 1,
  show_in_menu INTEGER DEFAULT 0,
  sort_order   INTEGER DEFAULT 0,
  translations TEXT,
  updated_at   TEXT
);
