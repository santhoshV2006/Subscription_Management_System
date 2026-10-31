/**
 * Comprehensive Automated Test Suite for Module 2:
 * Products, Plans, Variants, Taxes and Discounts
 */
const { db, checkAndCloseExpiredPlans } = require('./config/database');
const { seedAllMockData } = require('./seed_mock_data');
const { calculatePrice, evaluateDiscountEligibility, recordDiscountUsage } = require('./utils/pricingEngine');

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${testName} - ${details}`);
    failedTests++;
  }
}

async function runTests() {
  console.log('\n🧪 Running Test Suite: Brightloop Module 2...\n');

  try {
    await seedAllMockData();
    // 1. Product & Variant Surcharge Test (Odoo brand adds ₹560)
    console.log('--- 1. Product & Variant Additional Price ---');
    const erpProduct = db.prepare("SELECT * FROM products WHERE name = 'Cloud ERP Suite'").get();
    assert(!!erpProduct, 'Product "Cloud ERP Suite" exists in database');
    assert(erpProduct.sales_price === 2400.0, 'Base sales price is ₹2,400.00');

    const odooVariant = db.prepare("SELECT * FROM product_variants WHERE product_id = ? AND variant_name = 'Odoo Edition'").get(erpProduct.id);
    assert(!!odooVariant, 'Variant "Odoo Edition" exists for Cloud ERP Suite');
    assert(odooVariant.additional_price === 560.0, 'Odoo variant additional price is ₹560.00');

    // Calculate price with Odoo variant
    const odooCalculation = calculatePrice({
      product_id: erpProduct.id,
      variant_id: odooVariant.id,
      quantity: 1,
      tax_id: erpProduct.tax_id
    });

    const breakdown = odooCalculation.calculation.pricing_breakdown;
    assert(breakdown.base_unit_price === 2400.0, 'Base unit price is ₹2,400.00');
    assert(breakdown.variant_additional_price === 560.0, 'Variant additional price is ₹560.00');
    assert(breakdown.effective_unit_price === 2960.0, 'Effective unit price is ₹2,960.00 (2400 + 560)');
    assert(breakdown.gross_subtotal === 2960.0, 'Gross subtotal for 1 qty is ₹2,960.00');

    // 2. Multi-quantity and GST 18% Tax Accuracy
    console.log('\n--- 2. Multi-quantity and Tax Calculation Accuracy ---');
    const multiQtyCalc = calculatePrice({
      product_id: erpProduct.id,
      variant_id: odooVariant.id,
      quantity: 3,
      tax_id: erpProduct.tax_id
    });
    const multiBreakdown = multiQtyCalc.calculation.pricing_breakdown;
    // Effective unit: 2960. Gross for 3 = 8880. Auto-apply discount AUTOSAVE5 (5%) = 444. Taxable = 8436. GST 18% = 1518.48. Total = 9954.48
    assert(multiBreakdown.gross_subtotal === 8880.0, 'Gross subtotal for 3 units is ₹8,880.00');
    assert(multiBreakdown.tax_details.rate === 18.0, 'Tax applied is GST 18%');
    const expectedTax = Number(((multiBreakdown.taxable_amount * 18.0) / 100).toFixed(2));
    assert(multiBreakdown.tax_amount === expectedTax, `Tax amount ₹${multiBreakdown.tax_amount} matches expected ₹${expectedTax}`);
    assert(multiBreakdown.final_total === Number((multiBreakdown.taxable_amount + expectedTax).toFixed(2)), 'Final total = Taxable Amount + Tax Amount');

    // 3. Discount Management Tests
    console.log('\n--- 3. Discount Management Tests ---');
    // 3a. Percentage discount with coupon code "BRIGHT20"
    const discountCalc20 = calculatePrice({
      product_id: erpProduct.id,
      variant_id: odooVariant.id,
      quantity: 1,
      discount_code: 'BRIGHT20',
      tax_id: erpProduct.tax_id
    });
    const d20Breakdown = discountCalc20.calculation.pricing_breakdown;
    assert(d20Breakdown.discount_applied === true, 'Discount BRIGHT20 applied successfully');
    assert(d20Breakdown.discount_amount === Number(((2960.0 * 20) / 100).toFixed(2)), '20% discount on ₹2,960 is ₹592.00');
    assert(d20Breakdown.taxable_amount === 2368.0, 'Taxable amount is ₹2,368.00 (2960 - 592)');

    // 3b. Fixed amount discount "FLAT500"
    const discountCalcFlat = calculatePrice({
      product_id: erpProduct.id,
      variant_id: odooVariant.id,
      quantity: 1,
      discount_code: 'FLAT500',
      tax_id: erpProduct.tax_id
    });
    const flatBreakdown = discountCalcFlat.calculation.pricing_breakdown;
    assert(flatBreakdown.discount_applied === true, 'Discount FLAT500 applied successfully');
    assert(flatBreakdown.discount_amount === 500.0, 'Fixed discount amount is ₹500.00');
    assert(flatBreakdown.taxable_amount === 2460.0, 'Taxable amount is ₹2,460.00 (2960 - 500)');

    // 3c. Minimum Purchase Condition Check
    console.log('\n--- 4. Discount Conditions: Min Purchase & Min Quantity ---');
    // FLAT500 requires min purchase ₹2500. Let's test with a cheap item (API pack ₹499)
    const cheapProduct = db.prepare("SELECT * FROM products WHERE name = 'API Integration Expansion Pack'").get();
    const minPurchaseFail = calculatePrice({
      product_id: cheapProduct.id,
      quantity: 1,
      discount_code: 'FLAT500'
    });
    assert(
      minPurchaseFail.calculation.pricing_breakdown.discount_applied === false,
      'FLAT500 rejected when order amount (₹499) is below min purchase (₹2500)'
    );

    // 3d. Minimum Quantity Condition Check
    // ERPSPECIAL requires min quantity of 2
    const minQtyFail = calculatePrice({
      product_id: erpProduct.id,
      quantity: 1,
      discount_code: 'ERPSPECIAL'
    });
    assert(
      minQtyFail.calculation.pricing_breakdown.discount_applied === false,
      'ERPSPECIAL rejected when quantity is 1 (min quantity is 2)'
    );

    const minQtyPass = calculatePrice({
      product_id: erpProduct.id,
      quantity: 2,
      discount_code: 'ERPSPECIAL'
    });
    assert(
      minQtyPass.calculation.pricing_breakdown.discount_applied === true,
      'ERPSPECIAL applied when quantity is >= 2'
    );

    // 3e. Expired Discount Stop
    console.log('\n--- 5. Expired and Limit-Reached Discounts ---');
    const expiredCalc = calculatePrice({
      product_id: erpProduct.id,
      quantity: 2,
      discount_code: 'DIWALI2023'
    });
    assert(
      expiredCalc.calculation.pricing_breakdown.discount_applied === false,
      'Expired discount DIWALI2023 is stopped and rejected'
    );

    // 3f. Max Usage Limit Reached Stop
    const maxedCalc = calculatePrice({
      product_id: erpProduct.id,
      quantity: 2,
      discount_code: 'FLASH50'
    });
    assert(
      maxedCalc.calculation.pricing_breakdown.discount_applied === false,
      'Discount FLASH50 rejected because max usage limit (10/10) is reached'
    );

    // 4. Subscription Plan Billing Frequencies & Settings
    console.log('\n--- 6. Subscription Plan Management ---');
    const plans = db.prepare('SELECT billing_frequency, COUNT(*) as c FROM subscription_plans GROUP BY billing_frequency').all();
    const frequencies = plans.map(p => p.billing_frequency);
    assert(frequencies.includes('daily'), 'Daily billing frequency supported');
    assert(frequencies.includes('weekly'), 'Weekly billing frequency supported');
    assert(frequencies.includes('monthly'), 'Monthly billing frequency supported');
    assert(frequencies.includes('yearly'), 'Yearly billing frequency supported');

    // 4a. Minimum purchase quantity for team plan (min_quantity = 3)
    const teamPlan = db.prepare("SELECT * FROM subscription_plans WHERE code = 'PLAN-ERP-TEAM'").get();
    assert(teamPlan.min_quantity === 3, 'Team plan requires min_quantity of 3');

    let threwMinQty = false;
    try {
      calculatePrice({
        product_id: erpProduct.id,
        plan_id: teamPlan.id,
        quantity: 2
      });
    } catch (err) {
      threwMinQty = true;
      assert(err.message.includes('Minimum purchase quantity'), `Threw expected error: "${err.message}"`);
    }
    assert(threwMinQty, 'calculatePrice enforces plan minimum quantity constraint');

    // 4b. Automatic plan closure on expiry check
    console.log('\n--- 7. Automatic Plan Closure on Expiry ---');
    checkAndCloseExpiredPlans();
    const expiredPlan = db.prepare("SELECT * FROM subscription_plans WHERE code = 'PLAN-LEGACY-2023'").get();
    assert(expiredPlan.status === 'expired', 'Legacy 2023 plan status is "expired" due to auto-close');

    // 4c. Early closure & pause settings validation
    const annualPlan = db.prepare("SELECT * FROM subscription_plans WHERE billing_frequency = 'yearly'").get();
    assert(annualPlan.allow_early_closure === 0, 'Annual plan configures allow_early_closure = 0');
    assert(annualPlan.allow_pause === 1, 'Annual plan configures allow_pause = 1');
    assert(annualPlan.allow_renewal === 1, 'Annual plan configures allow_renewal = 1');

    console.log('\n=======================================');
    console.log(`Results: ${passedTests} passed, ${failedTests} failed.`);
    console.log('=======================================\n');

    if (failedTests > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Fatal test execution error:', error);
    process.exit(1);
  }
}

runTests();
