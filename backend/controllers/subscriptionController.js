const { v4: uuidv4 } = require('uuid');
const { db, checkAndExpireSubscriptions } = require('../config/database');
const {
  generateDocumentNumber,
  calculateExpiryDate,
  calculateSubscriptionDetails,
  recordSubscriptionHistory
} = require('../utils/subscriptionEngine');
const { recordDiscountUsage } = require('../utils/pricingEngine');

// ═══════════════════════════════════════════════════════════════════════════════
// SUBSCRIPTION CONTROLLER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get all subscriptions with filters, search, and role scoping.
 */
exports.getAllSubscriptions = async (req, res) => {
  try {
    // Run auto-expiry check first so expired subscriptions are updated
    checkAndExpireSubscriptions();

    const { status, customer_id, plan_id, search, limit = 50, page = 1 } = req.query;
    let whereClause = 'WHERE 1=1';
    const params = [];

    // Role-based scoping: customer can only see their own
    if (req.user && req.user.role_name === 'customer') {
      whereClause += ' AND s.customer_id = ?';
      params.push(req.user.id);
    } else if (customer_id) {
      whereClause += ' AND s.customer_id = ?';
      params.push(Number(customer_id));
    }

    if (status) {
      whereClause += ' AND s.status = ?';
      params.push(status);
    }

    if (plan_id) {
      whereClause += ' AND s.plan_id = ?';
      params.push(Number(plan_id));
    }

    if (search) {
      whereClause += ' AND (s.subscription_number LIKE ? OR u.name LIKE ? OR u.email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const countQuery = `
      SELECT COUNT(*) as total
      FROM subscriptions s
      JOIN users u ON s.customer_id = u.id
      ${whereClause}
    `;
    const total = db.prepare(countQuery).get(...params).total;

    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const query = `
      SELECT s.*,
             u.name as customer_name, u.email as customer_email,
             sp.name as plan_name, sp.billing_frequency, sp.code as plan_code,
             sp.allow_pause, sp.allow_renewal, sp.allow_early_closure,
             q.quotation_number
      FROM subscriptions s
      JOIN users u ON s.customer_id = u.id
      JOIN subscription_plans sp ON s.plan_id = sp.id
      LEFT JOIN quotations q ON s.quotation_id = q.id
      ${whereClause}
      ORDER BY s.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const subscriptions = db.prepare(query).all(...params, parseInt(limit, 10), offset);

    // Attach item count to each subscription
    const getCount = db.prepare('SELECT COUNT(*) as count FROM subscription_lines WHERE subscription_id = ?');
    const result = subscriptions.map(sub => ({
      ...sub,
      items_count: getCount.get(sub.id).count,
      allow_pause: Boolean(sub.allow_pause),
      allow_renewal: Boolean(sub.allow_renewal),
      allow_early_closure: Boolean(sub.allow_early_closure)
    }));

    res.json({
      success: true,
      data: {
        subscriptions: result,
        pagination: {
          total,
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          totalPages: Math.ceil(total / parseInt(limit, 10))
        }
      }
    });
  } catch (error) {
    console.error('Get subscriptions error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve subscriptions.' });
  }
};

/**
 * Get detailed subscription view with customer, plan, lines, and history.
 */
