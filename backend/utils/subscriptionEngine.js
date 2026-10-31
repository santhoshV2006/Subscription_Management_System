/**
 * Brightloop Software — Subscription & Quotation Calculation & Lifecycle Engine
 * Handles multi-line pricing, expiry computation, number generation, and state transitions.
 */

const { db } = require('../config/database');
const { evaluateDiscountEligibility } = require('./pricingEngine');

/**
 * Generate next unique sequential number with prefix.
 * e.g., SUB-2026-00001 or QT-2026-00001
 */
function generateDocumentNumber(prefix = 'SUB') {
  const year = new Date().getFullYear();
  const pattern = `${prefix}-${year}-%`;

  let maxNum = 0;
  if (prefix === 'SUB') {
    const row = db.prepare(`
      SELECT subscription_number as doc_num FROM subscriptions 
      WHERE subscription_number LIKE ? 
      ORDER BY id DESC LIMIT 1
    `).get(pattern);
    if (row && row.doc_num) {
      const parts = row.doc_num.split('-');
      if (parts.length === 3) maxNum = parseInt(parts[2], 10) || 0;
    }
  } else if (prefix === 'QT') {
    const row = db.prepare(`
      SELECT quotation_number as doc_num FROM quotations 
      WHERE quotation_number LIKE ? 
      ORDER BY id DESC LIMIT 1
    `).get(pattern);
    if (row && row.doc_num) {
      const parts = row.doc_num.split('-');
      if (parts.length === 3) maxNum = parseInt(parts[2], 10) || 0;
    }
  }

  const nextSeq = String(maxNum + 1).padStart(5, '0');
  return `${prefix}-${year}-${nextSeq}`;
}

/**
 * Calculate expiry date based on start date and billing frequency.
 * frequencies: 'daily', 'weekly', 'monthly', 'yearly'
 */
function calculateExpiryDate(startDateStr, billingFrequency = 'monthly') {
  const date = startDateStr ? new Date(startDateStr) : new Date();
  
  switch (billingFrequency.toLowerCase()) {
    case 'daily':
      date.setDate(date.getDate() + 1);
      break;
    case 'weekly':
      date.setDate(date.getDate() + 7);
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + 1);
      break;
    case 'yearly':
      date.setFullYear(date.getFullYear() + 1);
      break;
    default:
      date.setMonth(date.getMonth() + 1);
      break;
  }

  return date.toISOString().split('T')[0];
}

/**
 * Perform complete multi-line subscription or quotation calculation.
 *
 * @param {Object} options
 * @param {number|string} options.plan_id
 * @param {Array} options.lines - Array of { product_id, variant_id, quantity }
 * @param {string} [options.discount_code]
 * @param {string} [options.start_date]
 * @returns {Object} Calculated line items and totals
 */
