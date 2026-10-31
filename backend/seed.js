/**
 * Seed script to create an initial admin user.
 * Run with: npm run seed
 */
require('dotenv').config();

const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { db, initializeDatabase } = require('./config/database');

async function seed() {
  try {
    initializeDatabase();

    const adminEmail = 'admin@brightloop.com';
    const adminPassword = 'Admin@123!';

    // Always seed Module 2 Data
    seedModule2Data();

    // Check if admin already exists
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail);
    if (existing) {
      console.log('⚠️  Admin user already exists. Database is up to date.');
      return;
    }

    // Get admin role
    const adminRole = db.prepare("SELECT id FROM roles WHERE name = 'admin'").get();

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(adminPassword, salt);

    // Create admin user
    db.prepare(`
      INSERT INTO users (uuid, name, email, password, role_id, is_active, email_verified)
      VALUES (?, ?, ?, ?, ?, 1, 1)
    `).run(uuidv4(), 'System Admin', adminEmail, hashedPassword, adminRole.id);

    // Seed Module 2 Data
    seedModule2Data();

    console.log('✅ Admin user created successfully!');
    console.log('   Email:    admin@brightloop.com');
    console.log('   Password: Admin@123!');
    console.log('\n⚠️  Please change this password after first login.\n');
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
}