exports.getSubscriptionById = async (req, res) => {
  try {
    const { id } = req.params;
    const isNum = !isNaN(Number(id));

    const sub = db.prepare(`
      SELECT s.*,
             u.name as customer_name, u.email as customer_email, u.uuid as customer_uuid,
             sp.name as plan_name, sp.billing_frequency, sp.code as plan_code,
             sp.min_quantity, sp.allow_pause, sp.allow_renewal, sp.allow_early_closure,
             q.quotation_number,
             creator.name as created_by_name
      FROM subscriptions s
      JOIN users u ON s.customer_id = u.id
      JOIN subscription_plans sp ON s.plan_id = sp.id
      LEFT JOIN quotations q ON s.quotation_id = q.id
      LEFT JOIN users creator ON s.created_by = creator.id
      WHERE ${isNum ? 's.id = ?' : 's.uuid = ?'}
    `).get(isNum ? Number(id) : id);

    if (!sub) {
      return res.status(404).json({ success: false, message: 'Subscription not found.' });
    }

    // Role scoping: customer can only view own subscription
    if (req.user && req.user.role_name === 'customer' && sub.customer_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'You do not have access to this subscription.' });
    }

    // Fetch lines
    const lines = db.prepare(`
      SELECT sl.*, p.name as product_name, p.product_type,
             pv.variant_name, pv.sku as variant_sku,
             t.name as tax_name, t.code as tax_code
      FROM subscription_lines sl
      JOIN products p ON sl.product_id = p.id
      LEFT JOIN product_variants pv ON sl.variant_id = pv.id
      LEFT JOIN taxes t ON sl.tax_id = t.id
      WHERE sl.subscription_id = ?
    `).all(sub.id);

    // Fetch history
    const history = db.prepare(`
      SELECT sh.*, u.name as changed_by_name
      FROM subscription_history sh
      LEFT JOIN users u ON sh.changed_by = u.id
      WHERE sh.subscription_id = ?
      ORDER BY sh.created_at DESC
    `).all(sub.id);

    sub.lines = lines;
    sub.history = history;
    sub.allow_pause = Boolean(sub.allow_pause);
    sub.allow_renewal = Boolean(sub.allow_renewal);
    sub.allow_early_closure = Boolean(sub.allow_early_closure);

    res.json({ success: true, data: { subscription: sub } });
  } catch (error) {
    console.error('Get subscription by ID error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve subscription details.' });
  }
};

/**
 * Create a new subscription directly.
 */
exports.createSubscription = async (req, res) => {
  try {
    const {
      customer_id,
      plan_id,
      status = 'Active',
      start_date = null,
      payment_terms = 'Net 30',
      lines = [],
      discount_code = null,
      notes = null
    } = req.body;

    let targetCustomerId = customer_id;
    if (req.user && req.user.role_name === 'customer') {
      targetCustomerId = req.user.id;
    }

    if (!targetCustomerId) {
      return res.status(400).json({ success: false, message: 'Customer ID is required.' });
    }

    const customer = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(Number(targetCustomerId));
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }

    if (!plan_id) {
      return res.status(400).json({ success: false, message: 'Subscription plan is required.' });
    }

    if (!Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one product line is required.' });
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const startDate = start_date || todayStr;

    // Calculate totals using engine
    const calculation = calculateSubscriptionDetails({
      plan_id,
      lines,
      discount_code,
      start_date: startDate
    });

    const subscriptionNumber = generateDocumentNumber('SUB');
    const uuid = uuidv4();

    const insertSub = db.prepare(`
      INSERT INTO subscriptions (
        uuid, subscription_number, customer_id, plan_id, status,
        start_date, expiry_date, payment_terms, subtotal,
        discount_id, discount_code, discount_amount, tax_amount, total_amount,
        notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insertSub.run(
      uuid,
      subscriptionNumber,
      customer.id,
      calculation.plan.id,
      status,
      calculation.start_date,
      calculation.expiry_date,
      payment_terms || 'Net 30',
      calculation.subtotal,
      calculation.discount_id,
      calculation.discount_code,
      calculation.discount_amount,
      calculation.tax_amount,
      calculation.total_amount,
      notes ? notes.trim() : null,
      req.user ? req.user.id : null
    );

    const subscriptionId = result.lastInsertRowid;

    // Insert lines
    const insertLine = db.prepare(`
      INSERT INTO subscription_lines (
        uuid, subscription_id, product_id, variant_id, product_name, variant_name,
        quantity, base_unit_price, variant_additional_price, unit_price,
        gross_amount, tax_id, tax_rate, tax_amount, line_total
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const line of calculation.lines) {
      insertLine.run(
        uuidv4(),
        subscriptionId,
        line.product_id,
        line.variant_id,
        line.product_name,
        line.variant_name,
        line.quantity,
        line.base_unit_price,
        line.variant_additional_price,
        line.unit_price,
        line.gross_amount,
        line.tax_id,
        line.tax_rate,
        line.tax_amount,
        line.line_total
      );
    }

    // Record discount usage if applied
    if (calculation.discount_id) {
      recordDiscountUsage(calculation.discount_id, customer.id, subscriptionNumber, calculation.discount_amount);
    }

    // Record history
    recordSubscriptionHistory(subscriptionId, {
      action: 'CREATE',
      from_status: null,
      to_status: status,
      changed_by: req.user ? req.user.id : null,
      notes: `Subscription ${subscriptionNumber} created with status "${status}"`
    });

    res.status(201).json({
      success: true,
      message: `Subscription ${subscriptionNumber} created successfully.`,
      data: {
        subscription_id: subscriptionId,
        subscription_number: subscriptionNumber,
        uuid,
        status,
        calculation
      }
    });
  } catch (error) {
    console.error('Create subscription error:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to create subscription.' });
  }
};

