/**
 * Test Suite for Module 4 Feature 5: Financial Dashboard & Reports
 * Live API tests against the running Express server.
 *
 * Run with: node backend/test_module5_api.js
 */

const http = require('http');

const PORT = process.env.PORT || 3000;

let adminToken = '';
let staffToken = '';
let customerToken = '';
let passed = 0;
let failed = 0;

function assert(condition, name, detail = '') {
  if (condition) { console.log(`  ✅ ${name}`); passed++; }
  else           { console.error(`  ❌ ${name}${detail ? ' — ' + detail : ''}`); failed++; }
}

function apiRequest(method, path, body = null, token = null, raw = false) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const reqOpts = {
      hostname: 'localhost', port: PORT,
      path: `/api${path}`, method,
      headers: {
        'Content-Type': 'application/json',
        ...(data  ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    };
    const req = http.request(reqOpts, res => {
      let rb = '';
      res.on('data', c => { rb += c; });
      res.on('end', () => {
        if (raw) { resolve({ status: res.statusCode, body: rb, headers: res.headers }); return; }
        try   { resolve({ status: res.statusCode, ...JSON.parse(rb) }); }
        catch { resolve({ status: res.statusCode, raw: rb }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function runTests() {
  console.log('\n🌐 Testing Live Brightloop REST APIs for Module 4 Feature 5 (Financial Dashboard)...\n');

  // ── 1. Health check ───────────────────────────────────────────────────────────
  const health = await apiRequest('GET', '/health');
  if (health.status !== 200) {
    console.error('❌ Server is not running on port 3000. Start server first.');
    process.exit(1);
  }
  console.log('1. Server Health: ✅ 200 OK');

  // ── 2. Authentication ─────────────────────────────────────────────────────────
  const aRes = await apiRequest('POST', '/auth/login', { email: 'admin@brightloop.com',   password: 'Admin@123!' });
  adminToken = aRes.data?.accessToken || '';
  console.log('2. Admin Auth:', adminToken ? '✅ Token acquired' : '❌ Failed');

  const sRes = await apiRequest('POST', '/auth/login', { email: 'staff@brightloop.com',   password: 'Staff@123!' });
  staffToken = sRes.data?.accessToken || '';
  console.log('3. Staff Auth:', staffToken ? '✅ Token acquired' : '❌ Failed');

  const cRes = await apiRequest('POST', '/auth/login', { email: 'customer@brightloop.com', password: 'Customer@123!' });
  customerToken = cRes.data?.accessToken || '';
  console.log('4. Customer Auth:', customerToken ? '✅ Token acquired' : '❌ Failed');

  if (!adminToken) { console.error('Cannot continue without admin token.'); process.exit(1); }

  // ── 3. KPI Endpoint ──────────────────────────────────────────────────────────
  console.log('\n5. GET /api/financial/kpis:');
  const kpi = await apiRequest('GET', '/financial/kpis', null, adminToken);
  assert(kpi.status === 200 && kpi.success, 'KPIs returns 200', `status=${kpi.status}`);
  assert(typeof kpi.data?.total_invoices === 'number',          '  total_invoices is a number');
  assert(typeof kpi.data?.total_invoiced === 'number',          '  total_invoiced is a number');
  assert(typeof kpi.data?.total_collected === 'number',         '  total_collected is a number');
  assert(typeof kpi.data?.outstanding_amount === 'number',      '  outstanding_amount is a number');
  assert(typeof kpi.data?.overdue_amount === 'number',          '  overdue_amount is a number');
  assert(typeof kpi.data?.total_payments_received === 'number', '  total_payments_received is a number');
  console.log(`     total_invoices=${kpi.data.total_invoices}, collected=₹${kpi.data.total_collected}, outstanding=₹${kpi.data.outstanding_amount}`);

  // ── 4. KPI with date period filters ──────────────────────────────────────────
  console.log('\n6. KPI Date Period Filters:');
  const kpiMonth = await apiRequest('GET', '/financial/kpis?period=this_month', null, adminToken);
  assert(kpiMonth.status === 200 && kpiMonth.success, '  period=this_month');
  assert(kpiMonth.filters?.period === 'this_month', '  filters.period echoed back');

  const kpiLastM = await apiRequest('GET', '/financial/kpis?period=last_month', null, adminToken);
  assert(kpiLastM.status === 200 && kpiLastM.success, '  period=last_month');

  const kpiYear = await apiRequest('GET', '/financial/kpis?period=this_year', null, adminToken);
  assert(kpiYear.status === 200 && kpiYear.success, '  period=this_year');

  const kpiCustom = await apiRequest('GET', '/financial/kpis?start_date=2026-01-01&end_date=2026-12-31', null, adminToken);
  assert(kpiCustom.status === 200 && kpiCustom.success, '  custom date range start_date/end_date');

  // ── 5. Monthly Revenue Trend ──────────────────────────────────────────────────
  console.log('\n7. GET /api/financial/monthly-revenue:');
  const monthly = await apiRequest('GET', '/financial/monthly-revenue', null, adminToken);
  assert(monthly.status === 200 && monthly.success, '  Returns 200');
  assert(Array.isArray(monthly.data), '  Data is array');
  if (monthly.data.length > 0) {
    const f = monthly.data[0];
    assert(f.month && f.revenue !== undefined && f.invoice_count !== undefined, '  Row has month, revenue, invoice_count');
    console.log(`     ${monthly.data.length} months of data. Latest: ${monthly.data.at(-1)?.month} → ₹${monthly.data.at(-1)?.revenue}`);
  }

  // ── 6. Paid vs Unpaid ─────────────────────────────────────────────────────────
  console.log('\n8. GET /api/financial/paid-vs-unpaid:');
  const pvU = await apiRequest('GET', '/financial/paid-vs-unpaid', null, adminToken);
  assert(pvU.status === 200 && pvU.success, '  Returns 200');
  assert(pvU.data?.paid !== undefined,      '  paid key present');
  assert(pvU.data?.confirmed !== undefined, '  confirmed key present');
  assert(pvU.data?.draft !== undefined,     '  draft key present');
  assert(pvU.data?.cancelled !== undefined, '  cancelled key present');

  // ── 7. Revenue by Payment Method ─────────────────────────────────────────────
  console.log('\n9. GET /api/financial/revenue-by-method:');
  const method = await apiRequest('GET', '/financial/revenue-by-method', null, adminToken);
  assert(method.status === 200 && method.success, '  Returns 200');
  assert(Array.isArray(method.data), '  Data is array');
  if (method.data.length > 0) {
    const m = method.data[0];
    assert(m.method && m.payment_count !== undefined && m.total_collected !== undefined, '  Row has method, payment_count, total_collected');
    console.log(`     Methods found: ${method.data.map(d => d.method).join(', ')}`);
  }

  // ── 8. Status Distribution ────────────────────────────────────────────────────
  console.log('\n10. GET /api/financial/status-distribution:');
  const dist = await apiRequest('GET', '/financial/status-distribution', null, adminToken);
  assert(dist.status === 200 && dist.success, '  Returns 200');
  assert(Array.isArray(dist.data) && dist.data.length > 0, '  Non-empty data array');
  assert(typeof dist.total_invoices === 'number', '  total_invoices count returned');
  const hasPercentage = dist.data.every(r => r.percentage !== undefined);
  assert(hasPercentage, '  Every row has percentage field');
  const pctSum = dist.data.reduce((s, r) => s + r.percentage, 0);
  assert(Math.abs(pctSum - 100) < 2, `  Percentages sum to ~100% (${pctSum.toFixed(1)}%)`);

  // ── 9. Invoice Report ─────────────────────────────────────────────────────────
  console.log('\n11. GET /api/financial/report/invoices:');
  const invRpt = await apiRequest('GET', '/financial/report/invoices?limit=50', null, adminToken);
  assert(invRpt.status === 200 && invRpt.success, '  Returns 200');
  assert(Array.isArray(invRpt.data?.invoices), '  invoices array present');
  assert(typeof invRpt.data?.total === 'number', '  total count present');
  console.log(`     ${invRpt.data.total} total invoices`);

  const invPaid = await apiRequest('GET', '/financial/report/invoices?status=Paid', null, adminToken);
  assert(invPaid.success, '  Filter by status=Paid works');
  const allPaid = (invPaid.data?.invoices || []).every(r => r.status === 'Paid');
  assert(allPaid, '  All returned rows have status=Paid');

  // CSV Export
  const invCsv = await apiRequest('GET', '/financial/report/invoices?export=csv&limit=10000', null, adminToken, true);
  assert(invCsv.status === 200, '  CSV export returns 200');
  assert(invCsv.headers['content-type']?.includes('text/csv'), '  Content-Type is text/csv');
  assert(invCsv.headers['content-disposition']?.includes('.csv'), '  Content-Disposition includes filename');
  const csvLines = invCsv.body.split('\n').filter(Boolean);
  assert(csvLines.length >= 2, `  CSV has header + data rows (${csvLines.length} lines)`);
  assert(csvLines[0].includes('invoice_number'), '  CSV header has invoice_number column');

  // ── 10. Payment Report ────────────────────────────────────────────────────────
  console.log('\n12. GET /api/financial/report/payments:');
  const payRpt = await apiRequest('GET', '/financial/report/payments?limit=50', null, adminToken);
  assert(payRpt.status === 200 && payRpt.success, '  Returns 200');
  assert(typeof payRpt.data?.summary?.total_collected === 'number', '  summary.total_collected is a number');
  assert(typeof payRpt.data?.summary?.payment_count  === 'number', '  summary.payment_count is a number');
  console.log(`     ${payRpt.data.summary.payment_count} payments, ₹${payRpt.data.summary.total_collected} collected`);

  const payCsv = await apiRequest('GET', '/financial/report/payments?export=csv', null, adminToken, true);
  assert(payCsv.status === 200 && payCsv.headers['content-type']?.includes('text/csv'), '  Payment CSV export works');

  // ── 11. Outstanding Report ────────────────────────────────────────────────────
  console.log('\n13. GET /api/financial/report/outstanding:');
  const outRpt = await apiRequest('GET', '/financial/report/outstanding', null, adminToken);
  assert(outRpt.status === 200 && outRpt.success, '  Returns 200');
  assert(Array.isArray(outRpt.data?.invoices), '  invoices array present');
  assert(typeof outRpt.data?.summary?.total_outstanding === 'number', '  total_outstanding is a number');
  const allPosBal = (outRpt.data?.invoices || []).every(r => r.balance_due > 0);
  assert(allPosBal, '  All outstanding rows have balance_due > 0');

  const outCsv = await apiRequest('GET', '/financial/report/outstanding?export=csv', null, adminToken, true);
  assert(outCsv.status === 200 && outCsv.headers['content-type']?.includes('text/csv'), '  Outstanding CSV export works');

  // ── 12. Overdue Report ────────────────────────────────────────────────────────
  console.log('\n14. GET /api/financial/report/overdue:');
  const ovRpt = await apiRequest('GET', '/financial/report/overdue', null, adminToken);
  assert(ovRpt.status === 200 && ovRpt.success, '  Returns 200');
  assert(Array.isArray(ovRpt.data?.invoices), '  invoices array present');
  assert(typeof ovRpt.data?.summary?.total_overdue === 'number', '  total_overdue is a number');
  if (ovRpt.data.invoices.length > 0) {
    const allDays = ovRpt.data.invoices.every(r => typeof r.days_overdue === 'number' && r.days_overdue > 0);
    assert(allDays, '  All overdue rows have positive days_overdue');
  }

  const ovCsv = await apiRequest('GET', '/financial/report/overdue?export=csv', null, adminToken, true);
  assert(ovCsv.status === 200 && ovCsv.headers['content-type']?.includes('text/csv'), '  Overdue CSV export works');

  // ── 13. Customer Revenue Report ───────────────────────────────────────────────
  console.log('\n15. GET /api/financial/report/customer-revenue:');
  const custRpt = await apiRequest('GET', '/financial/report/customer-revenue', null, adminToken);
  assert(custRpt.status === 200 && custRpt.success, '  Returns 200');
  assert(Array.isArray(custRpt.data?.customers), '  customers array present');
  assert(typeof custRpt.data?.summary?.total_collected === 'number', '  summary.total_collected is a number');
  const validRows = (custRpt.data?.customers || []).every(r =>
    r.customer_name && r.total_invoices !== undefined && r.total_collected !== undefined && r.outstanding !== undefined
  );
  assert(validRows, '  All rows have name, total_invoices, total_collected, outstanding');
  console.log(`     ${custRpt.data.customers.length} customers, grand collected ₹${custRpt.data.summary.total_collected}`);

  const custCsv = await apiRequest('GET', '/financial/report/customer-revenue?export=csv', null, adminToken, true);
  assert(custCsv.status === 200 && custCsv.headers['content-type']?.includes('text/csv'), '  Customer revenue CSV export works');

  // ── 14. RBAC: Customer blocked ────────────────────────────────────────────────
  console.log('\n16. RBAC: Customer blocked from all financial endpoints:');
  const rbacKPI     = await apiRequest('GET', '/financial/kpis', null, customerToken);
  assert(rbacKPI.status === 403, '  Customer blocked from /financial/kpis (403)');
  const rbacMonthly = await apiRequest('GET', '/financial/monthly-revenue', null, customerToken);
  assert(rbacMonthly.status === 403, '  Customer blocked from monthly-revenue (403)');
  const rbacRpt     = await apiRequest('GET', '/financial/report/invoices', null, customerToken);
  assert(rbacRpt.status === 403, '  Customer blocked from invoice report (403)');

  // ── 15. Staff access allowed ──────────────────────────────────────────────────
  console.log('\n17. Staff has access to all financial endpoints:');
  const staffKPI = await apiRequest('GET', '/financial/kpis', null, staffToken);
  assert(staffKPI.status === 200 && staffKPI.success, '  Staff can access KPIs');
  const staffRpt = await apiRequest('GET', '/financial/report/invoices', null, staffToken);
  assert(staffRpt.status === 200 && staffRpt.success, '  Staff can access invoice report');

  // ── 16. Unauthenticated blocked ───────────────────────────────────────────────
  console.log('\n18. Unauthenticated requests blocked:');
  const unauth = await apiRequest('GET', '/financial/kpis', null, null);
  assert(unauth.status === 401, '  No token → 401');

  // ── 17. Data integrity cross-check ───────────────────────────────────────────
  console.log('\n19. Data Integrity Cross-checks:');

  const legacyStats = await apiRequest('GET', '/invoices/stats', null, adminToken);
  const legacyRevenue = legacyStats.success ? legacyStats.data.total_revenue : -1;
  const finCollected  = kpi.data?.total_collected ?? -99;
  assert(Math.abs(legacyRevenue - finCollected) < 0.01,
    `  financial KPI collected (₹${finCollected}) matches legacy invoice stats (₹${legacyRevenue})`);

  const pvuPaidTotal  = pvU.data?.paid?.total_value ?? -1;
  const distPaidTotal = dist.data.find(r => r.status === 'Paid')?.total_value ?? -99;
  assert(Math.abs(pvuPaidTotal - distPaidTotal) < 0.01,
    `  Paid totals consistent: paid-vs-unpaid (₹${pvuPaidTotal}) = status-distribution (₹${distPaidTotal})`);

  // ── Summary ───────────────────────────────────────────────────────────────────
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log(`Results: ${passed} passed, ${failed} failed.`);
  if (failed === 0) {
    console.log('🎉 ALL LIVE API ENDPOINTS FOR FINANCIAL DASHBOARD PASSED WITH 100% SUCCESS!');
  } else {
    console.error(`❌ ${failed} test(s) FAILED.`);
  }
  console.log('════════════════════════════════════════════════════════════════\n');

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
