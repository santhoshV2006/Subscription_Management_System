const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH 
  ? path.resolve(__dirname, '..', process.env.DB_PATH)
  : path.join(__dirname, '..', 'data', 'brightloop.db');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

// Enable WAL mode for better concurrent performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password TEXT NOT NULL,
      role_id INTEGER NOT NULL DEFAULT 3,
      is_active INTEGER NOT NULL DEFAULT 1,
      email_verified INTEGER NOT NULL DEFAULT 0,
      reset_token TEXT,
      reset_token_expires DATETIME,
      last_login DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (role_id) REFERENCES roles(id)
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      details TEXT,
      ip_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    /* ─── MODULE 2: Product, Plans, Variants, Taxes & Discounts ─────────── */

    CREATE TABLE IF NOT EXISTS taxes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE COLLATE NOCASE,
      rate REAL NOT NULL DEFAULT 0.0,
      tax_type TEXT NOT NULL DEFAULT 'percentage' CHECK(tax_type IN ('percentage', 'fixed')),
      description TEXT,
      is_compound INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      product_type TEXT NOT NULL DEFAULT 'service',
      sales_price REAL NOT NULL DEFAULT 0.0,
      cost_price REAL NOT NULL DEFAULT 0.0,
      notes TEXT,
      tax_id INTEGER,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tax_id) REFERENCES taxes(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS product_variants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      product_id INTEGER NOT NULL,
      attribute_name TEXT NOT NULL DEFAULT 'Brand',
      variant_name TEXT NOT NULL,
      sku TEXT,
      additional_price REAL NOT NULL DEFAULT 0.0,
      cost_price_extra REAL NOT NULL DEFAULT 0.0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS subscription_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      product_id INTEGER,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE COLLATE NOCASE,
      description TEXT,
      billing_frequency TEXT NOT NULL CHECK(billing_frequency IN ('daily', 'weekly', 'monthly', 'yearly')),
      price REAL NOT NULL DEFAULT 0.0,
      min_quantity INTEGER NOT NULL DEFAULT 1,
      start_date DATE,
      end_date DATE,
      is_auto_close_on_expiry INTEGER NOT NULL DEFAULT 1,
      allow_early_closure INTEGER NOT NULL DEFAULT 1,
      allow_pause INTEGER NOT NULL DEFAULT 1,
      allow_renewal INTEGER NOT NULL DEFAULT 1,
      trial_days INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'expired', 'archived')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS discounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE COLLATE NOCASE,
      discount_type TEXT NOT NULL CHECK(discount_type IN ('percentage', 'fixed')),
      value REAL NOT NULL DEFAULT 0.0,
      min_purchase_amount REAL NOT NULL DEFAULT 0.0,
      min_quantity INTEGER NOT NULL DEFAULT 1,
      start_date DATE,
      end_date DATE,
      max_usage_limit INTEGER DEFAULT NULL,
      used_count INTEGER NOT NULL DEFAULT 0,
      applies_to TEXT NOT NULL DEFAULT 'all' CHECK(applies_to IN ('all', 'product', 'plan')),
      target_product_id INTEGER,
      target_plan_id INTEGER,
      is_auto_apply INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (target_product_id) REFERENCES products(id) ON DELETE SET NULL,
      FOREIGN KEY (target_plan_id) REFERENCES subscription_plans(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS discount_usages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      discount_id INTEGER NOT NULL,
      user_id INTEGER,
      invoice_ref TEXT,
      discount_amount REAL NOT NULL,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (discount_id) REFERENCES discounts(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );
  `);

  // Seed default roles if they don't exist
  const roleCount = db.prepare('SELECT COUNT(*) as count FROM roles').get();
  if (roleCount.count === 0) {
    const insertRole = db.prepare('INSERT INTO roles (name, description) VALUES (?, ?)');
    insertRole.run('admin', 'Full system access - can manage all users, subscriptions, and settings');
    insertRole.run('staff', 'Limited access to daily business operations');
    insertRole.run('customer', 'Can view and manage own subscriptions and invoices');
    console.log('✅ Default roles seeded');
  }

  // Run initial auto-closure check on expired plans
  checkAndCloseExpiredPlans();
}

/**
 * Automatically close subscription plans that have passed their availability end date
 * and have is_auto_close_on_expiry enabled.
 */
function checkAndCloseExpiredPlans() {
  try {
    const nowIso = new Date().toISOString().split('T')[0];
    const stmt = db.prepare(`
      SELECT id, name, end_date
      FROM subscription_plans
      WHERE status = 'active'
        AND is_auto_close_on_expiry = 1
        AND end_date IS NOT NULL
        AND date(end_date) < date(?)
    `);
    const expiredPlans = stmt.all(nowIso);

    if (expiredPlans.length > 0) {
      const updateStmt = db.prepare(`
        UPDATE subscription_plans
        SET status = 'expired', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      const logStmt = db.prepare(`
        INSERT INTO activity_logs (action, details)
        VALUES ('PLAN_EXPIRED_AUTO_CLOSE', ?)
      `);

      for (const plan of expiredPlans) {
        updateStmt.run(plan.id);
        logStmt.run(`Plan '${plan.name}' (ID: ${plan.id}) automatically closed as availability expired on ${plan.end_date}`);
      }
      console.log(`ℹ️ Auto-closed ${expiredPlans.length} expired subscription plan(s).`);
    }
  } catch (err) {
    console.error('Error during automatic plan expiry check:', err);
  }
}

module.exports = { db, initializeDatabase, checkAndCloseExpiredPlans };