/**
 * Pause an active subscription.
 */
exports.pauseSubscription = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason = 'Customer requested temporary pause' } = req.body;
    const isNum = !isNaN(Number(id));

    const sub = db.prepare(`
      SELECT s.*, sp.allow_pause, sp.name as plan_name
      FROM subscriptions s
      JOIN subscription_plans sp ON s.plan_id = sp.id
      WHERE ${isNum ? 's.id = ?' : 's.uuid = ?'}
    `).get(isNum ? Number(id) : id);

    if (!sub) {
      return res.status(404).json({ success: false, message: 'Subscription not found.' });
    }

    if (sub.status !== 'Active') {
      return res.status(400).json({
        success: false,
        message: `Only Active subscriptions can be paused. Current status is "${sub.status}".`
      });
    }

    if (!sub.allow_pause) {
      return res.status(400).json({
        success: false,
        message: `Subscription plan "${sub.plan_name}" does not allow pausing.`
      });
    }

    db.prepare(`
      UPDATE subscriptions
      SET status = 'Paused', paused_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(sub.id);

    recordSubscriptionHistory(sub.id, {
      action: 'PAUSE',
      from_status: 'Active',
      to_status: 'Paused',
      changed_by: req.user ? req.user.id : null,
      notes: reason
    });

    res.json({
      success: true,
      message: `Subscription ${sub.subscription_number} has been paused.`
    });
  } catch (error) {
    console.error('Pause subscription error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to pause subscription.' });
  }
};

/**
 * Resume a paused subscription.
 */
exports.resumeSubscription = async (req, res) => {
  try {
    const { id } = req.params;
    const isNum = !isNaN(Number(id));

    const sub = db.prepare(`
      SELECT s.*, sp.name as plan_name
      FROM subscriptions s
      JOIN subscription_plans sp ON s.plan_id = sp.id
      WHERE ${isNum ? 's.id = ?' : 's.uuid = ?'}
    `).get(isNum ? Number(id) : id);

    if (!sub) {
      return res.status(404).json({ success: false, message: 'Subscription not found.' });
    }

    if (sub.status !== 'Paused') {
      return res.status(400).json({
        success: false,
        message: `Only Paused subscriptions can be resumed. Current status is "${sub.status}".`
      });
    }

    db.prepare(`
      UPDATE subscriptions
      SET status = 'Active', paused_at = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(sub.id);

    recordSubscriptionHistory(sub.id, {
      action: 'RESUME',
      from_status: 'Paused',
      to_status: 'Active',
      changed_by: req.user ? req.user.id : null,
      notes: 'Subscription resumed by authorized staff'
    });

    res.json({
      success: true,
      message: `Subscription ${sub.subscription_number} is now Active.`
    });
  } catch (error) {
    console.error('Resume subscription error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to resume subscription.' });
  }
};

/**
 * Renew a subscription.
 */
