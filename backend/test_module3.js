/**
 * Brightloop Software — Automated Test Suite: Module 3 (Subscriptions & Quotations)
 * Run with: node backend/test_module3.js
 */

const { db, initializeDatabase, checkAndExpireSubscriptions } = require('./config/database');
const {
  generateDocumentNumber,
  calculateExpiryDate,
  calculateSubscriptionDetails,
  recordSubscriptionHistory
} = require('./utils/subscriptionEngine');
const { seedAllMockData } = require('./seed_mock_data');

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failedTests++;
  }
}

async function runModule3Tests() {
  console.log('\n🧪 Running Test Suite: Brightloop Module 3 (Subscription & Quotation Management)...');

  // Ensure fresh mock database state
  await seedAllMockData();

  // --- 1. Unique Document Number Generation ---
  console.log('\n--- 1. Unique Document Number Generation ---');
  const subNum1 = generateDocumentNumber('SUB');
  const qtNum1 = generateDocumentNumber('QT');
  const currentYear = new Date().getFullYear();

  assert(subNum1.startsWith(`SUB-${currentYear}-`), `Subscription number follows SUB-${currentYear}-XXXXX format ("${subNum1}")`);
  assert(qtNum1.startsWith(`QT-${currentYear}-`), `Quotation number follows QT-${currentYear}-XXXXX format ("${qtNum1}")`);

  // --- 2. Expiry Date Calculation by Billing Frequency ---
  console.log('\n--- 2. Billing Frequency & Expiry Date Calculation ---');
  const baseDate = '2026-01-01';
  assert(calculateExpiryDate(baseDate, 'daily') === '2026-01-02', 'Daily billing adds 1 day (2026-01-01 -> 2026-01-02)');
  assert(calculateExpiryDate(baseDate, 'weekly') === '2026-01-08', 'Weekly billing adds 7 days (2026-01-01 -> 2026-01-08)');
  assert(calculateExpiryDate(baseDate, 'monthly') === '2026-02-01', 'Monthly billing adds 1 month (2026-01-01 -> 2026-02-01)');
  assert(calculateExpiryDate(baseDate, 'yearly') === '2027-01-01', 'Yearly billing adds 1 year (2026-01-01 -> 2027-01-01)');

  // --- 3. Multi-Line Subscription Calculation & Pricing Integrity ---
  console.log('\n--- 3. Multi-Line Subscription Calculation & Pricing Integrity ---');
  // Plan 3: Monthly Pro
  // Line 1: Cloud ERP (Base ₹2,400) + Odoo brand (+₹560) = ₹2,960. Qty 2 = ₹5,920
  // Line 2: Secure Guard (Base ₹750) + 5-device pack (+₹600) = ₹1,350. Qty 1 = ₹1,350
  // Gross Subtotal = ₹5,920 + ₹1,350 = ₹7,270.00
  // Discount: BRIGHT20 (20%) = -₹1,454.00
  // Taxable = ₹5,816.00
  // GST 18% = ₹1,046.88
  // Total = ₹6,862.88

  const multiCalc = calculateSubscriptionDetails({
    plan_id: 3,
    lines: [
      { product_id: 1, variant_id: 2, quantity: 2 },
      { product_id: 3, variant_id: 8, quantity: 1 }
    ],
    discount_code: 'BRIGHT20',
    start_date: '2026-10-01'
  });

  assert(multiCalc.subtotal === 7270.0, `Gross subtotal is exactly ₹7,270.00 (got ₹${multiCalc.subtotal})`);
  assert(multiCalc.discount_applied && multiCalc.discount_amount === 1454.0, `BRIGHT20 discount of 20% is ₹1,454.00 (got ₹${multiCalc.discount_amount})`);
  assert(multiCalc.taxable_amount === 5816.0, `Net taxable amount is ₹5,816.00 (got ₹${multiCalc.taxable_amount})`);
  assert(multiCalc.tax_amount === 1046.88, `GST 18% tax amount is ₹1,046.88 (got ₹${multiCalc.tax_amount})`);
  assert(multiCalc.total_amount === 6862.88, `Final payable total is ₹6,862.88 (got ₹${multiCalc.total_amount})`);

  // --- 4. Plan Minimum Purchase Quantity Enforcement ---
  console.log('\n--- 4. Plan Minimum Purchase Quantity Enforcement ---');
  // Plan 5 requires min_quantity = 3
  let minQtyErrorCaught = false;
  try {
    calculateSubscriptionDetails({
      plan_id: 5,
      lines: [{ product_id: 1, variant_id: 1, quantity: 2 }]
    });
  } catch (err) {
    minQtyErrorCaught = err.message.includes('Minimum purchase quantity');
  }
  assert(minQtyErrorCaught, 'Enforces plan minimum purchase quantity (rejected quantity 2 when min is 3)');

  // --- 5. Quotation Templates Management ---
  console.log('\n--- 5. Quotation Templates Management ---');
  const template = db.prepare('SELECT * FROM quotation_templates WHERE id = 1').get();
  assert(template !== undefined, 'Quotation template "Enterprise Starter Pack" exists');
  assert(template.default_validity_days === 30, 'Template specifies default 30 days validity');

  const templateLines = db.prepare('SELECT * FROM quotation_template_lines WHERE template_id = 1').all();
  assert(templateLines.length === 2, `Template contains 2 predefined product lines (got ${templateLines.length})`);

  // --- 6. Quotation to Subscription Conversion ---
  console.log('\n--- 6. Quotation to Subscription Conversion ---');
  // Quote 1 is Sent
  const q1 = db.prepare("SELECT * FROM quotations WHERE quotation_number = 'QT-2026-00001'").get();
  assert(q1 !== undefined, 'Quotation QT-2026-00001 exists');
  assert(q1.status === 'Sent', 'Quotation initial status is "Sent"');

  // Convert Quote 1 using internal converter simulation
  const quotationController = require('./controllers/quotationController');
  let convertResData = null;
  const mockReq = {
    params: { id: q1.id },
    body: { initial_status: 'Active' },
    user: { id: 1, role_name: 'admin' }
  };
  const mockRes = {
    status: (code) => ({
      json: (data) => { convertResData = { code, ...data }; }
    })
  };

  await quotationController.convertQuotationToSubscription(mockReq, mockRes);
  assert(convertResData && convertResData.success, 'Quotation conversion executes with HTTP 201 Created');

  // Verify updated quotation state
  const updatedQ1 = db.prepare('SELECT * FROM quotations WHERE id = ?').get(q1.id);
  assert(updatedQ1.status === 'Converted', 'Quotation status updated to "Converted"');
  assert(updatedQ1.converted_subscription_id !== null, 'Quotation points to newly created subscription ID');

  // Verify created subscription
  const createdSub = db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(updatedQ1.converted_subscription_id);
  assert(createdSub !== undefined && createdSub.status === 'Active', 'New subscription created with "Active" status');
  assert(createdSub.quotation_id === q1.id, 'Subscription references origin quotation ID');

  // Verify history record
  const subHistory = db.prepare('SELECT * FROM subscription_history WHERE subscription_id = ?').all(createdSub.id);
  assert(subHistory.length > 0, `Subscription history recorded transition events (got ${subHistory.length})`);
  assert(subHistory[0].action === 'CONVERT_FROM_QUOTATION', 'First history action is "CONVERT_FROM_QUOTATION"');

  // --- 7. Subscription Lifecycle Actions (Pause, Resume, Renew, Close) ---
  console.log('\n--- 7. Subscription Lifecycle State Machine ---');
  const subscriptionController = require('./controllers/subscriptionController');

  // Test Pause
  let pauseRes = null;
  await subscriptionController.pauseSubscription(
    { params: { id: createdSub.id }, body: { reason: 'Client requested seasonal hold' }, user: { id: 1 } },
    { json: (d) => { pauseRes = d; }, status: () => ({ json: (d) => { pauseRes = d; } }) }
  );
  assert(pauseRes && pauseRes.success, 'Subscription paused successfully (Active -> Paused)');
  const pausedSub = db.prepare('SELECT status, paused_at FROM subscriptions WHERE id = ?').get(createdSub.id);
  assert(pausedSub.status === 'Paused' && pausedSub.paused_at !== null, 'Database confirms status is "Paused" with paused_at timestamp');

  // Test Resume
  let resumeRes = null;
  await subscriptionController.resumeSubscription(
    { params: { id: createdSub.id }, user: { id: 1 } },
    { json: (d) => { resumeRes = d; }, status: () => ({ json: (d) => { resumeRes = d; } }) }
  );
  assert(resumeRes && resumeRes.success, 'Subscription resumed successfully (Paused -> Active)');
  const resumedSub = db.prepare('SELECT status FROM subscriptions WHERE id = ?').get(createdSub.id);
  assert(resumedSub.status === 'Active', 'Database confirms status returned to "Active"');

  // Test Renew
  const oldExpiry = createdSub.expiry_date;
  let renewRes = null;
  await subscriptionController.renewSubscription(
    { params: { id: createdSub.id }, user: { id: 1 } },
    { json: (d) => { renewRes = d; }, status: () => ({ json: (d) => { renewRes = d; } }) }
  );
  assert(renewRes && renewRes.success, 'Subscription renewed successfully');
  const renewedSub = db.prepare('SELECT expiry_date FROM subscriptions WHERE id = ?').get(createdSub.id);
  assert(renewedSub.expiry_date > oldExpiry, `Expiry date extended from ${oldExpiry} to ${renewedSub.expiry_date}`);

  // Test Close
  let closeRes = null;
  await subscriptionController.closeSubscription(
    { params: { id: createdSub.id }, body: { reason: 'Customer completed contract milestones' }, user: { id: 1 } },
    { json: (d) => { closeRes = d; }, status: () => ({ json: (d) => { closeRes = d; } }) }
  );
  assert(closeRes && closeRes.success, 'Subscription closed successfully (Active -> Closed)');
  const closedSub = db.prepare('SELECT status, closure_reason, closed_at FROM subscriptions WHERE id = ?').get(createdSub.id);
  assert(closedSub.status === 'Closed' && closedSub.closed_at !== null, 'Database confirms status is "Closed" with closed_at timestamp');
  assert(closedSub.closure_reason === 'Customer completed contract milestones', 'Closure reason accurately recorded');

  // --- 8. Automatic Subscription Expiry Handling ---
  console.log('\n--- 8. Automatic Subscription Expiry Handling ---');
  // Create an expired active subscription
  db.prepare(`
    INSERT INTO subscriptions (
      uuid, subscription_number, customer_id, plan_id, status,
      start_date, expiry_date, total_amount
    ) VALUES ('test-exp-sub', 'SUB-2023-EXPIRED', 8, 3, 'Active', '2023-01-01', '2023-02-01', 2500)
  `).run();

  checkAndExpireSubscriptions();
  const autoExpiredSub = db.prepare("SELECT status, closure_reason FROM subscriptions WHERE subscription_number = 'SUB-2023-EXPIRED'").get();
  assert(autoExpiredSub.status === 'Closed', 'Background check automatically closed subscription whose expiry_date passed');
  assert(autoExpiredSub.closure_reason.includes('Automatic Expiry'), 'Closure reason identifies "Automatic Expiry"');

  // --- 9. Module 4 Integration: Invoice Payload Verification ---
  console.log('\n--- 9. Module 4 Integration: Automated Invoice Payload ---');
  let invoicePayload = null;
  await subscriptionController.getInvoicePayload(
    { params: { id: 1 } },
    { json: (d) => { invoicePayload = d.data ? d.data.invoice_payload : null; }, status: () => ({ json: () => {} }) }
  );

  assert(invoicePayload !== null, 'Invoice payload generated successfully');
  assert(invoicePayload.subscription_number === 'SUB-2026-00001', 'Payload includes correct subscription_number');
  assert(invoicePayload.customer && invoicePayload.customer.email === 'customer@brightloop.com', 'Payload includes customer details');
  assert(Array.isArray(invoicePayload.items) && invoicePayload.items.length > 0, 'Payload includes detailed line items with unit price and tax');
  assert(invoicePayload.dates && invoicePayload.dates.due_date !== undefined, 'Payload computes automated due_date based on payment terms');
  assert(invoicePayload.summary && invoicePayload.summary.total_amount > 0, 'Payload summary includes subtotal, tax, and grand total');

  console.log('\n=======================================');
  console.log(`Results: ${passedTests} passed, ${failedTests} failed.`);
  console.log('=======================================\n');

  if (failedTests > 0) process.exit(1);
}

runModule3Tests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
