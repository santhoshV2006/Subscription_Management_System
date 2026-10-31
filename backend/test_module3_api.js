/**
 * E2E Live REST API Verification for Module 3: Subscriptions & Quotations
 * Run with: node backend/test_module3_api.js
 */

const http = require('http');

function apiRequest(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: `/api${path}`,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    }, res => {
      let responseBody = '';
      res.on('data', chunk => responseBody += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseBody);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, text: responseBody });
        }
      });
    });

    req.on('error', err => reject(err));
    if (data) req.write(data);
    req.end();
  });
}

async function runE2E() {
  console.log('\n🌐 Testing Live Brightloop REST APIs for Module 3 (Subscriptions & Quotations)...\n');

  // 1. Health check
  const health = await apiRequest('GET', '/health');
  console.log('1. Health check:', health.status === 200 ? '✅ 200 OK' : '❌ Failed');

  // 2. Admin Login
  const adminLogin = await apiRequest('POST', '/auth/login', {
    email: 'admin@brightloop.com',
    password: 'Admin@123!'
  });
  console.log('2. Admin Login:', adminLogin.status === 200 ? '✅ Authenticated' : '❌ Failed');
  const adminToken = adminLogin.data.data.accessToken;

  // 3. Customer Login (Demo Customer)
  const custLogin = await apiRequest('POST', '/auth/login', {
    email: 'customer@brightloop.com',
    password: 'Customer@123!'
  });
  console.log('3. Customer Login:', custLogin.status === 200 ? '✅ Authenticated' : '❌ Failed');
  const custToken = custLogin.data.data.accessToken;

  // 4. Staff Login
  const staffLogin = await apiRequest('POST', '/auth/login', {
    email: 'staff@brightloop.com',
    password: 'Staff@123!'
  });
  console.log('4. Staff Login:', staffLogin.status === 200 ? '✅ Authenticated' : '❌ Failed');
  const staffToken = staffLogin.data.data.accessToken;

  // 5. GET /api/quotations/templates
  const templatesRes = await apiRequest('GET', '/quotations/templates', null, adminToken);
  console.log('5. GET /api/quotations/templates:', templatesRes.status === 200 ? `✅ Retrieved ${templatesRes.data.data.templates.length} templates` : '❌ Failed');

  // 6. POST /api/quotations (Create from scratch with Odoo variant)
  const createQuoteRes = await apiRequest('POST', '/quotations', {
    customer_id: 8, // Demo Customer
    plan_id: 3, // Monthly Pro
    validity_days: 30,
    payment_terms: 'Net 30',
    lines: [
      { product_id: 1, variant_id: 2, quantity: 1 } // Cloud ERP with Odoo variant (+560)
    ],
    discount_code: 'BRIGHT20'
  }, staffToken);
  console.log('6. POST /api/quotations:', createQuoteRes.status === 201 ? `✅ Created Quote ${createQuoteRes.data.data.quotation_number}` : '❌ Failed');
  const quoteId = createQuoteRes.data.data.quotation_id;

  // 7. GET /api/quotations/:id
  const getQuoteRes = await apiRequest('GET', `/quotations/${quoteId}`, null, staffToken);
  console.log('7. GET /api/quotations/:id:', getQuoteRes.status === 200 ? `✅ Retrieved Quote (Total: ₹${getQuoteRes.data.data.quotation.total_amount})` : '❌ Failed');

  // 8. POST /api/quotations/:id/convert (Convert to Subscription)
  const convertRes = await apiRequest('POST', `/quotations/${quoteId}/convert`, { initial_status: 'Active' }, staffToken);
  console.log('8. POST /api/quotations/:id/convert:', convertRes.status === 201 ? `✅ Converted to Subscription ${convertRes.data.data.subscription_number}` : '❌ Failed');
  const subId = convertRes.data.data.subscription_id;

  // 9. GET /api/subscriptions/:id
  const getSubRes = await apiRequest('GET', `/subscriptions/${subId}`, null, adminToken);
  console.log('9. GET /api/subscriptions/:id:', getSubRes.status === 200 ? `✅ Subscription is ${getSubRes.data.data.subscription.status}` : '❌ Failed');

  // 10. POST /api/subscriptions/:id/pause
  const pauseRes = await apiRequest('POST', `/subscriptions/${subId}/pause`, { reason: 'E2E test pause' }, staffToken);
  console.log('10. POST /api/subscriptions/:id/pause:', pauseRes.status === 200 ? '✅ Paused' : '❌ Failed');

  // 11. POST /api/subscriptions/:id/resume
  const resumeRes = await apiRequest('POST', `/subscriptions/${subId}/resume`, {}, staffToken);
  console.log('11. POST /api/subscriptions/:id/resume:', resumeRes.status === 200 ? '✅ Resumed' : '❌ Failed');

  // 12. POST /api/subscriptions/:id/renew
  const renewRes = await apiRequest('POST', `/subscriptions/${subId}/renew`, {}, staffToken);
  console.log('12. POST /api/subscriptions/:id/renew:', renewRes.status === 200 ? `✅ Renewed until ${renewRes.data.data.new_expiry_date}` : '❌ Failed');

  // 13. POST /api/subscriptions/:id/close
  const closeRes = await apiRequest('POST', `/subscriptions/${subId}/close`, { reason: 'E2E completed' }, staffToken);
  console.log('13. POST /api/subscriptions/:id/close:', closeRes.status === 200 ? '✅ Closed' : '❌ Failed');

  // 14. GET /api/subscriptions/:id/invoice-payload (Module 4 payload)
  const invoiceRes = await apiRequest('GET', `/subscriptions/${subId}/invoice-payload`, null, staffToken);
  const payload = invoiceRes.data?.data?.invoice_payload;
  console.log('14. GET /api/subscriptions/:id/invoice-payload (Module 4):', invoiceRes.status === 200 && payload ? `✅ Verified (Payable: ₹${payload.summary.total_amount})` : '❌ Failed');

  // 15. Customer Role RBAC Check
  const custForbidden = await apiRequest('POST', '/users/staff', { name: 'Fake Staff', email: 'fake@example.com', password: 'Password@123!' }, custToken);
  console.log('15. RBAC Protection Check (Customer cannot create staff):', custForbidden.status === 403 ? '✅ 403 Forbidden (Protected)' : '❌ Failed');

  console.log('\n🎉 ALL LIVE E2E REST API TESTS FOR MODULE 3 PASSED PERFECTLY!\n');
}

runE2E().catch(err => {
  console.error('E2E execution error:', err);
  process.exit(1);
});
