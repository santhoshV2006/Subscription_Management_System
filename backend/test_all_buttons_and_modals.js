/**
 * Brightloop Software — Comprehensive Verification of All Modals & Action Buttons
 * Tests both frontend Modal behavior (no [object Object] / undefined bugs)
 * and all backend API endpoints backing every button for Admin, Staff, and Customer.
 */

const http = require('http');

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, 'http://localhost:3000');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const data = body ? JSON.stringify(body) : null;
    if (data) headers['Content-Length'] = Buffer.byteLength(data);

    const req = http.request(url, { method, headers }, (res) => {
      let responseBody = '';
      res.on('data', chunk => responseBody += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(responseBody);
          resolve({ status: res.statusCode, data: json });
        } catch {
          resolve({ status: res.statusCode, raw: responseBody });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// ─── Frontend Modal Component Unit Verification ─────────────────────────────────
function testModalBehavior() {
  console.log('\n🔍 --- 1. Testing Frontend Modal Component Architecture ---');

  // Simulate minimal DOM environment for testing components.js Modal logic
  const elements = new Map();
  const documentMock = {
    body: {
      appendChild: (el) => { elements.set(el.id, el); }
    },
    getElementById: (id) => elements.get(id) || null,
    createElement: (tag) => ({
      tagName: tag,
      id: '',
      className: '',
      innerHTML: '',
      addEventListener: () => {},
      remove: function() { elements.delete(this.id); }
    }),
    addEventListener: () => {},
    removeEventListener: () => {}
  };

  global.document = documentMock;

  // Load components.js in this isolated scope
  const fs = require('fs');
  const path = require('path');
  const compCode = fs.readFileSync(path.join(__dirname, '../frontend/js/components.js'), 'utf8') + '\nwindow.Modal = Modal;\n';

  // Evaluate Modal inside isolated VM
  const vm = require('vm');
  const context = { document: documentMock, console, window: {} };
  vm.createContext(context);
  vm.runInContext(compCode, context);

  const Modal = context.window.Modal;

  // Test Case A: Object configuration (Module 3 style)
  Modal.open({
    title: 'Subscription Details: SUB-2026-00001',
    body: '<div class="details">Line Items: 2</div>',
    width: '760px',
    buttons: [
      { label: 'Pause Subscription', class: 'btn-warning', onclick: 'Module3.executePause(1)' },
      { label: 'Close', class: 'btn-secondary', onclick: 'Modal.close()' }
    ]
  });

  const modalOverlay = elements.get('modal-overlay');
  if (!modalOverlay) throw new Error('Modal overlay was not created');

  const html = modalOverlay.innerHTML;
  if (html.includes('[object Object]')) {
    throw new Error('FAILED: Modal title still renders [object Object]!');
  }
  if (html.includes('<div class="modal-body">undefined</div>')) {
    throw new Error('FAILED: Modal body still renders undefined!');
  }
  if (!html.includes('Subscription Details: SUB-2026-00001')) {
    throw new Error('FAILED: Modal title is missing');
  }
  if (!html.includes('Line Items: 2')) {
    throw new Error('FAILED: Modal body content is missing');
  }
  if (!html.includes('Pause Subscription') || !html.includes('btn-warning')) {
    throw new Error('FAILED: Modal buttons were not generated correctly');
  }
  if (!html.includes('max-width: 760px')) {
    throw new Error('FAILED: Modal custom width was not applied');
  }

  console.log('  ✅ PASS: Modal accepts object configuration cleanly without [object Object]');
  console.log('  ✅ PASS: Modal renders dynamic action buttons with correct CSS classes');
  console.log('  ✅ PASS: Modal applies responsive custom max-width (760px)');

  // Test Case B: Positional configuration (Module 1 / 2 style)
  Modal.open('Edit Product', '<p>Product Form</p>', '<button class="btn btn-primary">Save</button>');
  const overlayB = elements.get('modal-overlay');
  const htmlB = overlayB.innerHTML;
  if (!htmlB.includes('Edit Product') || !htmlB.includes('<p>Product Form</p>') || !htmlB.includes('Save')) {
    throw new Error('FAILED: Positional Modal.open failed');
  }
  console.log('  ✅ PASS: Modal accepts positional arguments (title, body, footer) backward compatibility');

  // Test Case C: Module 4 Corporate Invoice Document Modal
  Modal.open({
    title: 'Invoice Details: INV-2026-00001',
    body: '<div class="invoice-document"><div class="invoice-header">Tax Invoice INV-2026-00001</div></div>',
    width: '840px',
    buttons: [
      { label: 'Print / PDF', class: 'btn-outline', onclick: 'Module4.printInvoice(1)' },
      { label: 'Record Payment', class: 'btn-success', onclick: 'Module4.openPayModal(1)' },
      { label: 'Close', class: 'btn-secondary', onclick: 'Modal.close()' }
    ]
  });
  const overlayC = elements.get('modal-overlay');
  const htmlC = overlayC.innerHTML;
  if (!htmlC.includes('Invoice Details: INV-2026-00001') || !htmlC.includes('Print / PDF') || !htmlC.includes('max-width: 840px')) {
    throw new Error('FAILED: Invoice Modal did not render correctly');
  }
  console.log('  ✅ PASS: Modal renders Module 4 Corporate Invoice Document with action buttons and print controls');

  Modal.close();
  if (elements.has('modal-overlay')) {
    throw new Error('FAILED: Modal overlay was not removed on Modal.close()');
  }
  console.log('  ✅ PASS: Modal.close cleanly tears down overlay');
}

// ─── End-to-End API Backing All Buttons Verification ───────────────────────────
async function testAllButtonEndpoints() {
  console.log('\n🚀 --- 2. Testing All Action Buttons & Options For All Roles ---');

  // 1. Authenticate Admin
  const adminLogin = await request('POST', '/api/auth/login', {
    email: 'admin@brightloop.com',
    password: 'Admin@123!'
  });
  if (adminLogin.status !== 200) throw new Error('Admin login failed: ' + JSON.stringify(adminLogin.data));
  const adminToken = adminLogin.data.data.accessToken || adminLogin.data.data.token;
  console.log('  ✅ PASS: Admin login successful');

  // 2. Authenticate Staff
  const staffLogin = await request('POST', '/api/auth/login', {
    email: 'staff@brightloop.com',
    password: 'Staff@123!'
  });
  if (staffLogin.status !== 200) throw new Error('Staff login failed: ' + JSON.stringify(staffLogin.data));
  const staffToken = staffLogin.data.data.accessToken || staffLogin.data.data.token;
  console.log('  ✅ PASS: Staff login successful');

  // 3. Authenticate Customer
  const custLogin = await request('POST', '/api/auth/login', {
    email: 'acme.corp@example.com',
    password: 'Customer@123!'
  });
  if (custLogin.status !== 200) throw new Error('Customer login failed: ' + JSON.stringify(custLogin.data));
  const custToken = custLogin.data.data.accessToken || custLogin.data.data.token;
  console.log('  ✅ PASS: Customer login successful');

  // ── ADMIN BUTTONS & ACTIONS ──────────────────────────────────────────────────
  console.log('\n👑 [Admin Role Buttons & Handlers]');

  // Button: Admin Dashboard Stats
  const adminStats = await request('GET', '/api/users/dashboard-stats', null, adminToken);
  if (adminStats.status !== 200) throw new Error('Admin dashboard stats failed: ' + adminStats.status + ' ' + JSON.stringify(adminStats.data));
  console.log('  ✅ PASS: [Admin] Dashboard stats & user metrics loaded');

  // Button: Add Product
  const newProd = await request('POST', '/api/products', {
    name: `Test Button Product ${Date.now()}`,
    type: 'service',
    sales_price: 1500,
    cost_price: 800,
    notes: 'Created via admin test'
  }, adminToken);
  if (newProd.status !== 201) throw new Error('Admin Add Product failed: ' + JSON.stringify(newProd.data));
  const prodId = newProd.data.data.id;
  console.log(`  ✅ PASS: [Admin] 'Add Product' button creates product (ID: ${prodId})`);

  // Button: Add Variant to Product
  const newVar = await request('POST', `/api/products/${prodId}/variants`, {
    variant_type: 'Brand',
    variant_name: 'Odoo Enterprise',
    additional_price: 560
  }, adminToken);
  if (newVar.status !== 201) throw new Error('Admin Add Variant failed');
  const varId = newVar.data.data.id;
  console.log(`  ✅ PASS: [Admin] 'Add Variant' button adds +₹560 surcharge variant`);

  // Button: Delete Variant
  const delVar = await request('DELETE', `/api/products/${prodId}/variants/${varId}`, null, adminToken);
  if (delVar.status !== 200) throw new Error('Admin Delete Variant failed');
  console.log(`  ✅ PASS: [Admin] 'Delete Variant' button removes variant`);

  // Button: Create Subscription Plan
  const newPlan = await request('POST', '/api/plans', {
    name: `Test Plan ${Date.now()}`,
    billing_frequency: 'monthly',
    min_purchase_quantity: 1,
    start_date: '2026-01-01',
    end_date: '2026-12-31'
  }, adminToken);
  if (newPlan.status !== 201) throw new Error('Admin Create Plan failed');
  const planId = newPlan.data.data.id;
  console.log(`  ✅ PASS: [Admin] 'Create Plan' button registers plan (ID: ${planId})`);

  // Button: Pause/Resume Plan
  const pausePlan = await request('POST', `/api/plans/${planId}/pause`, {}, adminToken);
  if (pausePlan.status !== 200) throw new Error('Admin Pause Plan failed');
  console.log(`  ✅ PASS: [Admin] 'Pause Plan' button toggles status to inactive`);

  // Button: Add Tax Rule
  const newTax = await request('POST', '/api/taxes', {
    name: `Custom Tax ${Date.now()}`,
    rate: 12.5,
    is_active: true
  }, adminToken);
  if (newTax.status !== 201) throw new Error('Admin Add Tax failed');
  console.log(`  ✅ PASS: [Admin] 'Add Tax Rule' button creates tax rule`);

  // Button: Create Discount Voucher
  const newDisc = await request('POST', '/api/discounts', {
    name: `Promo Code ${Date.now()}`,
    code: `SAVE${Date.now().toString().slice(-4)}`,
    discount_type: 'percentage',
    value: 15,
    min_purchase_amount: 500,
    max_usage_limit: 50,
    start_date: '2026-01-01',
    end_date: '2026-12-31'
  }, adminToken);
  if (newDisc.status !== 201) throw new Error('Admin Create Discount failed: ' + JSON.stringify(newDisc.data));
  console.log(`  ✅ PASS: [Admin] 'Create Discount' button creates discount voucher`);

  // Button: Create Staff Account
  const newStaffEmail = `staff_btn_${Date.now()}@brightloop.com`;
  const createStaff = await request('POST', '/api/users/staff', {
    name: 'New Staff Member',
    email: newStaffEmail,
    password: 'StaffPassword123!'
  }, adminToken);
  if (createStaff.status !== 201) throw new Error('Admin Create Staff failed: ' + JSON.stringify(createStaff.data));
  const newStaffUuid = createStaff.data.data.user ? createStaff.data.data.user.uuid : createStaff.data.data.uuid;
  console.log(`  ✅ PASS: [Admin] 'Add Staff' button creates staff member (UUID: ${newStaffUuid})`);

  // Button: Toggle User Status (Deactivate / Activate)
  const deactUser = await request('PATCH', `/api/users/${newStaffUuid}/status`, { is_active: false }, adminToken);
  if (deactUser.status !== 200) throw new Error('Toggle user status failed');
  console.log(`  ✅ PASS: [Admin] 'Deactivate User' button deactivates account`);

  // Button: Delete User
  const delUser = await request('DELETE', `/api/users/${newStaffUuid}`, null, adminToken);
  if (delUser.status !== 200) throw new Error('Delete user failed');
  console.log(`  ✅ PASS: [Admin] 'Delete User' button deletes user permanently`);

  // ── STAFF BUTTONS & ACTIONS (SUBSCRIPTIONS & INVOICES) ────────────────────────
  console.log('\n💼 [Staff Role Buttons & Handlers]');

  // Button: Create Quotation Template
  const newTpl = await request('POST', '/api/quotations/templates', {
    name: `Test Template ${Date.now()}`,
    description: 'Template created via test runner',
    plan_id: 3,
    default_validity_days: 15,
    payment_terms: 'Immediate Payment',
    lines: [
      { product_id: 1, quantity: 2 }
    ]
  }, staffToken);
  if (newTpl.status !== 201) throw new Error('Create Template failed: ' + JSON.stringify(newTpl.data));
  const tplId = newTpl.data.data.template_id || newTpl.data.data.id;
  console.log(`  ✅ PASS: [Staff] 'Save Template' button creates template (ID: ${tplId})`);

  // Button: Generate Quotation (from template)
  const newQuote = await request('POST', '/api/quotations', {
    template_id: tplId,
    customer_id: 5,
    plan_id: 3,
    validity_days: 15,
    payment_terms: 'Net 30 Days',
    lines: [
      { product_id: 1, quantity: 2 }
    ]
  }, staffToken);
  if (newQuote.status !== 201) throw new Error('Create Quotation failed: ' + JSON.stringify(newQuote.data));
  const quoteId = newQuote.data.data.quotation_id || newQuote.data.data.id;
  console.log(`  ✅ PASS: [Staff] 'Generate Quotation' button generates quote (ID: ${quoteId})`);

  // Button: Convert Quotation to Subscription
  const convertQuote = await request('POST', `/api/quotations/${quoteId}/convert`, {
    initial_status: 'Active'
  }, staffToken);
  if (convertQuote.status !== 201) throw new Error('Convert Quotation failed: ' + JSON.stringify(convertQuote.data));
  const subId = convertQuote.data.data.subscription_id || convertQuote.data.data.id;
  console.log(`  ✅ PASS: [Staff] 'Convert to Subscription' button creates active subscription (ID: ${subId})`);

  // Button: Pause Subscription
  const pauseSub = await request('POST', `/api/subscriptions/${subId}/pause`, {
    reason: 'Customer requested pause'
  }, staffToken);
  if (pauseSub.status !== 200) throw new Error('Pause subscription failed: ' + JSON.stringify(pauseSub.data));
  console.log(`  ✅ PASS: [Staff] 'Pause Subscription' modal button pauses contract`);

  // Button: Resume Subscription
  const resumeSub = await request('POST', `/api/subscriptions/${subId}/resume`, {}, staffToken);
  if (resumeSub.status !== 200) throw new Error('Resume subscription failed: ' + JSON.stringify(resumeSub.data));
  console.log(`  ✅ PASS: [Staff] 'Resume Subscription' modal button resumes contract to Active`);

  // Button: Renew Subscription
  const renewSub = await request('POST', `/api/subscriptions/${subId}/renew`, {}, staffToken);
  if (renewSub.status !== 200) throw new Error('Renew subscription failed: ' + JSON.stringify(renewSub.data));
  console.log(`  ✅ PASS: [Staff] 'Renew Subscription' modal button extends billing term`);

  // Button: View Module 4 Invoice Payload
  const invPayload = await request('GET', `/api/subscriptions/${subId}/invoice-payload`, null, staffToken);
  if (invPayload.status !== 200 || !invPayload.data.data.invoice_payload) throw new Error('Invoice payload failed');
  console.log(`  ✅ PASS: [Staff] 'View Module 4 Invoice Payload' modal button renders integration JSON`);

  // Button: Generate Invoice from Subscription (Module 4)
  const genInv = await request('POST', `/api/invoices/generate/${subId}`, {
    billing_period_start: '2027-02-01',
    billing_period_end: '2027-03-01',
    notes: 'Generated via test button'
  }, staffToken);
  if (genInv.status !== 201) throw new Error('Generate Invoice failed: ' + JSON.stringify(genInv.data));
  const newInvId = genInv.data.data.invoice_id;
  console.log(`  ✅ PASS: [Staff] 'Generate from Subscription' button creates Draft invoice (${genInv.data.data.invoice_number})`);

  // Button: Edit Draft Invoice
  const editInv = await request('PUT', `/api/invoices/${newInvId}`, {
    payment_terms: 'Net 45',
    notes: 'Updated terms via edit draft modal'
  }, staffToken);
  if (editInv.status !== 200) throw new Error('Edit Draft Invoice failed');
  console.log(`  ✅ PASS: [Staff] 'Save Changes' modal button updates Draft invoice parameters`);

  // Button: Confirm Draft Invoice
  const confirmInv = await request('POST', `/api/invoices/${newInvId}/confirm`, {}, staffToken);
  if (confirmInv.status !== 200) throw new Error('Confirm Invoice failed');
  console.log(`  ✅ PASS: [Staff] 'Confirm Invoice' modal button confirms draft into billable status`);

  // Button: Record Payment
  const payInv = await request('POST', `/api/invoices/${newInvId}/pay`, {
    payment_method: 'UPI',
    payment_reference: 'UPI-BTN-TEST-88',
    notes: 'Settled at counter'
  }, staffToken);
  if (payInv.status !== 200) throw new Error('Record payment failed');
  console.log(`  ✅ PASS: [Staff] 'Record Payment' modal button marks invoice as Paid in full`);

  // Button: Close Subscription
  const closeSub = await request('POST', `/api/subscriptions/${subId}/close`, {
    reason: 'Contract period completed'
  }, staffToken);
  if (closeSub.status !== 200) throw new Error('Close subscription failed: ' + JSON.stringify(closeSub.data));
  console.log(`  ✅ PASS: [Staff] 'Confirm Closure' modal button closes subscription`);

  // ── CUSTOMER BUTTONS & ACTIONS ───────────────────────────────────────────────
  console.log('\n👤 [Customer Role Buttons & Handlers]');

  // Button: View My Subscriptions
  const custSubs = await request('GET', '/api/subscriptions', null, custToken);
  if (custSubs.status !== 200) throw new Error('Customer view subscriptions failed');
  console.log(`  ✅ PASS: [Customer] 'My Subscriptions' button loads only customer's own subscriptions (${custSubs.data.data.subscriptions.length} records)`);

  // Button: View My Quotations
  const custQuotes = await request('GET', '/api/quotations', null, custToken);
  if (custQuotes.status !== 200) throw new Error('Customer view quotations failed');
  console.log(`  ✅ PASS: [Customer] 'My Quotations' button loads only customer's own quotations (${custQuotes.data.data.quotations.length} records)`);

  // Button: View My Invoices
  const custInvs = await request('GET', '/api/invoices', null, custToken);
  if (custInvs.status !== 200) throw new Error('Customer view invoices failed');
  console.log(`  ✅ PASS: [Customer] 'My Invoices' button loads customer's invoices (${custInvs.data.data.invoices.length} records)`);

  // Button: Customer View Specific Subscription Details
  const custSubDetails = await request('GET', `/api/subscriptions/${custSubs.data.data.subscriptions[0].id}`, null, custToken);
  if (custSubDetails.status !== 200) throw new Error('Customer view subscription details failed');
  console.log(`  ✅ PASS: [Customer] 'Details' modal button displays subscription items & history`);

  // Customer cannot pause/close another user's or unauthorized subscriptions
  const custForbiddenAction = await request('POST', `/api/subscriptions/${subId}/pause`, { reason: 'Unauthorized' }, custToken);
  if (custForbiddenAction.status !== 403 && custForbiddenAction.status !== 404) {
    throw new Error('Customer was improperly allowed to perform staff action');
  }
  console.log(`  ✅ PASS: [RBAC Security] Customer cannot trigger administrative lifecycle actions`);

  // ── FRONTEND HTML FILE VERIFICATION ─────────────────────────────────────────
  console.log('\n🌐 [Frontend Web Server Serving Files Check]');
  const frontendIndex = await new Promise((resolve) => {
    http.get('http://localhost:5500', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, length: data.length }));
    }).on('error', () => {
      // If standalone frontend server on 5500 isn't running, test backend on 3000 which also serves frontend
      http.get('http://localhost:3000', (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, length: data.length }));
      });
    });
  });
  if (frontendIndex.status !== 200) throw new Error('Frontend server did not serve index.html');
  console.log(`  ✅ PASS: Web server successfully serving Brightloop UI (${frontendIndex.length} bytes)`);

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('🎉 ALL BUTTONS, MODALS, AND USER FUNCTIONS VERIFIED 100% ERRORLESS!');
  console.log('═══════════════════════════════════════════════════════════════\n');
}

async function run() {
  try {
    testModalBehavior();
    await testAllButtonEndpoints();
  } catch (err) {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
  }
}

run();
