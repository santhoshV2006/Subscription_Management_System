const { v4: uuidv4 } = require('uuid');
const { db, checkAndCloseExpiredPlans } = require('../config/database');

/**
 * Subscription Plan Controller
 * Supports: daily, weekly, monthly, yearly billing frequencies,
 * min_quantity, availability dates, automatic closure on expiry,
 * early closure, pause, and renewal settings.
 */

/**
 * Get all subscription plans with filters, search, and associated product info.
 */
function getAllPlans(req, res) {
  try {
    // Run auto-closure routine first
    checkAndCloseExpiredPlans();

    const {
      search,
      product_id,
      billing_frequency,
      status,
      page = 1,
      limit = 20
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const offset = (pageNum - 1) * limitNum;

    let query = `
      SELECT 
        sp.*,
        p.name as product_name,
        p.sales_price as product_base_price,
        p.product_type
      FROM subscription_plans sp
      LEFT JOIN products p ON sp.product_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (search && search.trim()) {
      query += ` AND (sp.name LIKE ? OR sp.code LIKE ? OR sp.description LIKE ?)`;
      params.push(`%${search.trim()}%`, `%${search.trim()}%`, `%${search.trim()}%`);
    }

    if (product_id) {
      query += ` AND sp.product_id = ?`;
      params.push(Number(product_id));
    }

    if (billing_frequency && billing_frequency.trim()) {
      query += ` AND sp.billing_frequency = ?`;
      params.push(billing_frequency.trim().toLowerCase());
    }

    if (status && status.trim()) {
      query += ` AND sp.status = ?`;
      params.push(status.trim().toLowerCase());
    }

    // Count query
    const countSql = `SELECT COUNT(*) as total FROM (${query})`;
    const countResult = db.prepare(countSql).get(...params);
    const total = countResult ? countResult.total : 0;

    query += ` ORDER BY sp.created_at DESC LIMIT ? OFFSET ?`;
    params.push(limitNum, offset);

    const plans = db.prepare(query).all(...params);

    res.json({
      success: true,
      data: {
        plans,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error) {
    console.error('Error in getAllPlans:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve subscription plans.' });
  }
}

/**
 * Get single plan by id or uuid.
 */
function getPlanById(req, res) {
  try {
    checkAndCloseExpiredPlans();
    const { id } = req.params;

    let plan;
    if (!isNaN(Number(id))) {
      plan = db.prepare(`
        SELECT sp.*, p.name as product_name, p.sales_price as product_base_price, p.product_type
        FROM subscription_plans sp
        LEFT JOIN products p ON sp.product_id = p.id
        WHERE sp.id = ?
      `).get(Number(id));
    } else {
      plan = db.prepare(`
        SELECT sp.*, p.name as product_name, p.sales_price as product_base_price, p.product_type
        FROM subscription_plans sp
        LEFT JOIN products p ON sp.product_id = p.id
        WHERE sp.uuid = ?
      `).get(id);
    }

    if (!plan) {
      return res.status(404).json({ success: false, message: 'Subscription plan not found.' });
    }

    // Include variants of associated product for convenient pricing selection
    let variants = [];
    if (plan.product_id) {
      variants = db.prepare('SELECT * FROM product_variants WHERE product_id = ? AND is_active = 1').all(plan.product_id);
    }

    res.json({
      success: true,
      data: {
        ...plan,
        product_variants: variants
      }
    });
  } catch (error) {
    console.error('Error in getPlanById:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve plan.' });
  }
}

/**
 * Create a new subscription plan. (Admin only)
 */
function createPlan(req, res) {
  try {
    const {
      product_id = null,
      name,
      code,
      description = '',
      billing_frequency = 'monthly',
      price = 0,
      min_quantity = 1,
      start_date = null,
      end_date = null,
      is_auto_close_on_expiry = 1,
      allow_early_closure = 1,
      allow_pause = 1,
      allow_renewal = 1,
      trial_days = 0,
      status = 'active'
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Plan name is required.' });
    }

    const validFrequencies = ['daily', 'weekly', 'monthly', 'yearly'];
    const freq = billing_frequency.trim().toLowerCase();
    if (!validFrequencies.includes(freq)) {
      return res.status(400).json({
        success: false,
        message: `Invalid billing frequency. Must be one of: ${validFrequencies.join(', ')}`
      });
    }

    const minQty = parseInt(min_quantity, 10);
    if (isNaN(minQty) || minQty < 1) {
      return res.status(400).json({ success: false, message: 'Minimum purchase quantity must be at least 1.' });
    }

    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum < 0) {
      return res.status(400).json({ success: false, message: 'Plan price must be non-negative.' });
    }

    // Auto-generate code if not provided
    const planCode = code && code.trim()
      ? code.trim().toUpperCase()
      : `PLAN-${freq.substring(0, 3).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

    // Check duplicate code
    const existingCode = db.prepare('SELECT id FROM subscription_plans WHERE code = ?').get(planCode);
    if (existingCode) {
      return res.status(400).json({ success: false, message: `Plan code "${planCode}" is already in use.` });
    }

    // Date validation
    if (start_date && end_date && new Date(start_date) > new Date(end_date)) {
      return res.status(400).json({ success: false, message: 'End date must be greater than or equal to start date.' });
    }

    const uuid = uuidv4();
    const result = db.prepare(`
      INSERT INTO subscription_plans (
        uuid, product_id, name, code, description, billing_frequency, price,
        min_quantity, start_date, end_date, is_auto_close_on_expiry,
        allow_early_closure, allow_pause, allow_renewal, trial_days, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuid,
      product_id ? Number(product_id) : null,
      name.trim(),
      planCode,
      description ? description.trim() : null,
      freq,
      priceNum,
      minQty,
      start_date || null,
      end_date || null,
      is_auto_close_on_expiry ? 1 : 0,
      allow_early_closure ? 1 : 0,
      allow_pause ? 1 : 0,
      allow_renewal ? 1 : 0,
      Math.max(0, parseInt(trial_days, 10) || 0),
      status
    );

    const newPlan = db.prepare('SELECT * FROM subscription_plans WHERE id = ?').get(result.lastInsertRowid);

    // Log activity
    db.prepare(`
      INSERT INTO activity_logs (user_id, action, details)
      VALUES (?, 'PLAN_CREATED', ?)
    `).run(req.user ? req.user.id : null, `Created subscription plan "${name}" (${freq})`);

    res.status(201).json({
      success: true,
      message: 'Subscription plan created successfully.',
      data: newPlan
    });
  } catch (error) {
    console.error('Error in createPlan:', error);
    res.status(500).json({ success: false, message: 'Failed to create subscription plan.' });
  }
}

/**
 * Update a subscription plan. (Admin only)
 */
function updatePlan(req, res) {
  try {
    const { id } = req.params;
    let existing;

    if (!isNaN(Number(id))) {
      existing = db.prepare('SELECT * FROM subscription_plans WHERE id = ?').get(Number(id));
    } else {
      existing = db.prepare('SELECT * FROM subscription_plans WHERE uuid = ?').get(id);
    }

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Subscription plan not found.' });
    }

    const {
      product_id,
      name,
      code,
      description,
      billing_frequency,
      price,
      min_quantity,
      start_date,
      end_date,
      is_auto_close_on_expiry,
      allow_early_closure,
      allow_pause,
      allow_renewal,
      trial_days,
      status
    } = req.body;

    const updatedName = name !== undefined ? name.trim() : existing.name;
    const updatedCode = code !== undefined ? code.trim().toUpperCase() : existing.code;
    const updatedFreq = billing_frequency !== undefined ? billing_frequency.trim().toLowerCase() : existing.billing_frequency;
    const updatedPrice = price !== undefined ? parseFloat(price) : existing.price;
    const updatedMinQty = min_quantity !== undefined ? parseInt(min_quantity, 10) : existing.min_quantity;
    const updatedStartDate = start_date !== undefined ? (start_date || null) : existing.start_date;
    const updatedEndDate = end_date !== undefined ? (end_date || null) : existing.end_date;
    const updatedAutoClose = is_auto_close_on_expiry !== undefined ? (is_auto_close_on_expiry ? 1 : 0) : existing.is_auto_close_on_expiry;
    const updatedEarlyClosure = allow_early_closure !== undefined ? (allow_early_closure ? 1 : 0) : existing.allow_early_closure;
    const updatedPause = allow_pause !== undefined ? (allow_pause ? 1 : 0) : existing.allow_pause;
    const updatedRenewal = allow_renewal !== undefined ? (allow_renewal ? 1 : 0) : existing.allow_renewal;
    const updatedTrial = trial_days !== undefined ? Math.max(0, parseInt(trial_days, 10) || 0) : existing.trial_days;
    const updatedStatus = status !== undefined ? status.toLowerCase() : existing.status;
    const updatedProductId = product_id !== undefined ? (product_id ? Number(product_id) : null) : existing.product_id;
    const updatedDescription = description !== undefined ? (description ? description.trim() : null) : existing.description;

    // Check code uniqueness if changed
    if (updatedCode !== existing.code) {
      const codeTaken = db.prepare('SELECT id FROM subscription_plans WHERE code = ? AND id != ?').get(updatedCode, existing.id);
      if (codeTaken) {
        return res.status(400).json({ success: false, message: `Plan code "${updatedCode}" is already taken.` });
      }
    }

    db.prepare(`
      UPDATE subscription_plans
      SET product_id = ?, name = ?, code = ?, description = ?, billing_frequency = ?, price = ?,
          min_quantity = ?, start_date = ?, end_date = ?, is_auto_close_on_expiry = ?,
          allow_early_closure = ?, allow_pause = ?, allow_renewal = ?, trial_days = ?,
          status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      updatedProductId,
      updatedName,
      updatedCode,
      updatedDescription,
      updatedFreq,
      updatedPrice,
      updatedMinQty,
      updatedStartDate,
      updatedEndDate,
      updatedAutoClose,
      updatedEarlyClosure,
      updatedPause,
      updatedRenewal,
      updatedTrial,
      updatedStatus,
      existing.id
    );

    // Log activity
    db.prepare(`
      INSERT INTO activity_logs (user_id, action, details)
      VALUES (?, 'PLAN_UPDATED', ?)
    `).run(req.user ? req.user.id : null, `Updated subscription plan "${updatedName}" (ID: ${existing.id})`);

    const updated = db.prepare('SELECT * FROM subscription_plans WHERE id = ?').get(existing.id);

    res.json({
      success: true,
      message: 'Subscription plan updated successfully.',
      data: updated
    });
  } catch (error) {
    console.error('Error in updatePlan:', error);
    res.status(500).json({ success: false, message: 'Failed to update plan.' });
  }
}

/**
 * Delete / Archive a subscription plan. (Admin only)
 */
function deletePlan(req, res) {
  try {
    const { id } = req.params;
    let existing;

    if (!isNaN(Number(id))) {
      existing = db.prepare('SELECT * FROM subscription_plans WHERE id = ?').get(Number(id));
    } else {
      existing = db.prepare('SELECT * FROM subscription_plans WHERE uuid = ?').get(id);
    }

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Subscription plan not found.' });
    }

    db.prepare('DELETE FROM subscription_plans WHERE id = ?').run(existing.id);

    // Log activity
    db.prepare(`
      INSERT INTO activity_logs (user_id, action, details)
      VALUES (?, 'PLAN_DELETED', ?)
    `).run(req.user ? req.user.id : null, `Deleted plan "${existing.name}" (ID: ${existing.id})`);

    res.json({
      success: true,
      message: `Subscription plan "${existing.name}" deleted successfully.`
    });
  } catch (error) {
    console.error('Error in deletePlan:', error);
    res.status(500).json({ success: false, message: 'Failed to delete plan.' });
  }
}

/**
 * Early closure of a subscription plan. (Admin only)
 * Honors allow_early_closure rule.
 */
function closePlanEarly(req, res) {
  try {
    const { id } = req.params;
    const plan = db.prepare('SELECT * FROM subscription_plans WHERE id = ? OR uuid = ?').get(id, id);

    if (!plan) {
      return res.status(404).json({ success: false, message: 'Subscription plan not found.' });
    }

    if (!plan.allow_early_closure) {
      return res.status(400).json({
        success: false,
        message: `Plan "${plan.name}" does not allow early closure based on its configuration settings.`
      });
    }

    db.prepare("UPDATE subscription_plans SET status = 'archived', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(plan.id);

    db.prepare(`
      INSERT INTO activity_logs (user_id, action, details)
      VALUES (?, 'PLAN_EARLY_CLOSED', ?)
    `).run(req.user ? req.user.id : null, `Early closure performed for plan "${plan.name}"`);

    res.json({
      success: true,
      message: `Plan "${plan.name}" has been closed early and archived.`,
      data: { id: plan.id, status: 'archived' }
    });
  } catch (error) {
    console.error('Error in closePlanEarly:', error);
    res.status(500).json({ success: false, message: 'Failed to close plan early.' });
  }
}

/**
 * Pause a subscription plan. (Admin only)
 * Honors allow_pause rule.
 */
function pausePlan(req, res) {
  try {
    const { id } = req.params;
    const plan = db.prepare('SELECT * FROM subscription_plans WHERE id = ? OR uuid = ?').get(id, id);

    if (!plan) {
      return res.status(404).json({ success: false, message: 'Subscription plan not found.' });
    }

    if (!plan.allow_pause) {
      return res.status(400).json({
        success: false,
        message: `Plan "${plan.name}" does not permit pausing according to its configuration.`
      });
    }

    db.prepare("UPDATE subscription_plans SET status = 'inactive', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(plan.id);

    db.prepare(`
      INSERT INTO activity_logs (user_id, action, details)
      VALUES (?, 'PLAN_PAUSED', ?)
    `).run(req.user ? req.user.id : null, `Paused plan "${plan.name}"`);

    res.json({
      success: true,
      message: `Plan "${plan.name}" is now paused/inactive.`,
      data: { id: plan.id, status: 'inactive' }
    });
  } catch (error) {
    console.error('Error in pausePlan:', error);
    res.status(500).json({ success: false, message: 'Failed to pause plan.' });
  }
}

/**
 * Resume an inactive / paused subscription plan. (Admin only)
 */
function resumePlan(req, res) {
  try {
    const { id } = req.params;
    const plan = db.prepare('SELECT * FROM subscription_plans WHERE id = ? OR uuid = ?').get(id, id);

    if (!plan) {
      return res.status(404).json({ success: false, message: 'Subscription plan not found.' });
    }

    // Check if expired
    const todayStr = new Date().toISOString().split('T')[0];
    if (plan.end_date && todayStr > plan.end_date) {
      return res.status(400).json({
        success: false,
        message: `Cannot resume plan "${plan.name}" because its availability end date (${plan.end_date}) has expired.`
      });
    }

    db.prepare("UPDATE subscription_plans SET status = 'active', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(plan.id);

    db.prepare(`
      INSERT INTO activity_logs (user_id, action, details)
      VALUES (?, 'PLAN_RESUMED', ?)
    `).run(req.user ? req.user.id : null, `Resumed plan "${plan.name}"`);

    res.json({
      success: true,
      message: `Plan "${plan.name}" is now active.`,
      data: { id: plan.id, status: 'active' }
    });
  } catch (error) {
    console.error('Error in resumePlan:', error);
    res.status(500).json({ success: false, message: 'Failed to resume plan.' });
  }
}

module.exports = {
  getAllPlans,
  getPlanById,
  createPlan,
  updatePlan,
  deletePlan,
  closePlanEarly,
  pausePlan,
  resumePlan
};
