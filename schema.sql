-- Merchants table
CREATE TABLE IF NOT EXISTS merchants (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  domain TEXT NOT NULL,
  category TEXT,
  logo_url TEXT,
  affiliate_network TEXT,
  is_active BOOLEAN DEFAULT 1,
  last_scraped_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Vouchers table
CREATE TABLE IF NOT EXISTS vouchers (
  id INTEGER PRIMARY KEY,
  merchant_id INTEGER NOT NULL,
  code TEXT UNIQUE,
  description TEXT NOT NULL,
  discount_type TEXT, -- 'percentage', 'fixed', 'free-shipping', 'bogo'
  discount_value TEXT,
  min_spend TEXT,
  expiry_date DATE,
  is_active BOOLEAN DEFAULT 1,
  source_url TEXT,
  source TEXT, -- 'merchant', 'affiliate', 'scrape'
  scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (merchant_id) REFERENCES merchants(id)
);

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL
);

-- Merchant category mapping
CREATE TABLE IF NOT EXISTS merchant_categories (
  merchant_id INTEGER NOT NULL,
  category_id INTEGER NOT NULL,
  PRIMARY KEY (merchant_id, category_id),
  FOREIGN KEY (merchant_id) REFERENCES merchants(id),
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- Search/discovery index
CREATE INDEX idx_vouchers_merchant ON vouchers(merchant_id);
CREATE INDEX idx_vouchers_active ON vouchers(is_active, expiry_date);
CREATE INDEX idx_vouchers_code ON vouchers(code);
CREATE INDEX idx_merchants_active ON merchants(is_active);
CREATE INDEX idx_merchants_domain ON merchants(domain);