function calculateSubscriptionDetails({
  plan_id,
  lines = [],
  discount_code = null,
  start_date = null
}) {
  if (!plan_id) {
    throw new Error('A valid subscription plan is required.');
  }

  if (!Array.isArray(lines) || lines.length === 0) {
    throw new Error('At least one product line is required.');
  }

  // 1. Fetch Plan
  const plan = typeof plan_id === 'number' || !isNaN(Number(plan_id))
    ? db.prepare('SELECT * FROM subscription_plans WHERE id = ?').get(Number(plan_id))
    : db.prepare('SELECT * FROM subscription_plans WHERE uuid = ?').get(plan_id);

  if (!plan) {
    throw new Error('Subscription plan not found.');
  }

  if (plan.status !== 'active') {
    throw new Error(`Plan "${plan.name}" is not active (Status: ${plan.status}).`);
  }

  // Calculate start & expiry dates
  const todayStr = new Date().toISOString().split('T')[0];
  const startDate = start_date || todayStr;
  const expiryDate = calculateExpiryDate(startDate, plan.billing_frequency);

  // 2. Process each line item
  let totalQuantity = 0;
  let rawSubtotal = 0.0;
  let totalTaxAmount = 0.0;
  const processedLines = [];

  for (const line of lines) {
    const qty = Math.max(1, parseInt(line.quantity, 10) || 1);
    totalQuantity += qty;

    // Fetch product
    const product = typeof line.product_id === 'number' || !isNaN(Number(line.product_id))
      ? db.prepare('SELECT * FROM products WHERE id = ?').get(Number(line.product_id))
      : db.prepare('SELECT * FROM products WHERE uuid = ?').get(line.product_id);

    if (!product) {
      throw new Error(`Product ID ${line.product_id} not found.`);
    }

    if (!product.is_active) {
      throw new Error(`Product "${product.name}" is currently inactive.`);
    }

    // Fetch variant (if provided)
    let variant = null;
    let variantAdditionalPrice = 0.0;
    if (line.variant_id) {
      variant = typeof line.variant_id === 'number' || !isNaN(Number(line.variant_id))
        ? db.prepare('SELECT * FROM product_variants WHERE id = ? AND product_id = ?').get(Number(line.variant_id), product.id)
        : db.prepare('SELECT * FROM product_variants WHERE uuid = ? AND product_id = ?').get(line.variant_id, product.id);

      if (!variant) {
        throw new Error(`Variant ID ${line.variant_id} does not belong to product "${product.name}".`);
      }
      if (!variant.is_active) {
        throw new Error(`Variant "${variant.variant_name}" is currently inactive.`);
      }
      variantAdditionalPrice = parseFloat(variant.additional_price || 0);
    }

    // Unit price = Base sales price + Variant additional price
    // (If plan has dedicated base price > 0 and only 1 line, or use product sales price)
    const baseUnitPrice = parseFloat(product.sales_price || 0);
    const unitPrice = Number((baseUnitPrice + variantAdditionalPrice).toFixed(2));
    const grossAmount = Number((unitPrice * qty).toFixed(2));
    rawSubtotal += grossAmount;

    // Tax calculation
    let taxRate = 0.0;
    let taxId = null;
    if (product.tax_id) {
      const tax = db.prepare('SELECT * FROM taxes WHERE id = ? AND is_active = 1').get(product.tax_id);
      if (tax) {
        taxId = tax.id;
        taxRate = parseFloat(tax.rate || 0);
      }
    }

    const lineTax = Number((grossAmount * (taxRate / 100)).toFixed(2));
    const lineTotal = Number((grossAmount + lineTax).toFixed(2));
    totalTaxAmount += lineTax;

    processedLines.push({
      product_id: product.id,
      product_uuid: product.uuid,
      product_name: product.name,
      variant_id: variant ? variant.id : null,
      variant_uuid: variant ? variant.uuid : null,
      variant_name: variant ? variant.variant_name : null,
      quantity: qty,
      base_unit_price: baseUnitPrice,
      variant_additional_price: variantAdditionalPrice,
      unit_price: unitPrice,
      gross_amount: grossAmount,
      tax_id: taxId,
      tax_rate: taxRate,
      tax_amount: lineTax,
      line_total: lineTotal
    });
  }

  // 3. Enforce plan min_quantity
  if (totalQuantity < (plan.min_quantity || 1)) {
    throw new Error(`Minimum purchase quantity for plan "${plan.name}" is ${plan.min_quantity}. Total quantity provided is ${totalQuantity}.`);
  }

  // 4. Discount evaluation
  let discount = null;
  let discountAmount = 0.0;
  let discountApplied = false;
  let discountMessage = null;

  if (discount_code && typeof discount_code === 'string' && discount_code.trim()) {
    discount = db.prepare('SELECT * FROM discounts WHERE code = ? COLLATE NOCASE').get(discount_code.trim().toUpperCase());
    if (!discount) {
      throw new Error(`Discount coupon code "${discount_code}" is invalid.`);
    }

    const eligibility = evaluateDiscountEligibility(discount, {
      product_id: processedLines[0].product_id,
      plan_id: plan.id,
      subtotal: rawSubtotal,
      quantity: totalQuantity,
      refDateStr: startDate
    });

    if (!eligibility.eligible) {
      throw new Error(eligibility.reason);
    }

    if (discount.discount_type === 'percentage') {
      discountAmount = Number((rawSubtotal * (parseFloat(discount.value) / 100)).toFixed(2));
      discountMessage = `${discount.value}% discount applied (-₹${discountAmount.toFixed(2)})`;
    } else {
      discountAmount = Math.min(rawSubtotal, Number(parseFloat(discount.value).toFixed(2)));
      discountMessage = `Flat ₹${discount.value} discount applied (-₹${discountAmount.toFixed(2)})`;
    }
    discountApplied = true;
  } else {
    // Check auto-apply discounts
    const autoDiscount = db.prepare(`
      SELECT * FROM discounts 
      WHERE is_auto_apply = 1 
        AND is_active = 1 
        AND (start_date IS NULL OR date(start_date) <= date(?))
        AND (end_date IS NULL OR date(end_date) >= date(?))
        AND (max_usage_limit IS NULL OR used_count < max_usage_limit)
        AND (min_purchase_amount <= ?)
        AND (min_quantity <= ?)
      ORDER BY value DESC LIMIT 1
    `).get(startDate, startDate, rawSubtotal, totalQuantity);

    if (autoDiscount) {
      discount = autoDiscount;
      if (discount.discount_type === 'percentage') {
        discountAmount = Number((rawSubtotal * (parseFloat(discount.value) / 100)).toFixed(2));
        discountMessage = `Automatic ${discount.value}% platform privilege applied (-₹${discountAmount.toFixed(2)})`;
      } else {
        discountAmount = Math.min(rawSubtotal, Number(parseFloat(discount.value).toFixed(2)));
        discountMessage = `Automatic flat ₹${discount.value} discount applied (-₹${discountAmount.toFixed(2)})`;
      }
      discountApplied = true;
    }
  }

  // Subtotal and Tax adjustments
  const finalSubtotal = Number(rawSubtotal.toFixed(2));
  const taxableAmount = Math.max(0, Number((finalSubtotal - discountAmount).toFixed(2)));

  // If discount applied, recalculate tax proportionally based on taxable amount
  let finalTaxAmount = totalTaxAmount;
  if (discountApplied && finalSubtotal > 0) {
    const taxRatio = taxableAmount / finalSubtotal;
    finalTaxAmount = Number((totalTaxAmount * taxRatio).toFixed(2));
  }

  const finalTotalAmount = Number((taxableAmount + finalTaxAmount).toFixed(2));

  return {
    plan,
    start_date: startDate,
    expiry_date: expiryDate,
    total_quantity: totalQuantity,
    lines: processedLines,
    subtotal: finalSubtotal,
    discount_id: discountApplied ? discount.id : null,
    discount_code: discountApplied ? discount.code : null,
    discount_amount: discountAmount,
    discount_applied: discountApplied,
    discount_message: discountMessage,
    taxable_amount: taxableAmount,
    tax_amount: finalTaxAmount,
    total_amount: finalTotalAmount
  };
}

/**
 * Record a subscription lifecycle history event.
 */
function recordSubscriptionHistory(subscriptionId, { action, from_status, to_status, changed_by = null, notes = '', metadata = null }) {
  db.prepare(`
    INSERT INTO subscription_history (
      subscription_id, action, from_status, to_status, changed_by, notes, metadata
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    subscriptionId,
    action,
    from_status,
    to_status,
    changed_by,
    notes,
    metadata ? (typeof metadata === 'string' ? metadata : JSON.stringify(metadata)) : null
  );
}

module.exports = {
  generateDocumentNumber,
  calculateExpiryDate,
  calculateSubscriptionDetails,
  recordSubscriptionHistory
};
