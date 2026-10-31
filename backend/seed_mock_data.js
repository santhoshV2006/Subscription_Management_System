/**
 * Brightloop Software — Comprehensive Mock Data Seeder
 * Populates realistic data across Module 1 (Users & Roles), Module 2 (Catalog & Pricing),
 * and Module 3 (Subscriptions, Quotations, Templates, Lines, and Lifecycle History).
 *
 * Run with: node backend/seed_mock_data.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config();

const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { db, initializeDatabase } = require('./config/database');
const { calculateSubscriptionDetails, recordSubscriptionHistory } = require('./utils/subscriptionEngine');

async function seedAllMockData() {
  console.log('\n🚀 ═══════════════════════════════════════════════════════════════');
  console.log('   Brightloop Software — Seeding Entire Project with Mock Data');
  console.log('═════════════════════════════════════════════════════════════════\n');

  try {
    initializeDatabase();

    // ─────────────────────────────────────────────────────────────────────────
    // 1. ROLES & USERS (Module 1)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('👥 Seeding Module 1: Roles and Users...');

    const adminRole = db.prepare("SELECT id FROM roles WHERE name = 'admin'").get();
    const staffRole = db.prepare("SELECT id FROM roles WHERE name = 'staff'").get();
    const customerRole = db.prepare("SELECT id FROM roles WHERE name = 'customer'").get();

    const salt = await bcrypt.genSalt(10);
    const adminPassHash = await bcrypt.hash('Admin@123!', salt);
    const staffPassHash = await bcrypt.hash('Staff@123!', salt);
    const custPassHash = await bcrypt.hash('Customer@123!', salt);

    const insertUser = db.prepare(`
      INSERT OR REPLACE INTO users (id, uuid, name, email, password, role_id, is_active, email_verified, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, 1, CURRENT_TIMESTAMP)
    `);

    // Ensure fixed IDs for predictable seeding
    // 1: Admin, 2-4: Staff, 5-8: Customers
    insertUser.run(1, uuidv4(), 'System Administrator', 'admin@brightloop.com', adminPassHash, adminRole.id);
    insertUser.run(2, uuidv4(), 'Rahul Sharma (Senior Ops)', 'staff@brightloop.com', staffPassHash, staffRole.id);
    insertUser.run(3, uuidv4(), 'Vikram Malhotra (Account Exec)', 'vikram.staff@brightloop.com', staffPassHash, staffRole.id);
    insertUser.run(4, uuidv4(), 'Priya Nambiar (Client Support)', 'priya.staff@brightloop.com', staffPassHash, staffRole.id);

    insertUser.run(5, uuidv4(), 'Acme Industrial Corp', 'acme.corp@example.com', custPassHash, customerRole.id);
    insertUser.run(6, uuidv4(), 'Nexus Cloud Innovations', 'nexustech@example.com', custPassHash, customerRole.id);
    insertUser.run(7, uuidv4(), 'Zenith Hypermarkets Ltd', 'zenith.retail@example.com', custPassHash, customerRole.id);
    insertUser.run(8, uuidv4(), 'Demo Customer', 'customer@brightloop.com', custPassHash, customerRole.id);

    console.log('   ✓ Seeded 1 Admin, 3 Staff members, and 4 Customers');

    // ─────────────────────────────────────────────────────────────────────────
    // 2. TAXES, PRODUCTS, VARIANTS, PLANS & DISCOUNTS (Module 2)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('📦 Seeding Module 2: Catalog, Pricing & Taxes...');

    // Taxes
    db.prepare('DELETE FROM taxes').run();
    const insertTax = db.prepare(`
      INSERT INTO taxes (id, uuid, name, code, rate, tax_type, description, is_compound, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);
    insertTax.run(1, uuidv4(), 'GST 18%', 'GST18', 18.0, 'percentage', 'Standard 18% GST for digital SaaS and cloud services', 0);
    insertTax.run(2, uuidv4(), 'GST 5%', 'GST5', 5.0, 'percentage', 'Concessional 5% rate for essential educational services', 0);
    insertTax.run(3, uuidv4(), 'Zero Tax / SEZ 0%', 'ZERO0', 0.0, 'percentage', 'Zero-rated supply for exports and SEZ units', 0);

    // Products
    db.prepare('DELETE FROM products').run();
    db.prepare('DELETE FROM product_variants').run();

    const insertProd = db.prepare(`
      INSERT INTO products (id, uuid, name, product_type, sales_price, cost_price, notes, tax_id, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);

    insertProd.run(1, uuidv4(), 'Cloud ERP Suite', 'service', 2400.0, 950.0, 'Full cloud ERP with inventory, finance and payroll', 1);
    insertProd.run(2, uuidv4(), 'Bright Analytics Pro', 'service', 1800.0, 600.0, 'BI dashboards and automated forecasting', 1);
    insertProd.run(3, uuidv4(), 'Secure Guard Anti-Malware', 'service', 750.0, 250.0, 'Enterprise endpoint telemetry and firewall protection', 1);
    insertProd.run(4, uuidv4(), 'CRM Omnichannel Desk', 'service', 1200.0, 450.0, 'Unified WhatsApp, Email and Live Chat CRM', 1);

    // Product Variants (e.g. Odoo Edition +₹560 as requested in prompt)
    const insertVariant = db.prepare(`
      INSERT INTO product_variants (id, uuid, product_id, attribute_name, variant_name, sku, additional_price, cost_price_extra, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);
    // Variants for Cloud ERP Suite
    insertVariant.run(1, uuidv4(), 1, 'Brand', 'Standard Community Edition', 'ERP-STD', 0.0, 0.0);
    insertVariant.run(2, uuidv4(), 1, 'Brand', 'Odoo Enterprise Edition', 'ERP-ODOO-560', 560.0, 200.0);
    insertVariant.run(3, uuidv4(), 1, 'Brand', 'SAP Connected Suite', 'ERP-SAP-PLUS', 1200.0, 400.0);

    // Variants for Analytics Pro
    insertVariant.run(4, uuidv4(), 2, 'Tier', 'Silver Tier (5GB)', 'BI-SILVER', 0.0, 0.0);
    insertVariant.run(5, uuidv4(), 2, 'Tier', 'Gold Tier (50GB)', 'BI-GOLD', 450.0, 150.0);
    insertVariant.run(6, uuidv4(), 2, 'Tier', 'Platinum Dedicated Engine', 'BI-PLATINUM', 900.0, 300.0);

    // Variants for Secure Guard
    insertVariant.run(7, uuidv4(), 3, 'Pack', 'Single Endpoint License', 'SEC-1', 0.0, 0.0);
    insertVariant.run(8, uuidv4(), 3, 'Pack', 'Multi-Device 5 Endpoint Bundle', 'SEC-5', 600.0, 200.0);

    // Variants for CRM
    insertVariant.run(9, uuidv4(), 4, 'Engine', 'Standard Desk', 'CRM-BASE', 0.0, 0.0);
    insertVariant.run(10, uuidv4(), 4, 'Engine', 'AI Agent Co-Pilot Edition', 'CRM-AI', 350.0, 120.0);

    console.log('   ✓ Seeded 4 Products and 10 Variants (including Odoo Brand +₹560)');

    // Subscription Plans
    db.prepare('DELETE FROM subscription_plans').run();
    const insertPlan = db.prepare(`
      INSERT INTO subscription_plans (
        id, uuid, product_id, name, code, description, billing_frequency,
        price, min_quantity, start_date, end_date, is_auto_close_on_expiry,
        allow_early_closure, allow_pause, allow_renewal, trial_days, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertPlan.run(1, uuidv4(), 1, 'Daily Cloud Sandbox', 'DAILY-SBX', 'On-demand daily cloud sandbox for testing and quick drills', 'daily', 250.0, 1, '2024-01-01', '2030-12-31', 1, 1, 0, 1, 0, 'active');
    insertPlan.run(2, uuidv4(), 1, 'Weekly Sprint Server', 'WEEKLY-SPRINT', 'Weekly billing license for Agile project duration', 'weekly', 1200.0, 1, '2024-01-01', '2030-12-31', 1, 1, 1, 1, 0, 'active');
    insertPlan.run(3, uuidv4(), 1, 'Monthly Professional SaaS', 'MONTHLY-PRO', 'Standard monthly billing plan with full feature support', 'monthly', 2400.0, 1, '2024-01-01', '2030-12-31', 1, 1, 1, 1, 14, 'active');
    insertPlan.run(4, uuidv4(), 1, 'Annual Enterprise Cloud', 'ANNUAL-ENT', 'Annual commitment with 20% built-in value and dedicated SLA', 'yearly', 24000.0, 1, '2024-01-01', '2030-12-31', 1, 0, 1, 1, 30, 'active');
    insertPlan.run(5, uuidv4(), 1, 'Cloud ERP Team License (Min 3 Users)', 'TEAM-MIN3', 'Special team multi-seat license requiring minimum 3 seats', 'monthly', 6500.0, 3, '2024-01-01', '2030-12-31', 1, 1, 1, 1, 7, 'active');

    console.log('   ✓ Seeded 5 Subscription Plans (Daily, Weekly, Monthly, Yearly, Team Multi-seat)');

    // Discounts
    db.prepare('DELETE FROM discounts').run();
    db.prepare('DELETE FROM discount_usages').run();
    const insertDiscount = db.prepare(`
      INSERT INTO discounts (
        id, uuid, name, code, discount_type, value, min_purchase_amount,
        min_quantity, start_date, end_date, max_usage_limit, used_count,
        applies_to, target_product_id, target_plan_id, is_auto_apply, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);

    insertDiscount.run(1, uuidv4(), 'Spring Promo 20% Off', 'BRIGHT20', 'percentage', 20.0, 1000.0, 1, '2024-01-01', '2028-12-31', 500, 24, 'all', null, null, 0);
    insertDiscount.run(2, uuidv4(), 'Flat ₹500 Customer Welcome', 'FLAT500', 'fixed', 500.0, 2500.0, 1, '2024-01-01', '2028-12-31', 200, 48, 'all', null, null, 0);
    insertDiscount.run(3, uuidv4(), 'ERP Multi-seat 15% Savings', 'ERPSPECIAL', 'percentage', 15.0, 2000.0, 2, '2024-01-01', '2028-12-31', 100, 12, 'product', 1, null, 0);
    insertDiscount.run(4, uuidv4(), 'Annual Booster ₹2000 Off', 'ANNUALBOOST', 'fixed', 2000.0, 15000.0, 1, '2024-01-01', '2028-12-31', 50, 7, 'plan', null, 4, 0);
    insertDiscount.run(5, uuidv4(), 'Platform Privilege 5%', 'AUTOSAVE5', 'percentage', 5.0, 500.0, 1, '2024-01-01', '2028-12-31', 1000, 68, 'all', null, null, 1);
    insertDiscount.run(6, uuidv4(), 'Diwali 2023 Mega Offer (Expired)', 'DIWALI2023', 'percentage', 30.0, 1000.0, 1, '2023-10-01', '2023-11-30', 100, 100, 'all', null, null, 0);
    insertDiscount.run(7, uuidv4(), 'Flash 50% Off (Max Limit Reached)', 'FLASH50', 'percentage', 50.0, 1000.0, 1, '2024-01-01', '2028-12-31', 10, 10, 'all', null, null, 0);

    console.log('   ✓ Seeded 7 Discount Rules');

    // ─────────────────────────────────────────────────────────────────────────
    // 3. QUOTATION TEMPLATES (Module 3)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('📋 Seeding Module 3: Quotation Templates...');

    db.prepare('DELETE FROM quotation_template_lines').run();
    db.prepare('DELETE FROM quotation_templates').run();

    const insertTemplate = db.prepare(`
      INSERT INTO quotation_templates (id, uuid, name, description, plan_id, default_validity_days, payment_terms, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `);
    const insertTemplateLine = db.prepare(`
      INSERT INTO quotation_template_lines (template_id, product_id, variant_id, quantity, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `);

    // Template 1: Starter Pack
    insertTemplate.run(1, uuidv4(), 'Enterprise Starter Pack', 'Essential bundle for mid-sized teams: ERP with Odoo brand plus endpoint security', 3, 30, 'Net 30');
    insertTemplateLine.run(1, 1, 2, 2, 0); // 2 units of Cloud ERP (Odoo Edition)
    insertTemplateLine.run(1, 3, 8, 1, 1); // 1 unit of Secure Guard (5-device pack)

    // Template 2: Analytics & ERP Annual Cloud
    insertTemplate.run(2, uuidv4(), 'Annual Business Intelligence Bundle', 'High-performance reporting engine and ERP for data-driven companies', 4, 45, 'Net 60');
    insertTemplateLine.run(2, 1, 3, 5, 0); // 5 units of Cloud ERP (SAP Connected)
    insertTemplateLine.run(2, 2, 6, 2, 1); // 2 units of Analytics Pro (Platinum)

    // Template 3: SME Omnichannel Fast-Track
    insertTemplate.run(3, uuidv4(), 'SME Omnichannel Fast-Track', 'Customer engagement stack with AI co-pilot', 3, 15, 'Net 15');
    insertTemplateLine.run(3, 4, 10, 3, 0); // 3 units of CRM (AI Co-pilot)

    console.log('   ✓ Seeded 3 Reusable Quotation Templates');

    // ─────────────────────────────────────────────────────────────────────────
    // 4. QUOTATIONS (Module 3)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('📄 Seeding Module 3: Quotations...');

    db.prepare('DELETE FROM quotation_lines').run();
    db.prepare('DELETE FROM quotations').run();

    const insertQuote = db.prepare(`
      INSERT INTO quotations (
        id, uuid, quotation_number, template_id, customer_id, plan_id,
        status, validity_days, issue_date, valid_until, payment_terms,
        subtotal, discount_id, discount_code, discount_amount,
        tax_amount, total_amount, notes, converted_subscription_id, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertQuoteLine = db.prepare(`
      INSERT INTO quotation_lines (
        quotation_id, product_id, variant_id, product_name, variant_name,
        quantity, base_unit_price, variant_additional_price, unit_price,
        gross_amount, tax_id, tax_rate, tax_amount, line_total
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Quote 1: Sent to Acme Industrial Corp
    const q1Calc = calculateSubscriptionDetails({
      plan_id: 3,
      lines: [
        { product_id: 1, variant_id: 2, quantity: 2 }, // Odoo (+560) -> 2960 * 2 = 5920
        { product_id: 3, variant_id: 8, quantity: 1 }  // Secure Guard (+600) -> 1350 * 1 = 1350
      ],
      discount_code: 'BRIGHT20',
      start_date: '2026-10-15'
    });

    insertQuote.run(
      1,
      uuidv4(),
      'QT-2026-00001',
      1,
      5, // Acme Corp
      3,
      'Sent',
      30,
      '2026-10-15',
      '2026-11-14',
      'Net 30',
      q1Calc.subtotal,
      q1Calc.discount_id,
      q1Calc.discount_code,
      q1Calc.discount_amount,
      q1Calc.tax_amount,
      q1Calc.total_amount,
      'Quotation delivered to Acme procurement team for evaluation.',
      null,
      2 // Rahul Staff
    );
    for (const l of q1Calc.lines) {
      insertQuoteLine.run(1, l.product_id, l.variant_id, l.product_name, l.variant_name, l.quantity, l.base_unit_price, l.variant_additional_price, l.unit_price, l.gross_amount, l.tax_id, l.tax_rate, l.tax_amount, l.line_total);
    }

    // Quote 2: Accepted by Nexus Cloud Innovations
    const q2Calc = calculateSubscriptionDetails({
      plan_id: 4,
      lines: [
        { product_id: 1, variant_id: 3, quantity: 3 }, // 3 units ERP SAP Plus
        { product_id: 2, variant_id: 6, quantity: 2 }  // 2 units BI Platinum
      ],
      discount_code: null,
      start_date: '2026-10-20'
    });

    insertQuote.run(
      2,
      uuidv4(),
      'QT-2026-00002',
      2,
      6, // Nexus Tech
      4,
      'Accepted',
      45,
      '2026-10-20',
      '2026-12-04',
      'Net 60',
      q2Calc.subtotal,
      q2Calc.discount_id,
      q2Calc.discount_code,
      q2Calc.discount_amount,
      q2Calc.tax_amount,
      q2Calc.total_amount,
      'Quotation accepted by Nexus CIO. Pending contract activation.',
      null,
      3 // Vikram Staff
    );
    for (const l of q2Calc.lines) {
      insertQuoteLine.run(2, l.product_id, l.variant_id, l.product_name, l.variant_name, l.quantity, l.base_unit_price, l.variant_additional_price, l.unit_price, l.gross_amount, l.tax_id, l.tax_rate, l.tax_amount, l.line_total);
    }

    // Quote 3: Converted to Subscription for Demo Customer
    const q3Calc = calculateSubscriptionDetails({
      plan_id: 3,
      lines: [
        { product_id: 1, variant_id: 2, quantity: 1 } // Odoo Edition (2400 + 560 = 2960)
      ],
      discount_code: 'FLAT500',
      start_date: '2026-10-01'
    });

    insertQuote.run(
      3,
      uuidv4(),
      'QT-2026-00003',
      null,
      8, // Demo Customer
      3,
      'Converted',
      30,
      '2026-10-01',
      '2026-10-31',
      'Net 30',
      q3Calc.subtotal,
      q3Calc.discount_id,
      q3Calc.discount_code,
      q3Calc.discount_amount,
      q3Calc.tax_amount,
      q3Calc.total_amount,
      'Successfully converted into active subscription SUB-2026-00001.',
      1, // Linked to Subscription 1
      1 // Admin
    );
    for (const l of q3Calc.lines) {
      insertQuoteLine.run(3, l.product_id, l.variant_id, l.product_name, l.variant_name, l.quantity, l.base_unit_price, l.variant_additional_price, l.unit_price, l.gross_amount, l.tax_id, l.tax_rate, l.tax_amount, l.line_total);
    }

    console.log('   ✓ Seeded 3 Quotations (Sent, Accepted, Converted)');

    // ─────────────────────────────────────────────────────────────────────────
    // 5. SUBSCRIPTIONS & LIFECYCLE (Module 3)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('🔄 Seeding Module 3: Subscriptions and Lifecycle History...');

    db.prepare('DELETE FROM subscription_history').run();
    db.prepare('DELETE FROM subscription_lines').run();
    db.prepare('DELETE FROM subscriptions').run();

    const insertSub = db.prepare(`
      INSERT INTO subscriptions (
        id, uuid, subscription_number, customer_id, plan_id, status,
        start_date, expiry_date, payment_terms, subtotal,
        discount_id, discount_code, discount_amount, tax_amount, total_amount,
        currency, notes, quotation_id, closed_at, closure_reason, paused_at, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'INR', ?, ?, ?, ?, ?, ?)
    `);

    const insertSubLine = db.prepare(`
      INSERT INTO subscription_lines (
        id, uuid, subscription_id, product_id, variant_id, product_name, variant_name,
        quantity, base_unit_price, variant_additional_price, unit_price,
        gross_amount, tax_id, tax_rate, tax_amount, line_total
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Sub 1: Active (Converted from QT-2026-00003 for Demo Customer)
    // Product: Cloud ERP Suite + Odoo brand (+₹560)
    insertSub.run(
      1,
      uuidv4(),
      'SUB-2026-00001',
      8, // Demo Customer
      3, // Monthly Pro
      'Active',
      '2026-10-01',
      '2026-11-01',
      'Net 30',
      q3Calc.subtotal,
      q3Calc.discount_id,
      q3Calc.discount_code,
      q3Calc.discount_amount,
      q3Calc.tax_amount,
      q3Calc.total_amount,
      'Primary ERP production instance with Odoo Brand configuration.',
      3,
      null, null, null,
      1
    );
    let lineId = 1;
    for (const l of q3Calc.lines) {
      insertSubLine.run(lineId++, uuidv4(), 1, l.product_id, l.variant_id, l.product_name, l.variant_name, l.quantity, l.base_unit_price, l.variant_additional_price, l.unit_price, l.gross_amount, l.tax_id, l.tax_rate, l.tax_amount, l.line_total);
    }

    recordSubscriptionHistory(1, { action: 'CONVERT_FROM_QUOTATION', from_status: 'Quotation', to_status: 'Draft', changed_by: 1, notes: 'Converted from Quotation QT-2026-00003' });
    recordSubscriptionHistory(1, { action: 'CONFIRM', from_status: 'Draft', to_status: 'Confirmed', changed_by: 1, notes: 'Verified payment agreement' });
    recordSubscriptionHistory(1, { action: 'ACTIVATE', from_status: 'Confirmed', to_status: 'Active', changed_by: 1, notes: 'Provisioned cloud ERP instance' });

    // Sub 2: Active Annual Enterprise (Acme Industrial Corp)
    const s2Calc = calculateSubscriptionDetails({
      plan_id: 4, // Annual
      lines: [
        { product_id: 1, variant_id: 3, quantity: 4 }, // 4 seats ERP SAP (+1200)
        { product_id: 2, variant_id: 5, quantity: 2 }, // 2 seats Analytics Gold (+450)
        { product_id: 3, variant_id: 8, quantity: 2 }  // 2 packs Security (+600)
      ],
      discount_code: 'ANNUALBOOST',
      start_date: '2026-09-01'
    });

    insertSub.run(
      2,
      uuidv4(),
      'SUB-2026-00002',
      5, // Acme Corp
      4, // Annual Plan
      'Active',
      '2026-09-01',
      '2027-09-01',
      'Net 60',
      s2Calc.subtotal,
      s2Calc.discount_id,
      s2Calc.discount_code,
      s2Calc.discount_amount,
      s2Calc.tax_amount,
      s2Calc.total_amount,
      'Annual enterprise cluster for manufacturing operations.',
      null,
      null, null, null,
      2
    );
    for (const l of s2Calc.lines) {
      insertSubLine.run(lineId++, uuidv4(), 2, l.product_id, l.variant_id, l.product_name, l.variant_name, l.quantity, l.base_unit_price, l.variant_additional_price, l.unit_price, l.gross_amount, l.tax_id, l.tax_rate, l.tax_amount, l.line_total);
    }
    recordSubscriptionHistory(2, { action: 'CREATE', from_status: null, to_status: 'Active', changed_by: 2, notes: 'Direct onboarding of Acme Industrial Corp' });

    // Sub 3: Paused (Nexus Cloud Innovations)
    const s3Calc = calculateSubscriptionDetails({
      plan_id: 3,
      lines: [
        { product_id: 2, variant_id: 6, quantity: 1 }, // Analytics Platinum (+900)
        { product_id: 4, variant_id: 10, quantity: 2 }  // CRM AI (+350)
      ],
      discount_code: null,
      start_date: '2026-08-15'
    });

    insertSub.run(
      3,
      uuidv4(),
      'SUB-2026-00003',
      6, // Nexus Tech
      3,
      'Paused',
      '2026-08-15',
      '2026-11-15',
      'Net 30',
      s3Calc.subtotal,
      s3Calc.discount_id,
      s3Calc.discount_code,
      s3Calc.discount_amount,
      s3Calc.tax_amount,
      s3Calc.total_amount,
      'Temporary maintenance pause requested during cloud server migration.',
      null,
      null, null, '2026-10-25 14:00:00',
      3
    );
    for (const l of s3Calc.lines) {
      insertSubLine.run(lineId++, uuidv4(), 3, l.product_id, l.variant_id, l.product_name, l.variant_name, l.quantity, l.base_unit_price, l.variant_additional_price, l.unit_price, l.gross_amount, l.tax_id, l.tax_rate, l.tax_amount, l.line_total);
    }
    recordSubscriptionHistory(3, { action: 'CREATE', from_status: null, to_status: 'Active', changed_by: 3, notes: 'Subscription started' });
    recordSubscriptionHistory(3, { action: 'PAUSE', from_status: 'Active', to_status: 'Paused', changed_by: 3, notes: 'Temporary pause requested for cloud server migration' });

    // Sub 4: Closed (Zenith Hypermarkets Ltd)
    const s4Calc = calculateSubscriptionDetails({
      plan_id: 3,
      lines: [
        { product_id: 4, variant_id: 9, quantity: 1 } // CRM Base
      ],
      discount_code: null,
      start_date: '2026-06-01'
    });

    insertSub.run(
      4,
      uuidv4(),
      'SUB-2026-00004',
      7, // Zenith Retail
      3,
      'Closed',
      '2026-06-01',
      '2026-07-01',
      'Net 15',
      s4Calc.subtotal,
      s4Calc.discount_id,
      s4Calc.discount_code,
      s4Calc.discount_amount,
      s4Calc.tax_amount,
      s4Calc.total_amount,
      'Project completed successfully. Early closure requested.',
      null,
      '2026-06-28 10:30:00', 'Early closure requested after pilot completion', null,
      2
    );
    for (const l of s4Calc.lines) {
      insertSubLine.run(lineId++, uuidv4(), 4, l.product_id, l.variant_id, l.product_name, l.variant_name, l.quantity, l.base_unit_price, l.variant_additional_price, l.unit_price, l.gross_amount, l.tax_id, l.tax_rate, l.tax_amount, l.line_total);
    }
    recordSubscriptionHistory(4, { action: 'CREATE', from_status: null, to_status: 'Active', changed_by: 2, notes: 'Pilot started' });
    recordSubscriptionHistory(4, { action: 'EARLY_CLOSURE', from_status: 'Active', to_status: 'Closed', changed_by: 2, notes: 'Pilot finished ahead of schedule' });

    // Sub 5: Confirmed (Demo Customer)
    const s5Calc = calculateSubscriptionDetails({
      plan_id: 5, // Team plan (min 3 seats)
      lines: [
        { product_id: 1, variant_id: 2, quantity: 3 } // 3 seats of ERP Odoo (+560)
      ],
      discount_code: 'ERPSPECIAL',
      start_date: '2026-11-01'
    });

    insertSub.run(
      5,
      uuidv4(),
      'SUB-2026-00005',
      8, // Demo Customer
      5, // Team plan
      'Confirmed',
      '2026-11-01',
      '2026-12-01',
      'Net 30',
      s5Calc.subtotal,
      s5Calc.discount_id,
      s5Calc.discount_code,
      s5Calc.discount_amount,
      s5Calc.tax_amount,
      s5Calc.total_amount,
      'Team multi-seat rollout starting in November.',
      null,
      null, null, null,
      1
    );
    for (const l of s5Calc.lines) {
      insertSubLine.run(lineId++, uuidv4(), 5, l.product_id, l.variant_id, l.product_name, l.variant_name, l.quantity, l.base_unit_price, l.variant_additional_price, l.unit_price, l.gross_amount, l.tax_id, l.tax_rate, l.tax_amount, l.line_total);
    }
    recordSubscriptionHistory(5, { action: 'CREATE', from_status: null, to_status: 'Draft', changed_by: 1, notes: 'Drafted team subscription' });
    recordSubscriptionHistory(5, { action: 'CONFIRM', from_status: 'Draft', to_status: 'Confirmed', changed_by: 1, notes: 'Customer confirmed purchase order' });

    console.log('   ✓ Seeded 5 Subscriptions across Active, Paused, Closed & Confirmed states with audit history');

    console.log('\n🎉 ═══════════════════════════════════════════════════════════════');
    console.log('   MOCK DATA SEEDING COMPLETE!');
    console.log('   - 8 Users (Admin, 3 Staff, 4 Customers)');
    console.log('   - 4 Products, 10 Variants (incl. Odoo Brand +₹560)');
    console.log('   - 5 Plans, 3 Taxes, 7 Discounts');
    console.log('   - 3 Reusable Quotation Templates');
    console.log('   - 3 Quotations (Sent, Accepted, Converted)');
    console.log('   - 5 Subscriptions with multi-line items and full history');
    console.log('═════════════════════════════════════════════════════════════════\n');
  } catch (error) {
    console.error('❌ Seeding error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  seedAllMockData();
}

module.exports = { seedAllMockData };
