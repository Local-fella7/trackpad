export const migrations = [
  `
    CREATE TABLE users (
      id INTEGER PRIMARY KEY,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      recovery_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE statuses (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE,
      color TEXT NOT NULL DEFAULT '#64748b',
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_default INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      exclude_from_totals INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE records (
      id INTEGER PRIMARY KEY,
      record_date TEXT NOT NULL,
      record_number TEXT,
      client_name TEXT NOT NULL,
      contacts TEXT,
      location TEXT,
      source_of_info TEXT,
      proforma_no TEXT,
      invoice_no TEXT,
      event_date TEXT,
      order_form_no TEXT,
      delivery_form_no TEXT,
      status_id INTEGER NOT NULL REFERENCES statuses(id),
      currency TEXT NOT NULL DEFAULT 'TZS',
      tax_rate_bp INTEGER NOT NULL DEFAULT 0,
      subtotal_minor INTEGER NOT NULL DEFAULT 0,
      tax_minor INTEGER NOT NULL DEFAULT 0,
      grand_total_minor INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
    );
    CREATE TABLE record_items (
      id INTEGER PRIMARY KEY,
      record_id INTEGER NOT NULL REFERENCES records(id) ON DELETE CASCADE,
      line_no INTEGER NOT NULL,
      description TEXT NOT NULL,
      quantity_x100 INTEGER NOT NULL DEFAULT 100,
      unit_price_minor INTEGER NOT NULL DEFAULT 0,
      line_total_minor INTEGER NOT NULL DEFAULT 0,
      UNIQUE(record_id, line_no)
    );
    CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE proof_runs (id INTEGER PRIMARY KEY, created_at TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE TABLE audit_log (
      id INTEGER PRIMARY KEY,
      at TEXT NOT NULL DEFAULT (datetime('now')),
      user_id INTEGER REFERENCES users(id),
      action TEXT NOT NULL,
      entity TEXT NOT NULL,
      entity_id INTEGER,
      details TEXT
    );
    CREATE INDEX idx_records_date ON records(record_date) WHERE deleted_at IS NULL;
    CREATE INDEX idx_records_status ON records(status_id);
    CREATE INDEX idx_records_client ON records(client_name COLLATE NOCASE);
    CREATE INDEX idx_records_event ON records(event_date);
    CREATE INDEX idx_records_invoice ON records(invoice_no);
    CREATE INDEX idx_records_proforma ON records(proforma_no);
    CREATE INDEX idx_items_record ON record_items(record_id);
    INSERT INTO statuses (name, color, sort_order, is_default, exclude_from_totals) VALUES
      ('Pending', '#d97706', 1, 1, 0), ('Confirmed', '#0ea5e9', 2, 0, 0),
      ('Proforma Sent', '#8b5cf6', 3, 0, 0), ('Invoiced', '#6366f1', 4, 0, 0),
      ('Paid', '#16a34a', 5, 0, 0), ('Delivered', '#0d9488', 6, 0, 0),
      ('Cancelled', '#dc2626', 7, 0, 1);
    INSERT INTO settings (key, value) VALUES
      ('currency', 'TZS'), ('tax_rate_bp', '0'), ('language', 'en'), ('autolock_minutes', '0');
  `,
  `
    ALTER TABLE records ADD COLUMN confirmed_at TEXT;
    ALTER TABLE records ADD COLUMN paid_at TEXT;
    ALTER TABLE records ADD COLUMN delivered_at TEXT;
    UPDATE records SET confirmed_at = updated_at WHERE status_id IN (SELECT id FROM statuses WHERE name IN ('Confirmed','Paid','Delivered'));
    UPDATE records SET paid_at = updated_at WHERE status_id IN (SELECT id FROM statuses WHERE name IN ('Paid','Delivered'));
    UPDATE records SET delivered_at = updated_at WHERE status_id IN (SELECT id FROM statuses WHERE name = 'Delivered');
    CREATE INDEX idx_records_paid ON records(paid_at);
    CREATE INDEX idx_records_delivery_ready ON records(confirmed_at, delivered_at, event_date);
  `,
]
