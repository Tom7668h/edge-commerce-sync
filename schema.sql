-- Schema for Edge-First E-Commerce Catalog & Price Intelligence Hub
-- Compatible with Cloudflare D1 (SQLite) and local SQLite3

CREATE TABLE IF NOT EXISTS catalog_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sku VARCHAR(64) NOT NULL UNIQUE,
    ean VARCHAR(13),
    title VARCHAR(255) NOT NULL,
    raw_brand VARCHAR(100) NOT NULL,
    mapped_brand VARCHAR(100) NOT NULL,
    category VARCHAR(100) NOT NULL,
    purchase_price DECIMAL(10, 2) NOT NULL,
    selling_price DECIMAL(10, 2) NOT NULL,
    margin_percentage DECIMAL(5, 2) NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    supplier_name VARCHAR(100) NOT NULL,
    last_imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_catalog_sku ON catalog_items(sku);
CREATE INDEX IF NOT EXISTS idx_catalog_brand ON catalog_items(mapped_brand);
CREATE INDEX IF NOT EXISTS idx_catalog_category ON catalog_items(category);

CREATE TABLE IF NOT EXISTS brand_mappings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    raw_pattern VARCHAR(100) NOT NULL UNIQUE,
    target_brand VARCHAR(100) NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    priority INTEGER NOT NULL DEFAULT 10
);

CREATE TABLE IF NOT EXISTS price_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category VARCHAR(100),
    min_purchase_price DECIMAL(10, 2) NOT NULL,
    max_purchase_price DECIMAL(10, 2) NOT NULL,
    margin_percentage DECIMAL(5, 2) NOT NULL,
    handling_fee DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    rounding_mode VARCHAR(20) NOT NULL DEFAULT 'PSYCHOLOGICAL_99'
);

CREATE TABLE IF NOT EXISTS price_audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sku VARCHAR(64) NOT NULL,
    old_purchase_price DECIMAL(10, 2),
    new_purchase_price DECIMAL(10, 2) NOT NULL,
    old_selling_price DECIMAL(10, 2),
    new_selling_price DECIMAL(10, 2) NOT NULL,
    price_delta_percentage DECIMAL(5, 2) NOT NULL,
    applied_rule_id INTEGER,
    change_reason VARCHAR(255) NOT NULL,
    logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sku) REFERENCES catalog_items(sku)
);

CREATE INDEX IF NOT EXISTS idx_audit_sku ON price_audit_logs(sku);
CREATE INDEX IF NOT EXISTS idx_audit_date ON price_audit_logs(logged_at);

CREATE TABLE IF NOT EXISTS import_jobs (
    id VARCHAR(64) PRIMARY KEY,
    source_type VARCHAR(20) NOT NULL,
    total_records INTEGER NOT NULL DEFAULT 0,
    processed_records INTEGER NOT NULL DEFAULT 0,
    failed_records INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL,
    duration_ms INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
