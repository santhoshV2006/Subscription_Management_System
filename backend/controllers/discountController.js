const { v4: uuidv4 } = require('uuid');
const { db } = require('../config/database');
const { evaluateDiscountEligibility, recordDiscountUsage } = require('../utils/pricingEngine');

/**
 * Discount Management Controller
 * Handles fixed & percentage discounts, min purchase/quantity conditions,
 * availability start/end dates, max usage limits, targeting (all, product, plan),
 * and automatic invoice application.
 */

/**
 * Get all discounts with usage stats, targets, and status. (Admin only)
 */
function getAllDiscounts(req, res) {
  try {
    const { status, applies_to, search, page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const offset = (pageNum - 1) * limitNum;

    let query = `
      SELECT 
        d.*,
        p.name as target_product_name,
        sp.name as target_plan_name
      FROM discounts d
      LEFT JOIN products p ON d.target_product_id = p.id
      LEFT JOIN subscription_plans sp ON d.target_plan_id = sp.id
      WHERE 1=1
    `;
    const params = [];

    if (search && search.trim()) {
      query += ` AND (d.name LIKE ? OR d.code LIKE ?)`;
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }

    if (applies_to && applies_to.trim()) {
      query += ` AND d.applies_to = ?`;
      params.push(applies_to.trim().toLowerCase());
    }

    if (status) {
      const today = new Date().toISOString().split('T')[0];
      if (status === 'active') {
        query += ` AND d.is_active = 1 
                   AND (d.start_date IS NULL OR date(d.start_date) <= date(?))
                   AND (d.end_date IS NULL OR date(d.end_date) >= date(?))
                   AND (d.max_usage_limit IS NULL OR d.used_count < d.max_usage_limit)`;
        params.push(today, today);
      } else if (status === 'expired') {
        query += ` AND (
                     (d.end_date IS NOT NULL AND date(d.end_date) < date(?))
                     OR (d.max_usage_limit IS NOT NULL AND d.used_count >= d.max_usage_limit)
                   )`;
        params.push(today);
      } else if (status === 'inactive') {
        query += ` AND d.is_active = 0`;
      }
    }

    const countSql = `SELECT COUNT(*) as total FROM (${query})`;
    const countResult = db.prepare(countSql).get(...params);
    const total = countResult ? countResult.total : 0;

    query += ` ORDER BY d.created_at DESC LIMIT ? OFFSET ?`;
    params.push(limitNum, offset);

    const discounts = db.prepare(query).all(...params);

    // Compute effective status for each discount
    const today = new Date().toISOString().split('T')[0];
    const enrichedDiscounts = discounts.map(d => {
      let computedStatus = 'active';
      if (!d.is_active) {
        computedStatus = 'inactive';
      } else if (d.max_usage_limit !== null && d.used_count >= d.max_usage_limit) {
        computedStatus = 'limit_reached';
      } else if (d.end_date && d.end_date < today) {
        computedStatus = 'expired';
      } else if (d.start_date && d.start_date > today) {
        computedStatus = 'upcoming';
      }

      return {
        ...d,
        computed_status: computedStatus,
        is_usable: computedStatus === 'active'
      };
    });

    res.json({
      success: true,
      data: {
        discounts: enrichedDiscounts,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error) {
    console.error('Error in getAllDiscounts:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve discounts.' });
  }
}

/**
 * Get discount by ID or UUID with recent usage history. (Admin only)
 */
function getDiscountById(req, res) {
  try {
    const { id } = req.params;
    let discount;

    if (!isNaN(Number(id))) {
      discount = db.prepare(`
        SELECT d.*, p.name as target_product_name, sp.name as target_plan_name
        FROM discounts d
        LEFT JOIN products p ON d.target_product_id = p.id
        LEFT JOIN subscription_plans sp ON d.target_plan_id = sp.id
        WHERE d.id = ?
      `).get(Number(id));
    } else {
      discount = db.prepare(`
        SELECT d.*, p.name as target_product_name, sp.name as target_plan_name
        FROM discounts d
        LEFT JOIN products p ON d.target_product_id = p.id
        LEFT JOIN subscription_plans sp ON d.target_plan_id = sp.id
        WHERE d.uuid = ?
      `).get(id);
    }

    if (!discount) {
      return res.status(404).json({ success: false, message: 'Discount not found.' });
    }

    const usages = db.prepare(`
      SELECT du.*, u.name as user_name, u.email as user_email
      FROM discount_usages du
      LEFT JOIN users u ON du.user_id = u.id
      WHERE du.discount_id = ?
      ORDER BY du.applied_at DESC
      LIMIT 50
    `).all(discount.id);

    res.json({
      success: true,
      data: {
        ...discount,
        usages
      }
    });
  } catch (error) {
    console.error('Error in getDiscountById:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve discount.' });
  }
}

/**
 * Create a new discount rule. (Admin only)
 */
function createDiscount(req, res) {
  try {
    const {
      name,
      code,
      discount_type = 'percentage',
      value = 0,
      min_purchase_amount = 0,
      min_quantity = 1,
      start_date = null,
      end_date = null,
      max_usage_limit = null,
      applies_to = 'all',
      target_product_id = null,
      target_plan_id = null,
      is_auto_apply = 0,
      is_active = 1
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Discount name is required.' });
    }

    if (!code || !code.trim()) {
      return res.status(400).json({ success: false, message: 'Discount coupon code is required.' });
    }

    const discountCode = code.trim().toUpperCase();

    // Check code uniqueness
    const existing = db.prepare('SELECT id FROM discounts WHERE code = ? COLLATE NOCASE').get(discountCode);
    if (existing) {
      return res.status(400).json({ success: false, message: `Discount code "${discountCode}" already exists.` });
    }

    const valNum = parseFloat(value);
    if (isNaN(valNum) || valNum <= 0) {
      return res.status(400).json({ success: false, message: 'Discount value must be a positive number.' });
    }

    const typeStr = discount_type.trim().toLowerCase();
    if (!['percentage', 'fixed'].includes(typeStr)) {
      return res.status(400).json({ success: false, message: 'Discount type must be percentage or fixed.' });
    }

    if (typeStr === 'percentage' && valNum > 100) {
      return res.status(400).json({ success: false, message: 'Percentage discount cannot exceed 100%.' });
    }

    const minPurchase = Math.max(0, parseFloat(min_purchase_amount) || 0);
    const minQty = Math.max(1, parseInt(min_quantity, 10) || 1);
    const maxUsage = max_usage_limit !== null && max_usage_limit !== '' && !isNaN(Number(max_usage_limit))
      ? parseInt(max_usage_limit, 10)
      : null;

    if (start_date && end_date && new Date(start_date) > new Date(end_date)) {
      return res.status(400).json({ success: false, message: 'End date must be greater than or equal to start date.' });
    }

    const appliesToStr = applies_to.trim().toLowerCase();
    if (!['all', 'product', 'plan'].includes(appliesToStr)) {
      return res.status(400).json({ success: false, message: 'applies_to must be one of: all, product, plan.' });
    }

    const uuid = uuidv4();
    const result = db.prepare(`
      INSERT INTO discounts (
        uuid, name, code, discount_type, value, min_purchase_amount, min_quantity,
        start_date, end_date, max_usage_limit, used_count, applies_to,
        target_product_id, target_plan_id, is_auto_apply, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)
    `).run(
      uuid,
      name.trim(),
      discountCode,
      typeStr,
      valNum,
      minPurchase,
      minQty,
      start_date || null,
      end_date || null,
      maxUsage,
      appliesToStr,
      target_product_id ? Number(target_product_id) : null,
      target_plan_id ? Number(target_plan_id) : null,
      is_auto_apply ? 1 : 0,
      is_active ? 1 : 0
    );

    const newDiscount = db.prepare('SELECT * FROM discounts WHERE id = ?').get(result.lastInsertRowid);

    // Log activity
    db.prepare(`
      INSERT INTO activity_logs (user_id, action, details)
      VALUES (?, 'DISCOUNT_CREATED', ?)
    `).run(req.user ? req.user.id : null, `Created discount code "${discountCode}" (${typeStr}: ${valNum})`);

    res.status(201).json({
      success: true,
      message: 'Discount created successfully.',
      data: newDiscount
    });
  } catch (error) {
    console.error('Error in createDiscount:', error);
    res.status(500).json({ success: false, message: 'Failed to create discount.' });
  }
}

/**
 * Update discount rule. (Admin only)
 */
function updateDiscount(req, res) {
  try {
    const { id } = req.params;
    let existing;

    if (!isNaN(Number(id))) {
      existing = db.prepare('SELECT * FROM discounts WHERE id = ?').get(Number(id));
    } else {
      existing = db.prepare('SELECT * FROM discounts WHERE uuid = ?').get(id);
    }

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Discount not found.' });
    }

    const {
      name,
      code,
      discount_type,
      value,
      min_purchase_amount,
      min_quantity,
      start_date,
      end_date,
      max_usage_limit,
      applies_to,
      target_product_id,
      target_plan_id,
      is_auto_apply,
      is_active
    } = req.body;

    const updatedName = name !== undefined ? name.trim() : existing.name;
    const updatedCode = code !== undefined ? code.trim().toUpperCase() : existing.code;
    const updatedType = discount_type !== undefined ? discount_type.trim().toLowerCase() : existing.discount_type;
    const updatedVal = value !== undefined ? parseFloat(value) : existing.value;
    const updatedMinPurchase = min_purchase_amount !== undefined ? parseFloat(min_purchase_amount) : existing.min_purchase_amount;
    const updatedMinQty = min_quantity !== undefined ? parseInt(min_quantity, 10) : existing.min_quantity;
    const updatedStartDate = start_date !== undefined ? (start_date || null) : existing.start_date;
    const updatedEndDate = end_date !== undefined ? (end_date || null) : existing.end_date;
    const updatedMaxUsage = max_usage_limit !== undefined
      ? (max_usage_limit === null || max_usage_limit === '' ? null : parseInt(max_usage_limit, 10))
      : existing.max_usage_limit;
    const updatedAppliesTo = applies_to !== undefined ? applies_to.trim().toLowerCase() : existing.applies_to;
    const updatedTargetProd = target_product_id !== undefined ? (target_product_id ? Number(target_product_id) : null) : existing.target_product_id;
    const updatedTargetPlan = target_plan_id !== undefined ? (target_plan_id ? Number(target_plan_id) : null) : existing.target_plan_id;
    const updatedAutoApply = is_auto_apply !== undefined ? (is_auto_apply ? 1 : 0) : existing.is_auto_apply;
    const updatedActive = is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active;

    if (updatedCode !== existing.code) {
      const codeTaken = db.prepare('SELECT id FROM discounts WHERE code = ? COLLATE NOCASE AND id != ?').get(updatedCode, existing.id);
      if (codeTaken) {
        return res.status(400).json({ success: false, message: `Discount code "${updatedCode}" is already in use.` });
      }
    }

    db.prepare(`
      UPDATE discounts
      SET name = ?, code = ?, discount_type = ?, value = ?, min_purchase_amount = ?, min_quantity = ?,
          start_date = ?, end_date = ?, max_usage_limit = ?, applies_to = ?,
          target_product_id = ?, target_plan_id = ?, is_auto_apply = ?, is_active = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      updatedName,
      updatedCode,
      updatedType,
      updatedVal,
      updatedMinPurchase,
      updatedMinQty,
      updatedStartDate,
      updatedEndDate,
      updatedMaxUsage,
      updatedAppliesTo,
      updatedTargetProd,
      updatedTargetPlan,
      updatedAutoApply,
      updatedActive,
      existing.id
    );

    // Log activity
    db.prepare(`
      INSERT INTO activity_logs (user_id, action, details)
      VALUES (?, 'DISCOUNT_UPDATED', ?)
    `).run(req.user ? req.user.id : null, `Updated discount "${updatedName}" (Code: ${updatedCode})`);

    const updated = db.prepare('SELECT * FROM discounts WHERE id = ?').get(existing.id);

    res.json({
      success: true,
      message: 'Discount updated successfully.',
      data: updated
    });
  } catch (error) {
    console.error('Error in updateDiscount:', error);
    res.status(500).json({ success: false, message: 'Failed to update discount.' });
  }
}

/**
 * Delete discount. (Admin only)
 */
function deleteDiscount(req, res) {
  try {
    const { id } = req.params;
    let existing;

    if (!isNaN(Number(id))) {
      existing = db.prepare('SELECT * FROM discounts WHERE id = ?').get(Number(id));
    } else {
      existing = db.prepare('SELECT * FROM discounts WHERE uuid = ?').get(id);
    }

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Discount not found.' });
    }

    db.prepare('DELETE FROM discounts WHERE id = ?').run(existing.id);

    // Log activity
    db.prepare(`
      INSERT INTO activity_logs (user_id, action, details)
      VALUES (?, 'DISCOUNT_DELETED', ?)
    `).run(req.user ? req.user.id : null, `Deleted discount "${existing.name}" (Code: ${existing.code})`);

    res.json({
      success: true,
      message: `Discount "${existing.name}" deleted successfully.`
    });
  } catch (error) {
    console.error('Error in deleteDiscount:', error);
    res.status(500).json({ success: false, message: 'Failed to delete discount.' });
  }
}

/**
 * Validate a discount coupon code against cart/line item parameters.
 * Accessible to Admin, Staff, Customer.
 */
function validateDiscount(req, res) {
  try {
    const {
      code,
      product_id,
      plan_id = null,
      subtotal = 0,
      quantity = 1
    } = req.body;

    if (!code || !code.trim()) {
      return res.status(400).json({ success: false, message: 'Coupon code is required.' });
    }

    const discount = db.prepare('SELECT * FROM discounts WHERE code = ? COLLATE NOCASE').get(code.trim());

    if (!discount) {
      return res.status(404).json({
        success: false,
        valid: false,
        message: `Coupon code "${code}" is invalid or does not exist.`
      });
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const validation = evaluateDiscountEligibility(discount, {
      product_id: product_id ? Number(product_id) : null,
      plan_id: plan_id ? Number(plan_id) : null,
      subtotal: parseFloat(subtotal) || 0,
      quantity: parseInt(quantity, 10) || 1,
      refDateStr: todayStr
    });

    if (!validation.eligible) {
      return res.status(400).json({
        success: false,
        valid: false,
        message: validation.reason
      });
    }

    // Calculate projected discount amount
    const subtotalNum = parseFloat(subtotal) || 0;
    let projectedDiscountAmount = 0;
    if (discount.discount_type === 'percentage') {
      projectedDiscountAmount = Number(((subtotalNum * discount.value) / 100).toFixed(2));
    } else {
      projectedDiscountAmount = Number(Math.min(discount.value, subtotalNum).toFixed(2));
    }

    res.json({
      success: true,
      valid: true,
      message: `Discount code applied: ${discount.name}`,
      data: {
        discount_id: discount.id,
        name: discount.name,
        code: discount.code,
        discount_type: discount.discount_type,
        value: discount.value,
        projected_discount_amount: projectedDiscountAmount,
        min_purchase_amount: discount.min_purchase_amount,
        min_quantity: discount.min_quantity,
        applies_to: discount.applies_to
      }
    });
  } catch (error) {
    console.error('Error in validateDiscount:', error);
    res.status(500).json({ success: false, message: 'Failed to validate discount.' });
  }
}

/**
 * Record usage of discount (called by Subscription & Billing module).
 */
function recordUsage(req, res) {
  try {
    const { discount_id, invoice_ref = null, discount_amount = 0 } = req.body;
    const userId = req.user ? req.user.id : null;

    if (!discount_id) {
      return res.status(400).json({ success: false, message: 'discount_id is required.' });
    }

    const success = recordDiscountUsage(Number(discount_id), userId, invoice_ref, parseFloat(discount_amount) || 0);

    if (!success) {
      return res.status(404).json({ success: false, message: 'Discount not found.' });
    }

    res.json({
      success: true,
      message: 'Discount usage recorded successfully.'
    });
  } catch (error) {
    console.error('Error in recordUsage:', error);
    res.status(500).json({ success: false, message: 'Failed to record discount usage.' });
  }
}

module.exports = {
  getAllDiscounts,
  getDiscountById,
  createDiscount,
  updateDiscount,
  deleteDiscount,
  validateDiscount,
  recordUsage
};
