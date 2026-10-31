/**
 * Brightloop Software — Unified Pricing & Tax Engine
 * Consistent calculations across Products, Variants, Plans, Taxes, and Discounts.
 * Used internally and exposed for Subscription and Billing modules.
 */

const { db } = require('../config/database');

/**
 * Perform a complete price calculation with variant addition, plan settings, discount rules, and taxes.
 *
 * @param {Object} options
 * @param {number|string} options.product_id - Product ID or UUID
 * @param {number|string} [options.variant_id] - Optional Variant ID or UUID
 * @param {number|string} [options.plan_id] - Optional Subscription Plan ID or UUID
 * @param {number} [options.quantity=1] - Purchase quantity
 * @param {string} [options.discount_code] - Optional coupon / discount code
 * @param {number|string} [options.tax_id] - Optional specific tax rule ID or UUID (defaults to product tax)
 * @param {Date|string} [options.reference_date] - Date to evaluate discounts and plan expiry
 * @returns {Object} Calculation breakdown
 */
function calculatePrice({
  product_id,
  variant_id = null,
  plan_id = null,
  quantity = 1,
  discount_code = null,
  tax_id = null,
  reference_date = new Date()
}) {
  const qty = Math.max(1, parseInt(quantity, 10) || 1);
  const refDate = new Date(reference_date);
  const refDateStr = refDate.toISOString().split('T')[0];

  // 1. Fetch Product
  let product = null;
  if (typeof product_id === 'number' || !isNaN(Number(product_id))) {
    product = db.prepare('SELECT * FROM products WHERE id = ?').get(Number(product_id));
  } else if (typeof product_id === 'string') {
    product = db.prepare('SELECT * FROM products WHERE uuid = ?').get(product_id);
  }

  if (!product) {
    throw new Error('Product not found.');
  }

  // 2. Fetch Variant (if provided)
  let variant = null;
  let variantAdditionalPrice = 0.0;
  let variantCostExtra = 0.0;

  if (variant_id) {
    if (typeof variant_id === 'number' || !isNaN(Number(variant_id))) {
      variant = db.prepare('SELECT * FROM product_variants WHERE id = ? AND product_id = ?').get(Number(variant_id), product.id);
    } else {
      variant = db.prepare('SELECT * FROM product_variants WHERE uuid = ? AND product_id = ?').get(variant_id, product.id);
    }

    if (!variant) {
      throw new Error('Specified product variant not found or does not belong to this product.');
    }

    if (!variant.is_active) {
      throw new Error(`Variant "${variant.variant_name}" is currently inactive.`);
    }

    variantAdditionalPrice = parseFloat(variant.additional_price || 0);
    variantCostExtra = parseFloat(variant.cost_price_extra || 0);
  }

  // 3. Fetch Subscription Plan (if provided)
  let plan = null;
  let baseUnitPrice = parseFloat(product.sales_price || 0);

  if (plan_id) {
    if (typeof plan_id === 'number' || !isNaN(Number(plan_id))) {
      plan = db.prepare('SELECT * FROM subscription_plans WHERE id = ?').get(Number(plan_id));
    } else {
      plan = db.prepare('SELECT * FROM subscription_plans WHERE uuid = ?').get(plan_id);
    }

    if (!plan) {
      throw new Error('Subscription plan not found.');
    }

    // Check plan availability dates
    if (plan.start_date && refDateStr < plan.start_date) {
      throw new Error(`Plan "${plan.name}" is not active yet (Starts on ${plan.start_date}).`);
    }

    if (plan.end_date && refDateStr > plan.end_date) {
      if (plan.is_auto_close_on_expiry) {
        // Automatically mark as expired if not already
        db.prepare("UPDATE subscription_plans SET status = 'expired', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(plan.id);
      }
      throw new Error(`Plan "${plan.name}" expired on ${plan.end_date}.`);
    }

    if (plan.status !== 'active') {
      throw new Error(`Subscription plan "${plan.name}" is not active (Status: ${plan.status}).`);
    }

    // Minimum quantity enforcement
    if (qty < (plan.min_quantity || 1)) {
      throw new Error(`Minimum purchase quantity for plan "${plan.name}" is ${plan.min_quantity}. You entered ${qty}.`);
    }

    // If plan specifies a dedicated recurring price > 0, use it; otherwise use product base sales price
    if (parseFloat(plan.price) > 0) {
      baseUnitPrice = parseFloat(plan.price);
    }
  }

  // Unit price includes product/plan base price + variant additional price
  // Example: Base sales price (₹2,400) + Odoo variant additional price (₹560) = ₹2,960
  const effectiveUnitPrice = Number((baseUnitPrice + variantAdditionalPrice).toFixed(2));
  const subtotalBeforeDiscount = Number((effectiveUnitPrice * qty).toFixed(2));

  // 4. Discount Evaluation
  let discount = null;
  let discountAmount = 0.0;
  let discountApplied = false;
  let discountMessage = null;

  // Check explicit code first, or look for eligible auto-apply discounts
  if (discount_code && discount_code.trim()) {
    discount = db.prepare('SELECT * FROM discounts WHERE code = ? COLLATE NOCASE').get(discount_code.trim());
    if (!discount) {
      discountMessage = `Discount code "${discount_code}" does not exist.`;
    }
  } else {
    // Check for auto-apply discounts for this product/plan or general
    const autoDiscounts = db.prepare(`
      SELECT * FROM discounts
      WHERE is_active = 1
        AND is_auto_apply = 1
        AND (start_date IS NULL OR date(start_date) <= date(?))
        AND (end_date IS NULL OR date(end_date) >= date(?))
        AND (max_usage_limit IS NULL OR used_count < max_usage_limit)
        AND (
          applies_to = 'all'
          OR (applies_to = 'product' AND target_product_id = ?)
          OR (applies_to = 'plan' AND target_plan_id = ?)
        )
      ORDER BY value DESC
      LIMIT 1
    `).all(refDateStr, refDateStr, product.id, plan ? plan.id : -1);

    if (autoDiscounts.length > 0) {
      discount = autoDiscounts[0];
    }
  }

  if (discount) {
    const validation = evaluateDiscountEligibility(discount, {
      product_id: product.id,
      plan_id: plan ? plan.id : null,
      subtotal: subtotalBeforeDiscount,
      quantity: qty,
      refDateStr
    });

    if (validation.eligible) {
      discountApplied = true;
      if (discount.discount_type === 'percentage') {
        discountAmount = Number(((subtotalBeforeDiscount * parseFloat(discount.value)) / 100).toFixed(2));
      } else {
        // Fixed amount discount
        discountAmount = Number(Math.min(parseFloat(discount.value), subtotalBeforeDiscount).toFixed(2));
      }
      discountMessage = `Applied discount "${discount.name}" (${discount.discount_type === 'percentage' ? `${discount.value}%` : `₹${discount.value}`} off)`;
    } else {
      discountMessage = validation.reason;
    }
  }

  const taxableAmount = Number(Math.max(0, subtotalBeforeDiscount - discountAmount).toFixed(2));

  // 5. Tax Evaluation
  let tax = null;
  let effectiveTaxId = tax_id || product.tax_id;

  if (effectiveTaxId) {
    if (typeof effectiveTaxId === 'number' || !isNaN(Number(effectiveTaxId))) {
      tax = db.prepare('SELECT * FROM taxes WHERE id = ?').get(Number(effectiveTaxId));
    } else {
      tax = db.prepare('SELECT * FROM taxes WHERE uuid = ?').get(effectiveTaxId);
    }
  }

  let taxRate = 0.0;
  let taxAmount = 0.0;
  let taxName = 'No Tax';

  if (tax && tax.is_active) {
    taxName = tax.name;
    taxRate = parseFloat(tax.rate || 0);

    if (tax.tax_type === 'percentage') {
      taxAmount = Number(((taxableAmount * taxRate) / 100).toFixed(2));
    } else {
      // Fixed tax per line
      taxAmount = Number(parseFloat(tax.rate).toFixed(2));
    }
  }

  const finalTotal = Number((taxableAmount + taxAmount).toFixed(2));

  // 6. Cost & Margin Analysis
  const unitCostPrice = parseFloat(product.cost_price || 0) + variantCostExtra;
  const totalCost = Number((unitCostPrice * qty).toFixed(2));
  const estimatedProfit = Number((taxableAmount - totalCost).toFixed(2));
  const marginPercentage = taxableAmount > 0 ? Number(((estimatedProfit / taxableAmount) * 100).toFixed(2)) : 0;

  return {
    success: true,
    currency: 'INR',
    currency_symbol: '₹',
    calculation: {
      product: {
        id: product.id,
        uuid: product.uuid,
        name: product.name,
        type: product.product_type,
        base_sales_price: parseFloat(product.sales_price || 0),
        cost_price: parseFloat(product.cost_price || 0)
      },
      variant: variant ? {
        id: variant.id,
        uuid: variant.uuid,
        attribute_name: variant.attribute_name,
        variant_name: variant.variant_name,
        additional_price: variantAdditionalPrice,
        sku: variant.sku
      } : null,
      plan: plan ? {
        id: plan.id,
        uuid: plan.uuid,
        name: plan.name,
        code: plan.code,
        billing_frequency: plan.billing_frequency,
        min_quantity: plan.min_quantity,
        is_auto_close_on_expiry: Boolean(plan.is_auto_close_on_expiry),
        allow_early_closure: Boolean(plan.allow_early_closure),
        allow_pause: Boolean(plan.allow_pause),
        allow_renewal: Boolean(plan.allow_renewal)
      } : null,
      quantity: qty,
      pricing_breakdown: {
        base_unit_price: baseUnitPrice,
        variant_additional_price: variantAdditionalPrice,
        effective_unit_price: effectiveUnitPrice,
        gross_subtotal: subtotalBeforeDiscount,
        discount_amount: discountAmount,
        discount_applied: discountApplied,
        discount_details: discountApplied ? {
          id: discount.id,
          name: discount.name,
          code: discount.code,
          discount_type: discount.discount_type,
          value: parseFloat(discount.value)
        } : null,
        discount_message: discountMessage,
        taxable_amount: taxableAmount,
        tax_details: tax && tax.is_active ? {
          id: tax.id,
          name: tax.name,
          code: tax.code,
          rate: taxRate,
          tax_type: tax.tax_type,
          is_compound: Boolean(tax.is_compound)
        } : null,
        tax_amount: taxAmount,
        final_total: finalTotal
      },
      financial_metrics: {
        unit_cost: unitCostPrice,
        total_cost: totalCost,
        estimated_profit: estimatedProfit,
        margin_percentage: marginPercentage
      }
    }
  };
}

/**
 * Helper to validate discount rules.
 */
function evaluateDiscountEligibility(discount, { product_id, plan_id, subtotal, quantity, refDateStr }) {
  if (!discount.is_active) {
    return { eligible: false, reason: 'This discount code is currently inactive.' };
  }

  if (discount.start_date && refDateStr < discount.start_date) {
    return { eligible: false, reason: `This discount is not yet valid (Starts on ${discount.start_date}).` };
  }

  if (discount.end_date && refDateStr > discount.end_date) {
    return { eligible: false, reason: `This discount expired on ${discount.end_date}.` };
  }

  if (discount.max_usage_limit !== null && discount.max_usage_limit !== undefined) {
    if (discount.used_count >= discount.max_usage_limit) {
      return { eligible: false, reason: 'This discount has reached its maximum usage limit.' };
    }
  }

  if (discount.min_purchase_amount > 0 && subtotal < discount.min_purchase_amount) {
    return {
      eligible: false,
      reason: `Minimum purchase amount of ₹${discount.min_purchase_amount.toFixed(2)} required. Current subtotal is ₹${subtotal.toFixed(2)}.`
    };
  }

  if (discount.min_quantity > 1 && quantity < discount.min_quantity) {
    return {
      eligible: false,
      reason: `Minimum purchase quantity of ${discount.min_quantity} items required. Current quantity is ${quantity}.`
    };
  }

  if (discount.applies_to === 'product' && discount.target_product_id) {
    if (Number(discount.target_product_id) !== Number(product_id)) {
      return { eligible: false, reason: 'This discount is only applicable to a specific product.' };
    }
  }

  if (discount.applies_to === 'plan' && discount.target_plan_id) {
    if (!plan_id || Number(discount.target_plan_id) !== Number(plan_id)) {
      return { eligible: false, reason: 'This discount is only applicable to a specific subscription plan.' };
    }
  }

  return { eligible: true };
}

/**
 * Record discount usage when an order or subscription is completed.
 */
function recordDiscountUsage(discountId, userId = null, invoiceRef = null, discountAmount = 0.0) {
  const discount = db.prepare('SELECT id, max_usage_limit, used_count FROM discounts WHERE id = ?').get(discountId);
  if (!discount) return false;

  db.prepare(`
    UPDATE discounts
    SET used_count = used_count + 1, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(discountId);

  db.prepare(`
    INSERT INTO discount_usages (discount_id, user_id, invoice_ref, discount_amount)
    VALUES (?, ?, ?, ?)
  `).run(discountId, userId, invoiceRef, discountAmount);

  return true;
}

module.exports = {
  calculatePrice,
  evaluateDiscountEligibility,
  recordDiscountUsage
};
