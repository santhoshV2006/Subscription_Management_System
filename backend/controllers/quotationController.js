const { v4: uuidv4 } = require('uuid');
const { db } = require('../config/database');
const {
  generateDocumentNumber,
  calculateSubscriptionDetails,
  recordSubscriptionHistory
} = require('../utils/subscriptionEngine');
const { recordDiscountUsage } = require('../utils/pricingEngine');

// ═══════════════════════════════════════════════════════════════════════════════
// 1. QUOTATION TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get all quotation templates.
 */
exports.getAllTemplates = async (req, res) => {
  try {
    const templates = db.prepare(`
      SELECT qt.*, sp.name as plan_name, sp.billing_frequency, u.name as created_by_name
      FROM quotation_templates qt
      LEFT JOIN subscription_plans sp ON qt.plan_id = sp.id
      LEFT JOIN users u ON qt.created_by = u.id
      ORDER BY qt.created_at DESC
    `).all();

    // Attach template lines to each template
    const getLines = db.prepare(`
      SELECT qtl.*, p.name as product_name, p.sales_price, pv.variant_name, pv.additional_price
      FROM quotation_template_lines qtl
      JOIN products p ON qtl.product_id = p.id
      LEFT JOIN product_variants pv ON qtl.variant_id = pv.id
      WHERE qtl.template_id = ?
      ORDER BY qtl.sort_order ASC
    `);

    const result = templates.map(t => ({
      ...t,
      lines: getLines.all(t.id)
    }));

    res.json({
      success: true,
      data: { templates: result }
    });
  } catch (error) {
    console.error('Get templates error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve quotation templates.' });
  }
};

/**
 * Get quotation template by ID or UUID.
 */
exports.getTemplateById = async (req, res) => {
  try {
    const { id } = req.params;
    const isNum = !isNaN(Number(id));

    const template = db.prepare(`
      SELECT qt.*, sp.name as plan_name, sp.billing_frequency, sp.min_quantity
      FROM quotation_templates qt
      LEFT JOIN subscription_plans sp ON qt.plan_id = sp.id
      WHERE ${isNum ? 'qt.id = ?' : 'qt.uuid = ?'}
    `).get(isNum ? Number(id) : id);

    if (!template) {
      return res.status(404).json({ success: false, message: 'Quotation template not found.' });
    }

    const lines = db.prepare(`
      SELECT qtl.*, p.name as product_name, p.sales_price, p.tax_id,
             pv.variant_name, pv.additional_price
      FROM quotation_template_lines qtl
      JOIN products p ON qtl.product_id = p.id
      LEFT JOIN product_variants pv ON qtl.variant_id = pv.id
      WHERE qtl.template_id = ?
      ORDER BY qtl.sort_order ASC
    `).all(template.id);

    template.lines = lines;

    res.json({ success: true, data: { template } });
  } catch (error) {
    console.error('Get template by ID error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve quotation template.' });
  }
};

/**
 * Create a new quotation template.
 */
