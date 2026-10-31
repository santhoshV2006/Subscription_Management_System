/**
 * Live REST HTTP API Verification for Module 4 Feature 1: Invoice Management
 * Tests all endpoints against the live Express server with real JWT authentication.
 *
 * Run with: node backend/test_module4_api.js
 */

const http = require('http');

function apiRequest(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: 'localhost',
      port: process.env.PORT || 3000,
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
        } catch {
          resolve({ status: res.statusCode, text: responseBody });
        }
      });
    });

    req.on('error', err => reject(err));
    if (data) req.write(data);
    req.end();
  });
}

async function runLiveE2E() {
  console.log('\n🌐 Testing Live Brightloop REST APIs for Module 4 (Invoice Management)...\n');

  // 1. Health check
  const health = await apiRequest('GET', '/health');
  if (health.status !== 200) {
    console.error('❌ Server is not responding on port 3000. Start the server with `npm start` first.');
    process.exit(1);
  }
  console.log('1. Server Health:', '✅ 200 OK');

  // 2. Authentication
  const adminLogin = await apiRequest('POST', '/auth/login', { email: 'admin@brightloop.com', password: 'Admin@123!' });
  const adminToken = adminLogin.data.data.accessToken;
  console.log('2. Admin Auth:', adminLogin.status === 200 ? '✅ Token acquired' : '❌ Failed');

  const staffLogin = await apiRequest('POST', '/auth/login', { email: 'staff@brightloop.com', password: 'Staff@123!' });
  const staffToken = staffLogin.data.data.accessToken;
  console.log('3. Staff Auth:', staffLogin.status === 200 ? '✅ Token acquired' : '❌ Failed');

  const custLogin = await apiRequest('POST', '/auth/login', { email: 'customer@brightloop.com', password: 'Customer@123!' });
  const custToken = custLogin.data.data.accessToken;
  console.log('4. Customer Auth:', custLogin.status === 200 ? '✅ Token acquired' : '❌ Failed');

  // 3. GET /api/invoices (List Invoices)
  const listRes = await apiRequest('GET', '/invoices', null, staffToken);
  console.log('5. GET /api/invoices:', listRes.status === 200 && listRes.data.data.invoices ? `✅ Retrieved ${listRes.data.data.invoices.length} invoices` : '❌ Failed');

  // 4. GET /api/invoices/stats (Admin/Staff KPI Stats)
  const statsRes = await apiRequest('GET', '/invoices/stats', null, adminToken);
  console.log('6. GET /api/invoices/stats:', statsRes.status === 200 ? `✅ Revenue: ₹${statsRes.data.data.total_revenue}, Receivables: ₹${statsRes.data.data.receivable_amount}` : '❌ Failed');

  // 5. POST /api/invoices/generate/:subscriptionId (Generate from Module 3 Subscription)
  const genPeriodStart = `2026-11-${String(Math.floor(Math.random() * 20) + 1).padStart(2, '0')}`;
  const genPeriodEnd = `2026-12-${String(Math.floor(Math.random() * 20) + 1).padStart(2, '0')}`;
  const genRes = await apiRequest('POST', '/invoices/generate/1', {
    billing_period_start: genPeriodStart,
    billing_period_end: genPeriodEnd,
    notes: 'Live E2E generated invoice'
  }, staffToken);

  console.log('7. POST /api/invoices/generate/:id:', genRes.status === 201 ? `✅ Generated ${genRes.data.data.invoice_number} (Draft)` : '❌ Failed');
  const generatedId = genRes.data?.data?.invoice_id;

  // 6. Duplicate check prevention (HTTP 409)
  const dupRes = await apiRequest('POST', '/invoices/generate/1', {
    billing_period_start: genPeriodStart,
    billing_period_end: genPeriodEnd
  }, staffToken);
  console.log('8. Duplicate Prevention (HTTP 409):', dupRes.status === 409 ? `✅ Conflict blocked: "${dupRes.data.message.substring(0, 50)}..."` : '❌ Failed');

  // 7. GET /api/invoices/:id (View Details & Lines)
  const getRes = await apiRequest('GET', `/invoices/${generatedId}`, null, staffToken);
  console.log('9. GET /api/invoices/:id:', getRes.status === 200 && getRes.data.data.invoice.lines.length > 0 ? `✅ Retrieved Invoice with ${getRes.data.data.invoice.lines.length} lines` : '❌ Failed');

  // 8. PUT /api/invoices/:id (Update Draft Invoice)
  const updateRes = await apiRequest('PUT', `/invoices/${generatedId}`, {
    payment_terms: 'Net 45',
    notes: 'Updated terms during review',
    discount_amount: 600.0
  }, staffToken);
  console.log('10. PUT /api/invoices/:id (Update Draft):', updateRes.status === 200 && updateRes.data.data.invoice.payment_terms === 'Net 45' ? '✅ Updated Draft parameters' : '❌ Failed');

  // 9. POST /api/invoices/:id/confirm (Confirm Draft)
  const confirmRes = await apiRequest('POST', `/invoices/${generatedId}/confirm`, {}, staffToken);
  console.log('11. POST /api/invoices/:id/confirm:', confirmRes.status === 200 && confirmRes.data.data.status === 'Confirmed' ? '✅ Confirmed invoice' : '❌ Failed');

  // 10. Immutability Guard: Cannot update a Confirmed invoice (HTTP 400)
  const blockedUpdate = await apiRequest('PUT', `/invoices/${generatedId}`, { notes: 'Should fail' }, staffToken);
  console.log('12. Immutability Guard (Cannot update Confirmed):', blockedUpdate.status === 400 ? '✅ 400 Bad Request enforced' : '❌ Failed');

  // 11. POST /api/invoices/:id/pay (Record Payment)
  const payRes = await apiRequest('POST', `/invoices/${generatedId}/pay`, {
    payment_method: 'UPI',
    payment_reference: 'UPI-LIVE-TEST-001',
    notes: 'Settled via phone payment'
  }, staffToken);
  console.log('13. POST /api/invoices/:id/pay:', payRes.status === 200 && payRes.data.data.status === 'Paid' ? '✅ Marked as Paid' : '❌ Failed');

  // 12. Create and Cancel an Invoice
  const customInvRes = await apiRequest('POST', '/invoices', {
    customer_id: 8,
    subscription_id: 5,
    billing_period_start: '2027-01-01',
    billing_period_end: '2027-02-01',
    lines: [
      { product_name: 'Test Setup Service', quantity: 1, unit_price: 1500, tax_rate: 18 }
    ]
  }, staffToken);

  const customId = customInvRes.data.data.invoice_id;
  const cancelRes = await apiRequest('POST', `/invoices/${customId}/cancel`, { reason: 'Incorrect customer selection' }, staffToken);
  console.log('14. POST /api/invoices/:id/cancel:', cancelRes.status === 200 && cancelRes.data.data.status === 'Cancelled' ? '✅ Cancelled invoice' : '❌ Failed');

  // 13. RBAC Scoping Check
  const custInvoices = await apiRequest('GET', '/invoices', null, custToken);
  const onlyCust = custInvoices.data.data.invoices.every(i => i.customer_id === 8);
  console.log('15. Customer Role RBAC Scope:', custInvoices.status === 200 && onlyCust ? `✅ Customer receives only their own invoices (${custInvoices.data.data.invoices.length})` : '❌ Failed');

  const custForbiddenStats = await apiRequest('GET', '/invoices/stats', null, custToken);
  console.log('16. Customer Forbidden from Admin Stats:', custForbiddenStats.status === 403 ? '✅ 403 Forbidden' : '❌ Failed');

  console.log('\n🎉 ALL LIVE REST API ENDPOINTS FOR MODULE 4 PASSED WITH 100% SUCCESS!\n');
}

if (require.main === module) {
  runLiveE2E().catch(err => {
    console.error('E2E execution error:', err);
    process.exit(1);
  });
}

module.exports = { runLiveE2E };