exports.renewSubscription = async (req, res) => {
  try {
    const { id } = req.params;
    const isNum = !isNaN(Number(id));

    const sub = db.prepare(`
      SELECT s.*, sp.allow_renewal, sp.billing_frequency, sp.name as plan_name
      FROM subscriptions s
      JOIN subscription_plans sp ON s.plan_id = sp.id
      WHERE ${isNum ? 's.id = ?' : 's.uuid = ?'}
    `).get(isNum ? Number(id) : id);

    if (!sub) {
      return res.status(404).json({ success: false, message: 'Subscription not found.' });
    }

    if (!sub.allow_renewal) {
      return res.status(400).json({
        success: false,
        message: `Subscription plan "${sub.plan_name}" does not allow renewals.`
      });
    }

    // Determine new start and expiry dates
    // If active and not expired, extension starts from current expiry date; otherwise starts today
    const todayStr = new Date().toISOString().split('T')[0];
    const baseDate = sub.expiry_date && sub.expiry_date > todayStr ? sub.expiry_date : todayStr;
    const newExpiryDate = calculateExpiryDate(baseDate, sub.billing_frequency);

    db.prepare(`
      UPDATE subscriptions
      SET status = 'Active',
          expiry_date = ?,
          closed_at = NULL,
          closure_reason = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newExpiryDate, sub.id);

    recordSubscriptionHistory(sub.id, {
      action: 'RENEW',
      from_status: sub.status,
      to_status: 'Active',
      changed_by: req.user ? req.user.id : null,
      notes: `Subscription renewed until ${newExpiryDate}`
    });

    res.json({
      success: true,
      message: `Subscription ${sub.subscription_number} renewed until ${newExpiryDate}!`,
      data: {
        subscription_id: sub.id,
        subscription_number: sub.subscription_number,
        new_expiry_date: newExpiryDate
      }
    });
  } catch (error) {
    console.error('Renew subscription error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to renew subscription.' });
  }
};

/**
 * Close a subscription early or at end of term.
 */
exports.closeSubscription = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason = 'Early termination requested by customer' } = req.body;
    const isNum = !isNaN(Number(id));

    const sub = db.prepare(`
      SELECT s.*, sp.allow_early_closure, sp.name as plan_name
      FROM subscriptions s
      JOIN subscription_plans sp ON s.plan_id = sp.id
      WHERE ${isNum ? 's.id = ?' : 's.uuid = ?'}
    `).get(isNum ? Number(id) : id);

    if (!sub) {
      return res.status(404).json({ success: false, message: 'Subscription not found.' });
    }

    if (sub.status === 'Closed') {
      return res.status(400).json({
        success: false,
        message: 'Subscription is already closed.'
      });
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const isEarly = sub.expiry_date && sub.expiry_date > todayStr;

    if (isEarly && !sub.allow_early_closure) {
      return res.status(400).json({
        success: false,
        message: `Plan "${sub.plan_name}" does not permit early closure before the expiry date (${sub.expiry_date}).`
      });
    }

    db.prepare(`
      UPDATE subscriptions
      SET status = 'Closed',
          closed_at = CURRENT_TIMESTAMP,
          closure_reason = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(reason, sub.id);

    recordSubscriptionHistory(sub.id, {
      action: isEarly ? 'EARLY_CLOSURE' : 'CLOSE',
      from_status: sub.status,
      to_status: 'Closed',
      changed_by: req.user ? req.user.id : null,
      notes: reason
    });

    res.json({
      success: true,
      message: `Subscription ${sub.subscription_number} has been closed. Reason: ${reason}`
    });
  } catch (error) {
    console.error('Close subscription error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to close subscription.' });
  }
};

/**
 * Get subscription audit history.
 */
exports.getSubscriptionHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const isNum = !isNaN(Number(id));

    const sub = db.prepare(`
      SELECT id, customer_id, subscription_number FROM subscriptions WHERE ${isNum ? 'id = ?' : 'uuid = ?'}
    `).get(isNum ? Number(id) : id);

    if (!sub) {
      return res.status(404).json({ success: false, message: 'Subscription not found.' });
    }

    if (req.user && req.user.role_name === 'customer' && sub.customer_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const history = db.prepare(`
      SELECT sh.*, u.name as changed_by_name
      FROM subscription_history sh
      LEFT JOIN users u ON sh.changed_by = u.id
      WHERE sh.subscription_id = ?
      ORDER BY sh.created_at DESC
    `).all(sub.id);

    res.json({ success: true, data: { history } });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve subscription history.' });
  }
};

/**
 * MODULE 4 INTEGRATION:
 * Expose subscription information formatted for automated billing / invoice generation.
 */