exports.createTemplate = async (req, res) => {
  try {
    const { name, description, plan_id, default_validity_days = 30, payment_terms = 'Net 30', lines = [] } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Template name is required.' });
    }

    if (!plan_id) {
      return res.status(400).json({ success: false, message: 'A subscription plan is required for this template.' });
    }

    if (!Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one predefined product line is required.' });
    }

    const plan = db.prepare('SELECT id FROM subscription_plans WHERE id = ?').get(Number(plan_id));
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Subscription plan not found.' });
    }

    const uuid = uuidv4();
    const insertTemplate = db.prepare(`
      INSERT INTO quotation_templates (uuid, name, description, plan_id, default_validity_days, payment_terms, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insertTemplate.run(
      uuid,
      name.trim(),
      description ? description.trim() : null,
      plan.id,
      parseInt(default_validity_days, 10) || 30,
      payment_terms || 'Net 30',
      req.user ? req.user.id : null
    );

    const templateId = result.lastInsertRowid;

    // Insert lines
    const insertLine = db.prepare(`
      INSERT INTO quotation_template_lines (template_id, product_id, variant_id, quantity, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `);

    lines.forEach((l, index) => {
      insertLine.run(
        templateId,
        Number(l.product_id),
        l.variant_id ? Number(l.variant_id) : null,
        Math.max(1, parseInt(l.quantity, 10) || 1),
        index
      );
    });

    res.status(201).json({
      success: true,
      message: 'Quotation template created successfully.',
      data: { template_id: templateId, uuid }
    });
  } catch (error) {
    console.error('Create template error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to create quotation template.' });
  }
};

/**
 * Update quotation template.
 */
exports.updateTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, plan_id, default_validity_days, payment_terms, lines, is_active } = req.body;
    const isNum = !isNaN(Number(id));

    const template = db.prepare(`
      SELECT id FROM quotation_templates WHERE ${isNum ? 'id = ?' : 'uuid = ?'}
    `).get(isNum ? Number(id) : id);

    if (!template) {
      return res.status(404).json({ success: false, message: 'Quotation template not found.' });
    }

    db.prepare(`
      UPDATE quotation_templates
      SET name = COALESCE(?, name),
          description = COALESCE(?, description),
          plan_id = COALESCE(?, plan_id),
          default_validity_days = COALESCE(?, default_validity_days),
          payment_terms = COALESCE(?, payment_terms),
          is_active = COALESCE(?, is_active),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name ? name.trim() : null,
      description !== undefined ? description : null,
      plan_id ? Number(plan_id) : null,
      default_validity_days ? parseInt(default_validity_days, 10) : null,
      payment_terms || null,
      is_active !== undefined ? (is_active ? 1 : 0) : null,
      template.id
    );

    // If new lines provided, replace existing
    if (Array.isArray(lines) && lines.length > 0) {
      db.prepare('DELETE FROM quotation_template_lines WHERE template_id = ?').run(template.id);
      const insertLine = db.prepare(`
        INSERT INTO quotation_template_lines (template_id, product_id, variant_id, quantity, sort_order)
        VALUES (?, ?, ?, ?, ?)
      `);
      lines.forEach((l, index) => {
        insertLine.run(
          template.id,
          Number(l.product_id),
          l.variant_id ? Number(l.variant_id) : null,
          Math.max(1, parseInt(l.quantity, 10) || 1),
          index
        );
      });
    }

    res.json({ success: true, message: 'Quotation template updated successfully.' });
  } catch (error) {
    console.error('Update template error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to update quotation template.' });
  }
};

/**
 * Delete quotation template.
 */
exports.deleteTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const isNum = !isNaN(Number(id));

    const template = db.prepare(`
      SELECT id FROM quotation_templates WHERE ${isNum ? 'id = ?' : 'uuid = ?'}
    `).get(isNum ? Number(id) : id);

    if (!template) {
      return res.status(404).json({ success: false, message: 'Quotation template not found.' });
    }

    db.prepare('DELETE FROM quotation_template_lines WHERE template_id = ?').run(template.id);
    db.prepare('DELETE FROM quotation_templates WHERE id = ?').run(template.id);

    res.json({ success: true, message: 'Quotation template deleted successfully.' });
  } catch (error) {
    console.error('Delete template error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete quotation template.' });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 2. QUOTATIONS CRUD & MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get all quotations.
 * Customer sees only their own quotations; Admin and Staff see all.
 */
