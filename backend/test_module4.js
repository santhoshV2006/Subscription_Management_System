/**
 * Test Suite for Module 4 Feature 1: Invoice Management
 * Tests database schema, unique sequential invoice numbering,
 * automated invoice generation from Module 3 subscription payload,
 * full field storage integrity, CRUD operations, lifecycle state transitions,
 * duplicate prevention, draft modification guards, and role scoping.
 *
 * Run with: node backend/test_module4.js
 */

const { db, initializeDatabase } = require('./config/database');
const { seedAllMockData } = require('./seed_mock_data');
const { generateDocumentNumber } = require('./utils/subscriptionEngine');
const invoiceController = require('./controllers/invoiceController');

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, detail = '') {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${testName} ${detail ? '(' + detail + ')' : ''}`);
    failedTests++;
  }
}

async function runTests() {
  console.log('\n🧪 Running Test Suite: Brightloop Module 4 Feature 1 (Invoice Management)...\n');

  // Re-seed to guaranteed clean state
  await seedAllMockData();

  // ─────────────────────────────────────────────────────────────────────────
  // 1. DATABASE SCHEMA & TABLE INTEGRITY
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n--- 1. Database Schema & Table Integrity ---');

  const invTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='invoices'").get();
  assert(!!invTable, 'invoices table exists in SQLite database');

  const linesTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='invoice_lines'").get();
  assert(!!linesTable, 'invoice_lines table exists in SQLite database');

  const historyTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='invoice_history'").get();
  assert(!!historyTable, 'invoice_history table exists in SQLite database');

  // Check required columns on invoices
  const invCols = db.prepare("PRAGMA table_info(invoices)").all().map(c => c.name);
  const requiredInvCols = [
    'id', 'uuid', 'invoice_number', 'subscription_id', 'customer_id',
    'customer_name', 'customer_email', 'subscription_number', 'plan_id', 'plan_name',
    'billing_frequency', 'invoice_date', 'due_date', 'billing_period_start', 'billing_period_end',
    'payment_terms', 'currency', 'subtotal', 'discount_id', 'discount_code', 'discount_amount',
    'taxable_amount', 'tax_amount', 'total_amount', 'amount_paid', 'status', 'notes',
    'payment_method', 'payment_reference', 'confirmed_at', 'paid_at', 'cancelled_at', 'cancellation_reason'
  ];
  const allInvColsPresent = requiredInvCols.every(col => invCols.includes(col));
  assert(allInvColsPresent, 'invoices table contains all required customer, subscription, date, financial and status columns');

  // Check required columns on invoice_lines
  const lineCols = db.prepare("PRAGMA table_info(invoice_lines)").all().map(c => c.name);
  const requiredLineCols = [
    'id', 'uuid', 'invoice_id', 'product_id', 'variant_id', 'product_name', 'product_type',
    'variant_name', 'quantity', 'base_unit_price', 'variant_additional_price', 'unit_price',
    'gross_amount', 'tax_id', 'tax_code', 'tax_rate', 'tax_amount', 'line_total'
  ];
  const allLineColsPresent = requiredLineCols.every(col => lineCols.includes(col));
  assert(allLineColsPresent, 'invoice_lines table contains product, variant, quantity, unit price, tax, and line total columns');

  // Check partial unique index
  const idx = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='index' AND name='idx_invoices_subscription_period'").get();
  assert(!!idx && idx.sql.includes('status != \'Cancelled\''), 'Partial unique index idx_invoices_subscription_period exists to block duplicates');

  // ─────────────────────────────────────────────────────────────────────────
  // 2. UNIQUE SEQUENTIAL INVOICE NUMBERING
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n--- 2. Unique Sequential Invoice Number Generation ---');

  const nextInvNum = generateDocumentNumber('INV');
  const year = new Date().getFullYear();
  const pattern = new RegExp(`^INV-${year}-\\d{5}$`);
  assert(pattern.test(nextInvNum), `Invoice number matches format INV-${year}-XXXXX (Generated: "${nextInvNum}")`);

  // Verify sequential progression
  const currentMaxRow = db.prepare('SELECT invoice_number FROM invoices ORDER BY id DESC LIMIT 1').get();
  const currentSeq = parseInt(currentMaxRow.invoice_number.split('-')[2], 10);
  const expectedSeq = currentSeq + 1;
  const expectedInvNum = `INV-${year}-${String(expectedSeq).padStart(5, '0')}`;
  assert(nextInvNum === expectedInvNum, `Invoice number increments sequentially (${expectedInvNum})`);

  // ─────────────────────────────────────────────────────────────────────────
  // 3. GENERATE INVOICE FROM MODULE 3 SUBSCRIPTION PAYLOAD
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n--- 3. Invoice Generation from Subscription (Module 3 Integration) ---');

  // Let's create a new active subscription with new billing dates to generate an invoice for
  const sub1 = db.prepare("SELECT * FROM subscriptions WHERE subscription_number = 'SUB-2026-00001'").get();
  assert(!!sub1, 'Found source subscription SUB-2026-00001 for automated generation');

  // Generate an invoice for next month's billing cycle: 2026-11-01 to 2026-12-01
  const reqMock = {
    params: { subscriptionId: sub1.id },
    body: {
      billing_period_start: '2026-11-01',
      billing_period_end: '2026-12-01',
      invoice_date: '2026-10-31',
      due_date: '2026-11-30',
      notes: 'Automated test billing generation'
    },
    user: { id: 1, role_name: 'admin', name: 'System Administrator' }
  };

  let generatedInvoiceData = null;
  const resMock = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(payload) { generatedInvoiceData = payload; return this; }
  };

  await invoiceController.generateFromSubscription(reqMock, resMock);

  assert(resMock.statusCode === 201, 'generateFromSubscription returns HTTP 201 Created');
  assert(generatedInvoiceData && generatedInvoiceData.success, 'Generation response indicates success');
  assert(generatedInvoiceData.data && generatedInvoiceData.data.invoice_number.startsWith(`INV-${year}-`), `Generated invoice number is ${generatedInvoiceData?.data?.invoice_number}`);

  const newInvId = generatedInvoiceData.data.invoice_id;
  const storedInv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(newInvId);
  assert(storedInv.status === 'Draft', 'Newly generated invoice defaults to "Draft" status');
  assert(storedInv.customer_name === 'Demo Customer', 'Customer details (name) accurately snapshot-stored');
  assert(storedInv.customer_email === 'customer@brightloop.com', 'Customer details (email) accurately snapshot-stored');
  assert(storedInv.subscription_number === 'SUB-2026-00001', 'Subscription details accurately recorded');
  assert(storedInv.billing_period_start === '2026-11-01', 'Billing period start date accurately stored');
  assert(storedInv.billing_period_end === '2026-12-01', 'Billing period end date accurately stored');
  assert(storedInv.payment_terms === 'Net 30', 'Payment terms stored');
  assert(storedInv.discount_code === 'FLAT500', 'Discount code preserved from subscription');
  assert(storedInv.discount_amount === 500.0, 'Discount amount preserved from subscription');

  const storedLines = db.prepare('SELECT * FROM invoice_lines WHERE invoice_id = ?').all(newInvId);
  assert(storedLines.length >= 1, `Invoice line items created (${storedLines.length} line(s))`);
  assert(storedLines[0].product_name === 'Cloud ERP Suite', 'Line product name matches subscription line');
  assert(storedLines[0].variant_name === 'Odoo Edition', 'Line variant (Odoo Edition) matches subscription line');
  assert(storedLines[0].unit_price === 2960.0, 'Line unit price (2400 + 560 = 2960) accurately calculated');

  // Verify Audit History
  const history = db.prepare('SELECT * FROM invoice_history WHERE invoice_id = ?').all(newInvId);
  assert(history.length >= 1, 'Invoice audit history initialized');
  assert(history[0].action === 'CREATE_FROM_SUBSCRIPTION', 'Audit action is "CREATE_FROM_SUBSCRIPTION"');

  // ─────────────────────────────────────────────────────────────────────────
  // 4. DUPLICATE INVOICE PREVENTION (REQUIREMENT 7)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n--- 4. Prevent Duplicate Invoices for Same Subscription and Billing Period ---');

  // Attempting to generate again for the EXACT SAME subscription and billing period
  let duplicateRes = null;
  const dupResMock = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(payload) { duplicateRes = payload; return this; }
  };

  await invoiceController.generateFromSubscription(reqMock, dupResMock);

  assert(dupResMock.statusCode === 409, 'Duplicate invoice generation rejected with HTTP 409 Conflict');
  assert(duplicateRes && duplicateRes.success === false, 'Duplicate error response indicates failure');
  assert(duplicateRes.message.includes('already exists for this subscription and billing period'), 'Error message clearly explains period duplicate conflict');

  // ─────────────────────────────────────────────────────────────────────────
  // 5. UPDATE DRAFT INVOICE & IMMUTABILITY GUARDS (REQUIREMENT 5)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n--- 5. Update Draft Invoice & Guard Enforcement ---');

  const updateReqMock = {
    params: { id: newInvId },
    body: {
      due_date: '2026-12-15',
      payment_terms: 'Net 45',
      notes: 'Customer requested 45-day credit terms on this cycle',
      lines: [
        {
          product_id: 1,
          variant_id: 2,
          product_name: 'Cloud ERP Suite',
          quantity: 2, // Updated quantity from 1 to 2
          unit_price: 2960.0,
          tax_rate: 18.0
        }
      ]
    },
    user: { id: 1, role_name: 'admin' }
  };

  let updateRes = null;
  const updateResMock = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(payload) { updateRes = payload; return this; }
  };

  await invoiceController.updateInvoice(updateReqMock, updateResMock);

  assert(updateResMock.statusCode === 200, 'Draft invoice update succeeds with HTTP 200 OK');
  assert(updateRes.data.invoice.due_date === '2026-12-15', 'Due date updated to 2026-12-15');
  assert(updateRes.data.invoice.payment_terms === 'Net 45', 'Payment terms updated to Net 45');
  assert(updateRes.data.invoice.lines[0].quantity === 2, 'Line quantity updated to 2');
  assert(updateRes.data.invoice.subtotal === 5920.0, 'Subtotal recalculated to ₹5,920.00 (2 * 2960)');

  // ─────────────────────────────────────────────────────────────────────────
  // 6. INVOICE LIFECYCLE STATE TRANSITIONS (Draft -> Confirmed -> Paid)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n--- 6. Invoice Status Lifecycle Management ---');

  // Transition 1: Draft -> Confirmed
  let confirmRes = null;
  const confirmResMock = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(payload) { confirmRes = payload; return this; }
  };

  await invoiceController.confirmInvoice({ params: { id: newInvId }, user: { id: 2, role_name: 'staff' } }, confirmResMock);
  assert(confirmResMock.statusCode === 200, 'Draft invoice successfully confirmed (HTTP 200)');
  assert(confirmRes.data.status === 'Confirmed', 'Status changed to "Confirmed"');

  const confirmedInv = db.prepare('SELECT status, confirmed_at FROM invoices WHERE id = ?').get(newInvId);
  assert(confirmedInv.status === 'Confirmed' && !!confirmedInv.confirmed_at, 'Database confirms status is "Confirmed" with confirmed_at timestamp');

  // Guard test: Once Confirmed, updateInvoice MUST fail!
  let blockedUpdateRes = null;
  const blockedUpdateResMock = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(payload) { blockedUpdateRes = payload; return this; }
  };

  await invoiceController.updateInvoice(updateReqMock, blockedUpdateResMock);
  assert(blockedUpdateResMock.statusCode === 400, 'Attempting to update a Confirmed invoice is blocked with HTTP 400 Bad Request');
  assert(blockedUpdateRes.message.includes('Only Draft invoices can be modified'), 'Error message confirms only Draft invoices can be updated');

  // Transition 2: Confirmed -> Paid
  let payRes = null;
  const payResMock = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(payload) { payRes = payload; return this; }
  };

  await invoiceController.payInvoice({
    params: { id: newInvId },
    body: {
      payment_method: 'Bank Wire Transfer',
      payment_reference: 'WIRE-HDFC-998822',
      notes: 'Full settlement received'
    },
    user: { id: 2, role_name: 'staff' }
  }, payResMock);

  assert(payResMock.statusCode === 200, 'Invoice successfully marked as Paid (HTTP 200)');
  const paidInv = db.prepare('SELECT status, paid_at, amount_paid, total_amount, payment_method, payment_reference FROM invoices WHERE id = ?').get(newInvId);
  assert(paidInv.status === 'Paid', 'Database confirms status is "Paid"');
  assert(paidInv.amount_paid === paidInv.total_amount, 'Amount paid equals total amount');
  assert(paidInv.payment_method === 'Bank Wire Transfer', 'Payment method recorded');
  assert(paidInv.payment_reference === 'WIRE-HDFC-998822', 'Payment reference recorded');
  assert(!!paidInv.paid_at, 'paid_at timestamp recorded');

  // Transition 3: Cancel invoice operation
  // Let's create another draft invoice to test cancel
  const sub2 = db.prepare("SELECT * FROM subscriptions WHERE subscription_number = 'SUB-2026-00002'").get();
  const reqCancelCreate = {
    params: { subscriptionId: sub2.id },
    body: {
      billing_period_start: '2027-09-01',
      billing_period_end: '2028-09-01',
      notes: 'Test invoice for cancellation'
    },
    user: { id: 1, role_name: 'admin' }
  };
  let invToCancel = null;
  await invoiceController.generateFromSubscription(reqCancelCreate, {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(payload) { invToCancel = payload; return this; }
  });

  const cancelInvId = invToCancel.data.invoice_id;
  let cancelRes = null;
  const cancelResMock = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(payload) { cancelRes = payload; return this; }
  };

  await invoiceController.cancelInvoice({
    params: { id: cancelInvId },
    body: { reason: 'Client restructured billing entity' },
    user: { id: 2, role_name: 'staff' }
  }, cancelResMock);

  assert(cancelResMock.statusCode === 200, 'Invoice cancelled successfully (HTTP 200)');
  const cancelledInv = db.prepare('SELECT status, cancelled_at, cancellation_reason FROM invoices WHERE id = ?').get(cancelInvId);
  assert(cancelledInv.status === 'Cancelled', 'Status is "Cancelled"');
  assert(cancelledInv.cancellation_reason === 'Client restructured billing entity', 'Cancellation reason preserved');
  assert(!!cancelledInv.cancelled_at, 'cancelled_at timestamp recorded');

  // Re-attempting duplicate on a CANCELLED period:
  // Since previous invoice was Cancelled, a new invoice CAN be created for that period!
  let reGenerateRes = null;
  const reGenMock = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(payload) { reGenerateRes = payload; return this; }
  };
  await invoiceController.generateFromSubscription(reqCancelCreate, reGenMock);
  assert(reGenMock.statusCode === 201, 'New invoice can be issued for a period where the previous invoice was Cancelled');

  // ─────────────────────────────────────────────────────────────────────────
  // 7. ROLE-BASED ACCESS CONTROL (RBAC) & PERMISSION ENFORCEMENT
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n--- 7. Role-Based Access Control & User Scoping ---');

  // Customer ID 8 (Demo Customer) queries invoices
  let custInvoicesData = null;
  await invoiceController.getAllInvoices({
    query: {},
    user: { id: 8, role_name: 'customer' }
  }, {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(payload) { custInvoicesData = payload; return this; }
  });

  const allCustInvoices = custInvoicesData.data.invoices;
  const onlyOwnInvoices = allCustInvoices.every(inv => inv.customer_id === 8);
  assert(onlyOwnInvoices && allCustInvoices.length > 0, `Customer sees ONLY their own invoices (${allCustInvoices.length} invoices returned)`);

  // Customer attempts to view another customer's invoice (Invoice 2 belongs to Acme ID 5)
  let forbiddenViewRes = null;
  const forbiddenMock = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(payload) { forbiddenViewRes = payload; return this; }
  };
  await invoiceController.getInvoiceById({
    params: { id: 2 }, // Invoice 2 belongs to Customer 5
    user: { id: 8, role_name: 'customer' }
  }, forbiddenMock);

  assert(forbiddenMock.statusCode === 403, 'Customer forbidden from viewing another customer\'s invoice (HTTP 403)');

  // Admin/Staff querying all invoices
  let adminInvoicesData = null;
  await invoiceController.getAllInvoices({
    query: {},
    user: { id: 1, role_name: 'admin' }
  }, {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(payload) { adminInvoicesData = payload; return this; }
  });
  assert(adminInvoicesData.data.invoices.length > allCustInvoices.length, 'Admin sees all tenant invoices across all customers');

  // ─────────────────────────────────────────────────────────────────────────
  // 8. KPI METRICS & STATS VERIFICATION
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n--- 8. High-Level KPI Statistics ---');

  let statsData = null;
  await invoiceController.getInvoiceStats({}, {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(payload) { statsData = payload; return this; }
  });

  assert(statsData.success, 'Invoice stats query succeeds');
  assert(statsData.data.total_invoices >= 5, `Total invoices count is accurate (${statsData.data.total_invoices})`);
  assert(statsData.data.total_revenue > 0, `Total paid revenue is tracked (₹${statsData.data.total_revenue})`);
  assert(statsData.data.receivable_amount > 0, `Total confirmed receivable is tracked (₹${statsData.data.receivable_amount})`);

  console.log('\n=======================================');
  console.log(`Results: ${passedTests} passed, ${failedTests} failed.`);
  console.log('=======================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runTests().catch(err => {
    console.error('Test execution error:', err);
    process.exit(1);
  });
}

module.exports = { runTests };