function seedModule2Data() {
  console.log('🌱 Seeding Module 2: Products, Variants, Plans, Taxes & Discounts...');

  // 1. Taxes
  const taxCount = db.prepare('SELECT COUNT(*) as count FROM taxes').get().count;
  let gst18Id, gst5Id, zeroTaxId;

  if (taxCount === 0) {
    const insertTax = db.prepare(`
      INSERT INTO taxes (uuid, name, code, rate, tax_type, description, is_compound, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const t1 = insertTax.run(uuidv4(), 'GST 18%', 'GST18', 18.0, 'percentage', 'Standard Indian Goods & Services Tax (9% CGST + 9% SGST)', 0, 1);
    const t2 = insertTax.run(uuidv4(), 'GST 5%', 'GST5', 5.0, 'percentage', 'Concessional GST rate for essential digital services', 0, 1);
    const t3 = insertTax.run(uuidv4(), 'Zero Tax / SEZ 0%', 'ZERO0', 0.0, 'percentage', 'Zero-rated supply for SEZ units and exports', 0, 1);

    gst18Id = t1.lastInsertRowid;
    gst5Id = t2.lastInsertRowid;
    zeroTaxId = t3.lastInsertRowid;
    console.log('   ✓ Seeded taxes (GST 18%, GST 5%, Zero Tax)');
  } else {
    const tax = db.prepare("SELECT id FROM taxes WHERE code = 'GST18'").get();
    gst18Id = tax ? tax.id : 1;
  }

  // 2. Products & Variants
  const productCount = db.prepare('SELECT COUNT(*) as count FROM products').get().count;
  let erpId, crmId, serverId;

  if (productCount === 0) {
    const insertProduct = db.prepare(`
      INSERT INTO products (uuid, name, product_type, sales_price, cost_price, notes, tax_id, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertVariant = db.prepare(`
      INSERT INTO product_variants (uuid, product_id, attribute_name, variant_name, sku, additional_price, cost_price_extra, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Product 1: Cloud ERP Suite (Base sales price ₹2400)
    const p1 = insertProduct.run(
      uuidv4(),
      'Cloud ERP Suite',
      'software',
      2400.0,
      800.0,
      'Integrated enterprise suite covering financials, supply chain, CRM, and HR.',
      gst18Id,
      1
    );
    erpId = p1.lastInsertRowid;

    // Variants for Cloud ERP Suite - Notice Odoo brand adds ₹560 as requested!
    insertVariant.run(uuidv4(), erpId, 'Brand', 'Odoo Edition', 'ERP-ODOO-560', 560.0, 150.0, 1);
    insertVariant.run(uuidv4(), erpId, 'Brand', 'SAP Business One', 'ERP-SAP-1250', 1250.0, 400.0, 1);
    insertVariant.run(uuidv4(), erpId, 'Brand', 'Zoho Enterprise', 'ERP-ZOHO-350', 350.0, 90.0, 1);
    insertVariant.run(uuidv4(), erpId, 'Brand', 'Brightloop Native', 'ERP-NATIVE-0', 0.0, 0.0, 1);

    // Product 2: BrightCRM Pro
    const p2 = insertProduct.run(
      uuidv4(),
      'BrightCRM Pro',
      'service',
      1500.0,
      450.0,
      'Lead scoring, pipeline management, automated drip campaigns and deal closure.',
      gst18Id,
      1
    );
    crmId = p2.lastInsertRowid;

    insertVariant.run(uuidv4(), crmId, 'Edition', 'Standard Edition', 'CRM-STD-0', 0.0, 0.0, 1);
    insertVariant.run(uuidv4(), crmId, 'Edition', 'Enterprise Tier', 'CRM-ENT-750', 750.0, 200.0, 1);

    // Product 3: Dedicated High-Performance Server
    const p3 = insertProduct.run(
      uuidv4(),
      'Dedicated Cloud Server',
      'goods',
      4999.0,
      2100.0,
      'Managed compute instance with 32GB RAM, 8 vCPUs, and NVMe tier-1 storage.',
      gst18Id,
      1
    );
    serverId = p3.lastInsertRowid;

    insertVariant.run(uuidv4(), serverId, 'Region', 'Asia-Pacific (Mumbai)', 'SRV-IN-0', 0.0, 0.0, 1);
    insertVariant.run(uuidv4(), serverId, 'Region', 'US-East (N. Virginia)', 'SRV-US-400', 400.0, 120.0, 1);
    insertVariant.run(uuidv4(), serverId, 'Region', 'Europe (Frankfurt)', 'SRV-EU-500', 500.0, 150.0, 1);

    // Product 4: API & Webhooks Expansion Pack
    insertProduct.run(
      uuidv4(),
      'API Integration Expansion Pack',
      'consumable',
      499.0,
      50.0,
      '100,000 API calls per month for external system integrations and zapier triggers.',
      gst18Id,
      1
    );

    console.log('   ✓ Seeded products and brand variants (including Odoo brand +₹560)');
  } else {
    const erp = db.prepare("SELECT id FROM products WHERE name LIKE '%ERP%'").get();
    erpId = erp ? erp.id : 1;
    const crm = db.prepare("SELECT id FROM products WHERE name LIKE '%CRM%'").get();
    crmId = crm ? crm.id : 2;
  }

  // 3. Subscription Plans (daily, weekly, monthly, yearly)
  const planCount = db.prepare('SELECT COUNT(*) as count FROM subscription_plans').get().count;
  let annualPlanId;

  if (planCount === 0) {
    const insertPlan = db.prepare(`
      INSERT INTO subscription_plans (
        uuid, product_id, name, code, description, billing_frequency, price,
        min_quantity, start_date, end_date, is_auto_close_on_expiry,
        allow_early_closure, allow_pause, allow_renewal, trial_days, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Daily plan
    insertPlan.run(
      uuidv4(),
      erpId,
      'ERP Daily Agile Pass',
      'PLAN-ERP-DAILY',
      'Short-term daily flexible access for sprint consultants and auditors.',
      'daily',
      120.0,
      1,
      '2024-01-01',
      '2028-12-31',
      1,
      1, // allow_early_closure
      0, // allow_pause
      1, // allow_renewal
      0,
      'active'
    );

    // Weekly plan
    insertPlan.run(
      uuidv4(),
      crmId,
      'CRM Weekly Sprint Plan',
      'PLAN-CRM-WEEKLY',
      'Weekly recurring subscription for dynamic sales campaign teams.',
      'weekly',
      450.0,
      1,
      '2024-01-01',
      '2028-12-31',
      1,
      1,
      1,
      1,
      3,
      'active'
    );

    // Monthly plan - Standard
    insertPlan.run(
      uuidv4(),
      erpId,
      'Cloud ERP Monthly Business',
      'PLAN-ERP-MONTHLY',
      'Our most popular monthly recurring plan with continuous updates and support.',
      'monthly',
      2400.0,
      1,
      '2024-01-01',
      '2028-12-31',
      1,
      1,
      1,
      1,
      14,
      'active'
    );

    // Monthly Team plan with min_quantity = 3
    insertPlan.run(
      uuidv4(),
      erpId,
      'Cloud ERP Team License (Min 3 Users)',
      'PLAN-ERP-TEAM',
      'Discounted unit price for teams requiring 3 or more licenses.',
      'monthly',
      2100.0,
      3, // min_quantity = 3
      '2024-01-01',
      '2028-12-31',
      1,
      1,
      1,
      1,
      7,
      'active'
    );

    // Yearly plan
    const annualRes = insertPlan.run(
      uuidv4(),
      erpId,
      'Cloud ERP Annual Enterprise (2 Months Free)',
      'PLAN-ERP-YEARLY',
      'Yearly billing package with substantial savings and VIP 24/7 SLA.',
      'yearly',
      24000.0,
      1,
      '2024-01-01',
      '2028-12-31',
      1,
      0, // early closure not allowed on annual commit
      1, // allow pause
      1, // allow renewal
      30,
      'active'
    );
    annualPlanId = annualRes.lastInsertRowid;

    // Expired plan to demonstrate automatic closure on expiry
    insertPlan.run(
      uuidv4(),
      erpId,
      'Legacy 2023 Early Access Plan',
      'PLAN-LEGACY-2023',
      'Promotional introductory package expired at the close of 2023.',
      'monthly',
      999.0,
      1,
      '2023-01-01',
      '2023-12-31',
      1,
      1,
      0,
      0,
      0,
      'expired'
    );

    console.log('   ✓ Seeded subscription plans (Daily, Weekly, Monthly, Yearly)');
  } else {
    const annual = db.prepare("SELECT id FROM subscription_plans WHERE billing_frequency = 'yearly'").get();
    annualPlanId = annual ? annual.id : 1;
  }

  // 4. Discounts (Fixed, Percentage, Conditions, Auto-apply, Expiry limits)
  const discountCount = db.prepare('SELECT COUNT(*) as count FROM discounts').get().count;

  if (discountCount === 0) {
    const insertDiscount = db.prepare(`
      INSERT INTO discounts (
        uuid, name, code, discount_type, value, min_purchase_amount, min_quantity,
        start_date, end_date, max_usage_limit, used_count, applies_to,
        target_product_id, target_plan_id, is_auto_apply, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // 1. Percentage discount: 20% off on purchase >= ₹1000
    insertDiscount.run(
      uuidv4(),
      'Brightloop Launch 20% Off',
      'BRIGHT20',
      'percentage',
      20.0,
      1000.0,
      1,
      '2024-01-01',
      '2028-12-31',
      100,
      3,
      'all',
      null,
      null,
      0,
      1
    );

    // 2. Fixed amount discount: ₹500 off on purchase >= ₹2500
    insertDiscount.run(
      uuidv4(),
      'Flat ₹500 Discount Voucher',
      'FLAT500',
      'fixed',
      500.0,
      2500.0,
      1,
      '2024-01-01',
      '2028-12-31',
      50,
      12,
      'all',
      null,
      null,
      0,
      1
    );

    // 3. Product-specific discount: 15% off specifically on Cloud ERP Suite (min qty 2)
    insertDiscount.run(
      uuidv4(),
      'ERP Multi-seat 15% Savings',
      'ERPSPECIAL',
      'percentage',
      15.0,
      2000.0,
      2,
      '2024-01-01',
      '2028-12-31',
      200,
      8,
      'product',
      erpId,
      null,
      0,
      1
    );

    // 4. Plan-specific discount: Flat ₹2000 on Annual commitment
    insertDiscount.run(
      uuidv4(),
      'Annual Commitment Booster ₹2,000 Off',
      'ANNUALBOOST',
      'fixed',
      2000.0,
      15000.0,
      1,
      '2024-01-01',
      '2028-12-31',
      30,
      5,
      'plan',
      null,
      annualPlanId,
      0,
      1
    );

    // 5. Automatic invoice discount: 5% off automatically applied
    insertDiscount.run(
      uuidv4(),
      'Automatic Platform Privilege 5%',
      'AUTOSAVE5',
      'percentage',
      5.0,
      500.0,
      1,
      '2024-01-01',
      '2028-12-31',
      1000,
      42,
      'all',
      null,
      null,
      1, // is_auto_apply = 1 (automatically applied!)
      1
    );

    // 6. Expired discount rule (to demonstrate stop when expired)
    insertDiscount.run(
      uuidv4(),
      'Diwali 2023 Mega Offer',
      'DIWALI2023',
      'percentage',
      30.0,
      1000.0,
      1,
      '2023-10-01',
      '2023-11-30',
      100,
      100,
      'all',
      null,
      null,
      0,
      1
    );

    // 7. Maxed-out limit discount rule (used_count >= max_usage_limit)
    insertDiscount.run(
      uuidv4(),
      'Limited Flash 50% Off (Maxed Out)',
      'FLASH50',
      'percentage',
      50.0,
      1000.0,
      1,
      '2024-01-01',
      '2028-12-31',
      10, // max 10
      10, // 10 used
      'all',
      null,
      null,
      0,
      1
    );

    console.log('   ✓ Seeded discounts (Fixed, Percentage, Auto-apply, Expired & Limit-reached)');
  }

  console.log('🎉 Module 2 seeding completed successfully!');
}

seed();