exports.getAllQuotations = async (req, res) => {
  try {
    const { status, customer_id, search } = req.query;
    let whereClause = 'WHERE 1=1';
    const params = [];

    // Role-based scoping: customer can only see their own
    if (req.user && req.user.role_name === 'customer') {
      whereClause += ' AND q.customer_id = ?';
      params.push(req.user.id);
    } else if (customer_id) {
      whereClause += ' AND q.customer_id = ?';
      params.push(Number(customer_id));
    }

    if (status) {
      whereClause += ' AND q.status = ?';
      params.push(status);
    }

    if (search) {
      whereClause += ' AND (q.quotation_number LIKE ? OR u.name LIKE ? OR u.email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const quotations = db.prepare(`
      SELECT q.*, u.name as customer_name, u.email as customer_email,
             sp.name as plan_name, sp.billing_frequency,
             qt.name as template_name
      FROM quotations q
      JOIN users u ON q.customer_id = u.id
      JOIN subscription_plans sp ON q.plan_id = sp.id
      LEFT JOIN quotation_templates qt ON q.template_id = qt.id
      ${whereClause}
      ORDER BY q.created_at DESC
    `).all(...params);

    // Attach lines count
    const getLinesCount = db.prepare('SELECT COUNT(*) as count FROM quotation_lines WHERE quotation_id = ?');
    const result = quotations.map(q => ({
      ...q,
      lines_count: getLinesCount.get(q.id).count
    }));

    res.json({
      success: true,
      data: { quotations: result }
    });
  } catch (error) {
    console.error('Get all quotations error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve quotations.' });
  }
};

/**
 * Get single quotation with lines.
 */
exports.getQuotationById = async (req, res) => {
  try {
    const { id } = req.params;
    const isNum = !isNaN(Number(id));

    const quotation = db.prepare(`
      SELECT q.*, u.name as customer_name, u.email as customer_email,
             sp.name as plan_name, sp.billing_frequency, sp.code as plan_code,
             qt.name as template_name,
             s.subscription_number as converted_subscription_number
      FROM quotations q
      JOIN users u ON q.customer_id = u.id
      JOIN subscription_plans sp ON q.plan_id = sp.id
      LEFT JOIN quotation_templates qt ON q.template_id = qt.id
      LEFT JOIN subscriptions s ON q.converted_subscription_id = s.id
      WHERE ${isNum ? 'q.id = ?' : 'q.uuid = ?'}
    `).get(isNum ? Number(id) : id);

    if (!quotation) {
      return res.status(404).json({ success: false, message: 'Quotation not found.' });
    }

    // Role-based check
    if (req.user && req.user.role_name === 'customer' && quotation.customer_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'You do not have access to this quotation.' });
    }

    const lines = db.prepare(`
      SELECT ql.*, p.name as product_name, p.product_type,
             pv.variant_name, pv.sku as variant_sku,
             t.name as tax_name, t.code as tax_code
      FROM quotation_lines ql
      JOIN products p ON ql.product_id = p.id
      LEFT JOIN product_variants pv ON ql.variant_id = pv.id
      LEFT JOIN taxes t ON ql.tax_id = t.id
      WHERE ql.quotation_id = ?
    `).all(quotation.id);

    quotation.lines = lines;

    res.json({ success: true, data: { quotation } });
  } catch (error) {
    console.error('Get quotation by ID error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve quotation details.' });
  }
};

/**
 * Create quotation (from template or scratch).
 */
exports.createQuotation = async (req, res) => {
  try {
    const {
      customer_id,
      plan_id,
      template_id = null,
      validity_days = 30,
      payment_terms = 'Net 30',
      lines = [],
      discount_code = null,
      notes = null
    } = req.body;

    // Validate customer
    let customer = null;
    if (req.user && req.user.role_name === 'customer') {
      customer = req.user;
    } else {
      if (!customer_id) {
        return res.status(400).json({ success: false, message: 'Customer ID is required.' });
      }
      customer = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(Number(customer_id));
      if (!customer) {
        return res.status(404).json({ success: false, message: 'Customer not found.' });
      }
    }

    // If template_id provided and lines not provided, populate lines from template
    let finalLines = lines;
    let finalPlanId = plan_id;
    let finalValidity = parseInt(validity_days, 10) || 30;
    let finalTerms = payment_terms;

    if (template_id && (!finalLines || finalLines.length === 0)) {
      const template = db.prepare('SELECT * FROM quotation_templates WHERE id = ?').get(Number(template_id));
      if (!template) {
        return res.status(404).json({ success: false, message: 'Quotation template not found.' });
      }
      if (!finalPlanId) finalPlanId = template.plan_id;
      finalValidity = template.default_validity_days;
      finalTerms = template.payment_terms;

      const tLines = db.prepare('SELECT product_id, variant_id, quantity FROM quotation_template_lines WHERE template_id = ?').all(template.id);
      finalLines = tLines;
    }

    if (!finalPlanId) {
      return res.status(400).json({ success: false, message: 'A subscription plan is required.' });
    }

    // Calculate quotation line items and totals
    const calculation = calculateSubscriptionDetails({
      plan_id: finalPlanId,
      lines: finalLines,
      discount_code,
      start_date: new Date().toISOString().split('T')[0]
    });

    const issueDate = new Date();
    const validUntil = new Date(issueDate);
    validUntil.setDate(validUntil.getDate() + finalValidity);

    const issueDateStr = issueDate.toISOString().split('T')[0];
    const validUntilStr = validUntil.toISOString().split('T')[0];

    const quotationNumber = generateDocumentNumber('QT');
    const uuid = uuidv4();

    const insertQuote = db.prepare(`
      INSERT INTO quotations (
        uuid, quotation_number, template_id, customer_id, plan_id,
        status, validity_days, issue_date, valid_until, payment_terms,
        subtotal, discount_id, discount_code, discount_amount,
        tax_amount, total_amount, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, 'Draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insertQuote.run(
      uuid,
      quotationNumber,
      template_id ? Number(template_id) : null,
      customer.id,
      calculation.plan.id,
      finalValidity,
      issueDateStr,
      validUntilStr,
      finalTerms,
      calculation.subtotal,
      calculation.discount_id,
      calculation.discount_code,
      calculation.discount_amount,
      calculation.tax_amount,
      calculation.total_amount,
      notes ? notes.trim() : null,
      req.user ? req.user.id : null
    );

    const quotationId = result.lastInsertRowid;

    // Insert quotation lines
    const insertLine = db.prepare(`
      INSERT INTO quotation_lines (
        quotation_id, product_id, variant_id, product_name, variant_name,
        quantity, base_unit_price, variant_additional_price, unit_price,
        gross_amount, tax_id, tax_rate, tax_amount, line_total
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const line of calculation.lines) {
      insertLine.run(
        quotationId,
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

    res.status(201).json({
      success: true,
      message: `Quotation ${quotationNumber} generated successfully.`,
      data: {
        quotation_id: quotationId,
        quotation_number: quotationNumber,
        uuid,
        calculation
      }
    });
  } catch (error) {
    console.error('Create quotation error:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to create quotation.' });
  }
};

/**
 * Update an existing quotation (edit lines, plan, or terms before confirmation).
 */
exports.updateQuotation = async (req, res) => {
  try {
    const { id } = req.params;
    const isNum = !isNaN(Number(id));

    const quotation = db.prepare(`
      SELECT * FROM quotations WHERE ${isNum ? 'id = ?' : 'uuid = ?'}
    `).get(isNum ? Number(id) : id);

    if (!quotation) {
      return res.status(404).json({ success: false, message: 'Quotation not found.' });
    }

    if (['Converted', 'Rejected', 'Expired'].includes(quotation.status)) {
      return res.status(400).json({
        success: false,
        message: `Quotation is in "${quotation.status}" state and cannot be modified.`
      });
    }

    const {
      plan_id = quotation.plan_id,
      validity_days = quotation.validity_days,
      payment_terms = quotation.payment_terms,
      lines,
      discount_code = quotation.discount_code,
      notes = quotation.notes
    } = req.body;

    // If new lines provided, calculate with new lines; otherwise fetch existing lines
    let lineItems = lines;
    if (!lineItems || lineItems.length === 0) {
      lineItems = db.prepare('SELECT product_id, variant_id, quantity FROM quotation_lines WHERE quotation_id = ?').all(quotation.id);
    }

    const calculation = calculateSubscriptionDetails({
      plan_id,
      lines: lineItems,
      discount_code,
      start_date: quotation.issue_date
    });

    const issueDate = new Date(quotation.issue_date);
    const validUntil = new Date(issueDate);
    validUntil.setDate(validUntil.getDate() + parseInt(validity_days, 10));
    const validUntilStr = validUntil.toISOString().split('T')[0];

    // Update header
    db.prepare(`
      UPDATE quotations
      SET plan_id = ?,
          validity_days = ?,
          valid_until = ?,
          payment_terms = ?,
          subtotal = ?,
          discount_id = ?,
          discount_code = ?,
          discount_amount = ?,
          tax_amount = ?,
          total_amount = ?,
          notes = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      calculation.plan.id,
      parseInt(validity_days, 10),
      validUntilStr,
      payment_terms,
      calculation.subtotal,
      calculation.discount_id,
      calculation.discount_code,
      calculation.discount_amount,
      calculation.tax_amount,
      calculation.total_amount,
      notes,
      quotation.id
    );

    // Recreate lines
    db.prepare('DELETE FROM quotation_lines WHERE quotation_id = ?').run(quotation.id);
    const insertLine = db.prepare(`
      INSERT INTO quotation_lines (
        quotation_id, product_id, variant_id, product_name, variant_name,
        quantity, base_unit_price, variant_additional_price, unit_price,
        gross_amount, tax_id, tax_rate, tax_amount, line_total
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const line of calculation.lines) {
      insertLine.run(
        quotation.id,
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

    res.json({
      success: true,
      message: `Quotation ${quotation.quotation_number} updated successfully.`,
      data: { quotation_id: quotation.id, calculation }
    });
  } catch (error) {
    console.error('Update quotation error:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to update quotation.' });
  }
};

/**
 * Change quotation status (Sent, Accepted, Rejected, Expired).
 */
exports.updateQuotationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const isNum = !isNaN(Number(id));

    const allowed = ['Draft', 'Sent', 'Accepted', 'Rejected', 'Expired'];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Allowed values: ${allowed.join(', ')}`
      });
    }

    const quotation = db.prepare(`
      SELECT * FROM quotations WHERE ${isNum ? 'id = ?' : 'uuid = ?'}
    `).get(isNum ? Number(id) : id);

    if (!quotation) {
      return res.status(404).json({ success: false, message: 'Quotation not found.' });
    }

    if (quotation.status === 'Converted') {
      return res.status(400).json({
        success: false,
        message: 'This quotation has already been converted into an active subscription.'
      });
    }

    db.prepare(`
      UPDATE quotations
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, quotation.id);

    res.json({
      success: true,
      message: `Quotation ${quotation.quotation_number} status updated to "${status}".`
    });
  } catch (error) {
    console.error('Update quotation status error:', error);
    res.status(500).json({ success: false, message: 'Failed to update quotation status.' });
  }
};

/**
 * Convert accepted quotation into an active/confirmed subscription.
 */
exports.convertQuotationToSubscription = async (req, res) => {
  try {
    const { id } = req.params;
    const { initial_status = 'Active', start_date = null } = req.body;
    const isNum = !isNaN(Number(id));

    const quotation = db.prepare(`
      SELECT * FROM quotations WHERE ${isNum ? 'id = ?' : 'uuid = ?'}
    `).get(isNum ? Number(id) : id);

    if (!quotation) {
      return res.status(404).json({ success: false, message: 'Quotation not found.' });
    }

    if (quotation.status === 'Converted' && quotation.converted_subscription_id) {
      return res.status(400).json({
        success: false,
        message: `Quotation already converted to subscription ID ${quotation.converted_subscription_id}.`
      });
    }

    // Fetch plan to calculate dates
    const plan = db.prepare('SELECT * FROM subscription_plans WHERE id = ?').get(quotation.plan_id);
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Associated subscription plan not found.' });
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const startDate = start_date || todayStr;
    const { calculateExpiryDate } = require('../utils/subscriptionEngine');
    const expiryDate = calculateExpiryDate(startDate, plan.billing_frequency);

    // Fetch quotation lines
    const qLines = db.prepare('SELECT * FROM quotation_lines WHERE quotation_id = ?').all(quotation.id);
    if (qLines.length === 0) {
      return res.status(400).json({ success: false, message: 'Quotation contains no lines to convert.' });
    }

    // Generate Subscription number
    const subNumber = generateDocumentNumber('SUB');
    const subUuid = uuidv4();

    const insertSub = db.prepare(`
      INSERT INTO subscriptions (
        uuid, subscription_number, customer_id, plan_id, status,
        start_date, expiry_date, payment_terms, subtotal,
        discount_id, discount_code, discount_amount, tax_amount, total_amount,
        notes, quotation_id, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const subResult = insertSub.run(
      subUuid,
      subNumber,
      quotation.customer_id,
      quotation.plan_id,
      initial_status,
      startDate,
      expiryDate,
      quotation.payment_terms,
      quotation.subtotal,
      quotation.discount_id,
      quotation.discount_code,
      quotation.discount_amount,
      quotation.tax_amount,
      quotation.total_amount,
      `Converted from Quotation ${quotation.quotation_number}. ${quotation.notes || ''}`.trim(),
      quotation.id,
      req.user ? req.user.id : null
    );

    const subscriptionId = subResult.lastInsertRowid;

    // Copy lines into subscription_lines
    const insertSubLine = db.prepare(`
      INSERT INTO subscription_lines (
        uuid, subscription_id, product_id, variant_id, product_name, variant_name,
        quantity, base_unit_price, variant_additional_price, unit_price,
        gross_amount, tax_id, tax_rate, tax_amount, line_total
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const ql of qLines) {
      insertSubLine.run(
        uuidv4(),
        subscriptionId,
        ql.product_id,
        ql.variant_id,
        ql.product_name,
        ql.variant_name,
        ql.quantity,
        ql.base_unit_price,
        ql.variant_additional_price,
        ql.unit_price,
        ql.gross_amount,
        ql.tax_id,
        ql.tax_rate,
        ql.tax_amount,
        ql.line_total
      );
    }

    // Record discount usage if applicable
    if (quotation.discount_id) {
      recordDiscountUsage(quotation.discount_id, quotation.customer_id, subNumber, quotation.discount_amount);
    }

    // Mark quotation as Converted
    db.prepare(`
      UPDATE quotations
      SET status = 'Converted', converted_subscription_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(subscriptionId, quotation.id);

    // Record initial history
    recordSubscriptionHistory(subscriptionId, {
      action: 'CONVERT_FROM_QUOTATION',
      from_status: 'Quotation',
      to_status: initial_status,
      changed_by: req.user ? req.user.id : null,
      notes: `Successfully converted from Quotation ${quotation.quotation_number}`,
      metadata: { quotation_id: quotation.id, quotation_number: quotation.quotation_number }
    });

    res.status(201).json({
      success: true,
      message: `Quotation ${quotation.quotation_number} converted into Subscription ${subNumber} successfully!`,
      data: {
        subscription_id: subscriptionId,
        subscription_number: subNumber,
        uuid: subUuid,
        status: initial_status,
        start_date: startDate,
        expiry_date: expiryDate,
        total_amount: quotation.total_amount
      }
    });
  } catch (error) {
    console.error('Convert quotation error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to convert quotation to subscription.' });
  }
};

/**
 * Delete quotation.
 */
exports.deleteQuotation = async (req, res) => {
  try {
    const { id } = req.params;
    const isNum = !isNaN(Number(id));

    const quotation = db.prepare(`
      SELECT * FROM quotations WHERE ${isNum ? 'id = ?' : 'uuid = ?'}
    `).get(isNum ? Number(id) : id);

    if (!quotation) {
      return res.status(404).json({ success: false, message: 'Quotation not found.' });
    }

    if (quotation.status === 'Converted') {
      return res.status(400).json({ success: false, message: 'Cannot delete a converted quotation.' });
    }

    db.prepare('DELETE FROM quotation_lines WHERE quotation_id = ?').run(quotation.id);
    db.prepare('DELETE FROM quotations WHERE id = ?').run(quotation.id);

    res.json({ success: true, message: `Quotation ${quotation.quotation_number} deleted successfully.` });
  } catch (error) {
    console.error('Delete quotation error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete quotation.' });
  }
};
