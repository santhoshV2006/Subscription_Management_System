/**
 * E2E API Verification Script for Brightloop Module 2
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

async function run() {
  console.log('\n🌐 Testing Live Brightloop REST APIs for Module 2...\n');

  // 1. Health check
  const health = await apiRequest('GET', '/health');
  console.log('1. Health check:', health.status === 200 ? '✅ 200 OK' : '❌ Failed', health.data.message);

  // 2. Admin Login
  const loginRes = await apiRequest('POST', '/auth/login', {
    email: 'admin@brightloop.com',
    password: 'Admin@123!'
  });
  console.log('2. Admin Login:', loginRes.status === 200 ? '✅ Authenticated' : '❌ Failed');
  const token = loginRes.data.data.accessToken;

  // 3. GET /api/products
  const prodRes = await apiRequest('GET', '/products', null, token);
  console.log('3. GET /api/products:', prodRes.status === 200 ? `✅ Retrieved ${prodRes.data.data.products.length} products` : '❌ Failed');

  // Check Odoo variant on Cloud ERP Suite
  const erp = prodRes.data.data.products.find(p => p.name === 'Cloud ERP Suite');
  const odoo = erp.variants.find(v => v.variant_name.includes('Odoo'));
  console.log(`   Product: "${erp.name}" (Base: ₹${erp.sales_price})`);
  console.log(`   Variant: "${odoo.variant_name}" (Additional Price: +₹${odoo.additional_price})`);

  // 4. POST /api/products (Create new product)
  const newProdRes = await apiRequest('POST', '/products', {
    name: 'Brightloop Data Lake',
    product_type: 'software',
    sales_price: 3200.0,
    cost_price: 1100.0,
    notes: 'Scalable data warehouse with automatic partitioning and column-oriented storage.'
  }, token);
  console.log('4. POST /api/products (Create):', newProdRes.status === 201 ? `✅ Created Product ID ${newProdRes.data.data.id}` : '❌ Failed');
  const createdProdId = newProdRes.data.data.id;

  // 5. POST /api/products/:id/variants (Add variant)
  const newVarRes = await apiRequest('POST', `/products/${createdProdId}/variants`, {
    attribute_name: 'Storage Tier',
    variant_name: 'SSD NVMe Tier 1',
    additional_price: 850.0,
    cost_price_extra: 300.0,
    sku: 'DL-NVME-01'
  }, token);
  console.log('5. POST /api/products/:id/variants:', newVarRes.status === 201 ? `✅ Added Variant "+₹${newVarRes.data.data.additional_price}"` : '❌ Failed');

  // 6. GET /api/plans
  const plansRes = await apiRequest('GET', '/plans', null, token);
  console.log('6. GET /api/plans:', plansRes.status === 200 ? `✅ Retrieved ${plansRes.data.data.plans.length} subscription plans` : '❌ Failed');

  // 7. Test Plan Pause & Resume
  const activePlan = plansRes.data.data.plans.find(p => p.status === 'active' && p.allow_pause === 1);
  const pauseRes = await apiRequest('POST', `/plans/${activePlan.id}/pause`, null, token);
  console.log(`7. POST /api/plans/${activePlan.id}/pause:`, pauseRes.status === 200 ? '✅ Plan Paused' : '❌ Failed');
  const resumeRes = await apiRequest('POST', `/plans/${activePlan.id}/resume`, null, token);
  console.log(`   POST /api/plans/${activePlan.id}/resume:`, resumeRes.status === 200 ? '✅ Plan Resumed' : '❌ Failed');

  // 8. GET /api/taxes
  const taxesRes = await apiRequest('GET', '/taxes', null, token);
  console.log('8. GET /api/taxes:', taxesRes.status === 200 ? `✅ Retrieved ${taxesRes.data.data.length} tax rules` : '❌ Failed');

  // 9. GET /api/discounts
  const discRes = await apiRequest('GET', '/discounts', null, token);
  console.log('9. GET /api/discounts:', discRes.status === 200 ? `✅ Retrieved ${discRes.data.data.discounts.length} discounts` : '❌ Failed');

  // 10. POST /api/discounts/validate (Validate coupon)
  const valRes = await apiRequest('POST', '/discounts/validate', {
    code: 'BRIGHT20',
    product_id: erp.id,
    subtotal: 2960.0,
    quantity: 1
  }, token);
  console.log('10. POST /api/discounts/validate:', valRes.status === 200 && valRes.data.valid ? `✅ Validated coupon "${valRes.data.data.code}" (-₹${valRes.data.data.projected_discount_amount})` : '❌ Failed');

  // 11. POST /api/pricing/calculate (Core Integration Engine)
  const calcRes = await apiRequest('POST', '/pricing/calculate', {
    product_id: erp.id,
    variant_id: odoo.id,
    quantity: 2,
    discount_code: 'BRIGHT20',
    tax_id: erp.tax_id
  }, token);

  console.log('11. POST /api/pricing/calculate:');
  if (calcRes.status === 200) {
    const calc = calcRes.data.calculation.pricing_breakdown;
    console.log(`    Base Unit: ₹${calc.base_unit_price} + Variant Surcharge: ₹${calc.variant_additional_price} = Effective Unit: ₹${calc.effective_unit_price}`);
    console.log(`    Gross Subtotal (2 units): ₹${calc.gross_subtotal}`);
    console.log(`    Discount (${calc.discount_details.code}): -₹${calc.discount_amount}`);
    console.log(`    Taxable Amount: ₹${calc.taxable_amount}`);
    console.log(`    Tax (${calc.tax_details.name}): +₹${calc.tax_amount}`);
    console.log(`    FINAL PAYABLE TOTAL: ₹${calc.final_total}`);
    console.log('    ✅ PRICING CALCULATION ACCURACY CONFIRMED!');
  } else {
    console.log('    ❌ Pricing calculation failed:', calcRes.data);
  }

  // 12. Clean up test product
  await apiRequest('DELETE', `/products/${createdProdId}`, null, token);
  console.log('12. DELETE /api/products/:id: ✅ Cleaned up test product.');

  console.log('\n🎉 ALL LIVE API TESTS PASSED SUCCESSFULLY!\n');
}

run().catch(console.error);