exports.getInvoicePayload = async (req, res) => {
  try {
    const { id } = req.params;
    const isNum = !isNaN(Number(id));

    const sub = db.prepare(`
      SELECT s.*,
             u.id as customer_id, u.uuid as customer_uuid, u.name as customer_name, u.email as customer_email,
             sp.name as plan_name, sp.billing_frequency, sp.code as plan_code
      FROM subscriptions s
      JOIN users u ON s.customer_id = u.id
      JOIN subscription_plans sp ON s.plan_id = sp.id
      WHERE ${isNum ? 's.id = ?' : 's.uuid = ?'}
    `).get(isNum ? Number(id) : id);

    if (!sub) {
      return res.status(404).json({ success: false, message: 'Subscription not found.' });
    }

    const lines = db.prepare(`
      SELECT sl.*, p.name as product_name, p.product_type, pv.variant_name, t.name as tax_name, t.code as tax_code
      FROM subscription_lines sl
      JOIN products p ON sl.product_id = p.id
      LEFT JOIN product_variants pv ON sl.variant_id = pv.id
      LEFT JOIN taxes t ON sl.tax_id = t.id
      WHERE sl.subscription_id = ?
    `).all(sub.id);

    // Compute due date based on payment terms
    const invoiceDate = new Date();
    const dueDate = new Date(invoiceDate);
    const terms = (sub.payment_terms || 'Net 30').toLowerCase();

    if (terms.includes('15')) {
      dueDate.setDate(dueDate.getDate() + 15);
    } else if (terms.includes('30')) {
      dueDate.setDate(dueDate.getDate() + 30);
    } else if (terms.includes('60')) {
      dueDate.setDate(dueDate.getDate() + 60);
    } // default or immediate is today

    const invoicePayload = {
      source_module: 'Module 3: Subscription & Quotation Management',
      target_module: 'Module 4: Automated Invoicing & Billing',
      subscription_id: sub.id,
      subscription_uuid: sub.uuid,
      subscription_number: sub.subscription_number,
      customer: {
        id: sub.customer_id,
        uuid: sub.customer_uuid,
        name: sub.customer_name,
        email: sub.customer_email
      },
      plan: {
        id: sub.plan_id,
        name: sub.plan_name,
        code: sub.plan_code,
        billing_frequency: sub.billing_frequency
      },
      dates: {
        start_date: sub.start_date,
        expiry_date: sub.expiry_date,
        invoice_date: invoiceDate.toISOString().split('T')[0],
        due_date: dueDate.toISOString().split('T')[0]
      },
      payment_terms: sub.payment_terms,
      currency: sub.currency || 'INR',
      items: lines.map(line => ({
        line_id: line.id,
        product_id: line.product_id,
        product_name: line.product_name,
        product_type: line.product_type,
        variant_id: line.variant_id,
        variant_name: line.variant_name,
        quantity: line.quantity,
        base_unit_price: line.base_unit_price,
        variant_additional_price: line.variant_additional_price,
        unit_price: line.unit_price,
        gross_amount: line.gross_amount,
        tax_code: line.tax_code,
        tax_rate: line.tax_rate,
        tax_amount: line.tax_amount,
        line_total: line.line_total
      })),
      discount: sub.discount_code ? {
        id: sub.discount_id,
        code: sub.discount_code,
        amount: sub.discount_amount
      } : null,
      summary: {
        subtotal: sub.subtotal,
        discount_amount: sub.discount_amount,
        taxable_amount: Math.max(0, Number((sub.subtotal - sub.discount_amount).toFixed(2))),
        tax_amount: sub.tax_amount,
        total_amount: sub.total_amount
      }
    };

    res.json({
      success: true,
      data: { invoice_payload: invoicePayload }
    });
  } catch (error) {
    console.error('Invoice payload error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate invoice payload.' });
  }
};

/**
 * Get subscription metrics for dashboards.
 */
exports.getSubscriptionStats = async (req, res) => {
  try {
    const totalSubs = db.prepare('SELECT COUNT(*) as count FROM subscriptions').get().count;
    const activeSubs = db.prepare("SELECT COUNT(*) as count FROM subscriptions WHERE status = 'Active'").get().count;
    const pausedSubs = db.prepare("SELECT COUNT(*) as count FROM subscriptions WHERE status = 'Paused'").get().count;
    const closedSubs = db.prepare("SELECT COUNT(*) as count FROM subscriptions WHERE status = 'Closed'").get().count;
    const totalQuotes = db.prepare('SELECT COUNT(*) as count FROM quotations').get().count;

    const totalRevenueRow = db.prepare("SELECT SUM(total_amount) as total FROM subscriptions WHERE status = 'Active'").get();
    const activeMRR = totalRevenueRow && totalRevenueRow.total ? parseFloat(totalRevenueRow.total) : 0.0;

    res.json({
      success: true,
      data: {
        total_subscriptions: totalSubs,
        active_subscriptions: activeSubs,
        paused_subscriptions: pausedSubs,
        closed_subscriptions: closedSubs,
        total_quotations: totalQuotes,
        active_annual_value: Number(activeMRR.toFixed(2))
      }
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to calculate subscription stats.' });
  }
};
