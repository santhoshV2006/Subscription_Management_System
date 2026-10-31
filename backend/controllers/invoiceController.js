/**
 * Brightloop Software — Module 4: Invoice Management Controller
 * Handles automated invoice generation from Module 3 subscriptions,
 * CRUD operations, lifecycle state machine (Draft, Confirmed, Paid, Cancelled),
 * duplicate prevention, sequential numbering, and financial auditing.
 */

const { v4: uuidv4 } = require('uuid');
const { db } = require('../config/database');
const {
  generateDocumentNumber,
  recordInvoiceHistory
} = require('../utils/subscriptionEngine');
const { recordDiscountUsage } = require('../utils/pricingEngine');

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER: Generate Invoice Payload from Subscription (Module 3 Integration)
// ═══════════════════════════════════════════════════════════════════════════════

function fetchSubscriptionInvoicePayload(subscriptionId) {
  const isNum = !isNaN(Number(subscriptionId));
  const sub = db.prepare(`
    SELECT s.*,
           u.id as customer_id, u.uuid as customer_uuid, u.name as customer_name, u.email as customer_email,
           sp.name as plan_name, sp.billing_frequency, sp.code as plan_code
    FROM subscriptions s
    JOIN users u ON s.customer_id = u.id
    JOIN subscription_plans sp ON s.plan_id = sp.id
    WHERE ${isNum ? 's.id = ?' : 's.uuid = ?'}
  `).get(isNum ? Number(subscriptionId) : subscriptionId);

  if (!sub) return null;

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
  }

  const invoiceDateStr = invoiceDate.toISOString().split('T')[0];
  const dueDateStr = dueDate.toISOString().split('T')[0];

  return {
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
      invoice_date: invoiceDateStr,
      due_date: dueDateStr
    },
    payment_terms: sub.payment_terms || 'Net 30',
    currency: sub.currency || 'INR',
    items: lines.map(line => ({
      line_id: line.id,
      product_id: line.product_id,
      product_name: line.product_name,
      product_type: line.product_type || 'service',
      variant_id: line.variant_id,
      variant_name: line.variant_name,
      quantity: line.quantity,
      base_unit_price: line.base_unit_price,
      variant_additional_price: line.variant_additional_price || 0.0,
      unit_price: line.unit_price,
      gross_amount: line.gross_amount,
      tax_id: line.tax_id,
      tax_code: line.tax_code || 'GST18',
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
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. LIST INVOICES (WITH FILTERS, SEARCH, ROLE SCOPING)
// ═══════════════════════════════════════════════════════════════════════════════

exports.getAllInvoices = async (req, res) => {
  try {
    const {
      status,
      search,
      subscription_id,
      customer_id,
      start_date,
      end_date,
      page = 1,
      limit = 50
    } = req.query;

    const conditions = [];
    const params = [];

    // Role scoping: Customers only see their own invoices
    if (req.user && req.user.role_name === 'customer') {
      conditions.push('i.customer_id = ?');
      params.push(req.user.id);
    } else if (customer_id) {
      conditions.push('i.customer_id = ?');
      params.push(Number(customer_id));
    }

    if (status) {
      conditions.push('i.status = ?');
      params.push(status);
    }

    if (subscription_id) {
      const isNum = !isNaN(Number(subscription_id));
      if (isNum) {
        conditions.push('(i.subscription_id = ?)');
        params.push(Number(subscription_id));
      } else {
        conditions.push('(i.subscription_number = ?)');
        params.push(subscription_id);
      }
    }

    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      conditions.push('(i.invoice_number LIKE ? OR i.customer_name LIKE ? OR i.customer_email LIKE ? OR i.subscription_number LIKE ?)');
      params.push(q, q, q, q);
    }

    if (start_date) {
      conditions.push('date(i.invoice_date) >= date(?)');
      params.push(start_date);
    }

    if (end_date) {
      conditions.push('date(i.invoice_date) <= date(?)');
      params.push(end_date);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Total count for pagination
    const countRow = db.prepare(`SELECT COUNT(*) as total FROM invoices i ${whereClause}`).get(...params);
    const total = countRow ? countRow.total : 0;

    const offset = (Math.max(1, parseInt(page, 10)) - 1) * Math.max(1, parseInt(limit, 10));
    const limitNum = Math.max(1, parseInt(limit, 10));

    const invoices = db.prepare(`
      SELECT i.*,
             (SELECT COUNT(*) FROM invoice_lines il WHERE il.invoice_id = i.id) as line_items_count
      FROM invoices i
      ${whereClause}
      ORDER BY i.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limitNum, offset);

    res.json({
      success: true,
      data: {
        invoices,
        total,
        page: Number(page),
        limit: limitNum,
        total_pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Get all invoices error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve invoices.' });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 2. INVOICE KPI STATS (ADMIN & STAFF)
// ═══════════════════════════════════════════════════════════════════════════════

exports.getInvoiceStats = async (req, res) => {
  try {
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total_invoices,
        SUM(CASE WHEN status = 'Draft' THEN 1 ELSE 0 END) as draft_invoices,
        SUM(CASE WHEN status = 'Confirmed' THEN 1 ELSE 0 END) as confirmed_invoices,
        SUM(CASE WHEN status = 'Paid' THEN 1 ELSE 0 END) as paid_invoices,
        SUM(CASE WHEN status = 'Cancelled' THEN 1 ELSE 0 END) as cancelled_invoices,
        COALESCE(SUM(CASE WHEN status = 'Paid' THEN total_amount ELSE 0 END), 0.0) as total_revenue,
        COALESCE(SUM(CASE WHEN status = 'Confirmed' THEN (total_amount - amount_paid) ELSE 0 END), 0.0) as receivable_amount,
        COALESCE(SUM(CASE WHEN status = 'Draft' THEN total_amount ELSE 0 END), 0.0) as draft_amount
      FROM invoices
    `).get();

    res.json({
      success: true,
      data: {
        total_invoices: stats.total_invoices || 0,
        draft_invoices: stats.draft_invoices || 0,
        confirmed_invoices: stats.confirmed_invoices || 0,
        paid_invoices: stats.paid_invoices || 0,
        cancelled_invoices: stats.cancelled_invoices || 0,
        total_revenue: Number(parseFloat(stats.total_revenue || 0).toFixed(2)),
        receivable_amount: Number(parseFloat(stats.receivable_amount || 0).toFixed(2)),
        draft_amount: Number(parseFloat(stats.draft_amount || 0).toFixed(2))
      }
    });
  } catch (error) {
    console.error('Invoice stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to compute invoice statistics.' });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 3. GET INVOICE BY ID (WITH FULL DETAILS, LINES & AUDIT HISTORY)
// ═══════════════════════════════════════════════════════════════════════════════

exports.getInvoiceById = async (req, res) => {
  try {
    const { id } = req.params;
    const isNum = !isNaN(Number(id));

    const invoice = db.prepare(`
      SELECT i.*, 
             u.uuid as customer_uuid,
             s.uuid as subscription_uuid, s.status as subscription_status,
             creator.name as created_by_name
      FROM invoices i
      JOIN users u ON i.customer_id = u.id
      JOIN subscriptions s ON i.subscription_id = s.id
      LEFT JOIN users creator ON i.created_by = creator.id
      WHERE ${isNum ? 'i.id = ?' : 'i.uuid = ?'}
    `).get(isNum ? Number(id) : id);

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found.' });
    }

    // Role scoping: Customer can only view own invoice
    if (req.user && req.user.role_name === 'customer' && invoice.customer_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    // Fetch lines
    const lines = db.prepare(`
      SELECT il.*, 
             p.uuid as product_uuid,
             pv.uuid as variant_uuid
      FROM invoice_lines il
      LEFT JOIN products p ON il.product_id = p.id
      LEFT JOIN product_variants pv ON il.variant_id = pv.id
      WHERE il.invoice_id = ?
      ORDER BY il.id ASC
    `).all(invoice.id);

    // Fetch audit history
    const history = db.prepare(`
      SELECT ih.*, u.name as changed_by_name
      FROM invoice_history ih
      LEFT JOIN users u ON ih.changed_by = u.id
      WHERE ih.invoice_id = ?
      ORDER BY ih.created_at DESC
    `).all(invoice.id);

    res.json({
      success: true,
      data: {
        invoice: {
          ...invoice,
          lines,
          history
        }
      }
    });
  } catch (error) {
    console.error('Get invoice details error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve invoice details.' });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 4. GET INVOICE HISTORY
// ═══════════════════════════════════════════════════════════════════════════════

exports.getInvoiceHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const isNum = !isNaN(Number(id));

    const invoice = db.prepare(`
      SELECT id, customer_id, invoice_number FROM invoices WHERE ${isNum ? 'id = ?' : 'uuid = ?'}
    `).get(isNum ? Number(id) : id);

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found.' });
    }

    if (req.user && req.user.role_name === 'customer' && invoice.customer_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const history = db.prepare(`
      SELECT ih.*, u.name as changed_by_name
      FROM invoice_history ih
      LEFT JOIN users u ON ih.changed_by = u.id
      WHERE ih.invoice_id = ?
      ORDER BY ih.created_at DESC
    `).all(invoice.id);

    res.json({ success: true, data: { history } });
  } catch (error) {
    console.error('Get invoice history error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve invoice history.' });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 5. GENERATE INVOICE FROM MODULE 3 SUBSCRIPTION (REQUIREMENT 3 & 7)
// ═══════════════════════════════════════════════════════════════════════════════

exports.generateFromSubscription = async (req, res) => {
  try {
    const subscriptionId = req.params.subscriptionId || req.body.subscription_id;
    if (!subscriptionId) {
      return res.status(400).json({ success: false, message: 'Subscription ID is required.' });
    }

    const payload = fetchSubscriptionInvoicePayload(subscriptionId);
    if (!payload) {
      return res.status(404).json({ success: false, message: 'Subscription not found.' });
    }

    const billingStart = req.body.billing_period_start || payload.dates.start_date;
    const billingEnd = req.body.billing_period_end || payload.dates.expiry_date;
    const invoiceDate = req.body.invoice_date || payload.dates.invoice_date;
    const dueDate = req.body.due_date || payload.dates.due_date;
    const notes = req.body.notes || `Generated automatically from subscription ${payload.subscription_number}`;

    // ─── REQUIREMENT 7: Prevent duplicate invoices for the same subscription and billing period ───
    const existing = db.prepare(`
      SELECT id, invoice_number, status, billing_period_start, billing_period_end
      FROM invoices
      WHERE subscription_id = ?
        AND billing_period_start = ?
        AND billing_period_end = ?
        AND status != 'Cancelled'
    `).get(payload.subscription_id, billingStart, billingEnd);

    if (existing) {
      return res.status(409).json({
        success: false,
        message: `An active or draft invoice (${existing.invoice_number}) with status '${existing.status}' already exists for this subscription and billing period (${billingStart} to ${billingEnd}).`,
        existing_invoice_id: existing.id,
        existing_invoice_number: existing.invoice_number
      });
    }

    // ─── REQUIREMENT 2: Unique sequential invoice number (INV-2026-00001) ───
    const invoiceNumber = generateDocumentNumber('INV');
    const invoiceUuid = uuidv4();
    const createdBy = req.user ? req.user.id : null;

    // Database transaction to create invoice and lines
    const createTx = db.transaction(() => {
      const invoiceInsert = db.prepare(`
        INSERT INTO invoices (
          uuid, invoice_number, subscription_id, customer_id, customer_name, customer_email,
          subscription_number, plan_id, plan_name, billing_frequency,
          invoice_date, due_date, billing_period_start, billing_period_end,
          payment_terms, currency, subtotal, discount_id, discount_code, discount_amount,
          taxable_amount, tax_amount, total_amount, amount_paid, status, notes, created_by
        ) VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, 0.0, 'Draft', ?, ?
        )
      `);

      const info = invoiceInsert.run(
        invoiceUuid,
        invoiceNumber,
        payload.subscription_id,
        payload.customer.id,
        payload.customer.name,
        payload.customer.email,
        payload.subscription_number,
        payload.plan.id,
        payload.plan.name,
        payload.plan.billing_frequency,
        invoiceDate,
        dueDate,
        billingStart,
        billingEnd,
        payload.payment_terms,
        payload.currency,
        payload.summary.subtotal,
        payload.discount ? payload.discount.id : null,
        payload.discount ? payload.discount.code : null,
        payload.summary.discount_amount,
        payload.summary.taxable_amount,
        payload.summary.tax_amount,
        payload.summary.total_amount,
        notes,
        createdBy
      );

      const invoiceId = info.lastInsertRowid;

      // Insert line items
      const lineInsert = db.prepare(`
        INSERT INTO invoice_lines (
          uuid, invoice_id, product_id, variant_id, product_name, product_type, variant_name,
          quantity, base_unit_price, variant_additional_price, unit_price,
          gross_amount, tax_id, tax_code, tax_rate, tax_amount, line_total
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const item of payload.items) {
        lineInsert.run(
          uuidv4(),
          invoiceId,
          item.product_id,
          item.variant_id,
          item.product_name,
          item.product_type || 'service',
          item.variant_name,
          item.quantity,
          item.base_unit_price,
          item.variant_additional_price || 0.0,
          item.unit_price,
          item.gross_amount,
          item.tax_id || null,
          item.tax_code || 'GST18',
          item.tax_rate,
          item.tax_amount,
          item.line_total
        );
      }

      // Record History
      recordInvoiceHistory(invoiceId, {
        action: 'CREATE_FROM_SUBSCRIPTION',
        from_status: null,
        to_status: 'Draft',
        changed_by: createdBy,
        notes: `Invoice generated from subscription ${payload.subscription_number} for period ${billingStart} to ${billingEnd}`
      });

      // Activity log
      db.prepare(`
        INSERT INTO activity_logs (user_id, action, details)
        VALUES (?, 'INVOICE_GENERATED', ?)
      `).run(createdBy, `Generated Draft invoice ${invoiceNumber} from subscription ${payload.subscription_number}`);

      return invoiceId;
    });

    const newInvoiceId = createTx();

    const createdInvoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(newInvoiceId);
    const createdLines = db.prepare('SELECT * FROM invoice_lines WHERE invoice_id = ?').all(newInvoiceId);

    res.status(201).json({
      success: true,
      message: `Invoice ${invoiceNumber} generated successfully in Draft status.`,
      data: {
        invoice_id: newInvoiceId,
        invoice_uuid: invoiceUuid,
        invoice_number: invoiceNumber,
        invoice: {
          ...createdInvoice,
          lines: createdLines
        }
      }
    });
  } catch (error) {
    console.error('Generate invoice error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to generate invoice.' });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 6. CREATE CUSTOM / DIRECT INVOICE
// ═══════════════════════════════════════════════════════════════════════════════

exports.createInvoice = async (req, res) => {
  try {
    const {
      subscription_id,
      customer_id,
      invoice_date,
      due_date,
      billing_period_start,
      billing_period_end,
      payment_terms = 'Net 30',
      currency = 'INR',
      notes,
      lines = [],
      discount_code,
      discount_amount = 0.0
    } = req.body;

    if (!customer_id) {
      return res.status(400).json({ success: false, message: 'Customer ID is required.' });
    }
    if (!subscription_id) {
      return res.status(400).json({ success: false, message: 'Subscription ID is required.' });
    }
    if (!Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one line item is required.' });
    }

    const customer = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(customer_id);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }

    const sub = db.prepare(`
      SELECT s.*, sp.name as plan_name, sp.billing_frequency 
      FROM subscriptions s
      JOIN subscription_plans sp ON s.plan_id = sp.id
      WHERE s.id = ?
    `).get(subscription_id);

    if (!sub) {
      return res.status(404).json({ success: false, message: 'Subscription not found.' });
    }

    const bStart = billing_period_start || sub.start_date;
    const bEnd = billing_period_end || sub.expiry_date;
    const invDate = invoice_date || new Date().toISOString().split('T')[0];
    const dDate = due_date || sub.expiry_date;

    // Check duplicate
    const existing = db.prepare(`
      SELECT id, invoice_number, status
      FROM invoices
      WHERE subscription_id = ?
        AND billing_period_start = ?
        AND billing_period_end = ?
        AND status != 'Cancelled'
    `).get(sub.id, bStart, bEnd);

    if (existing) {
      return res.status(409).json({
        success: false,
        message: `An active or draft invoice (${existing.invoice_number}) with status '${existing.status}' already exists for this subscription and billing period (${bStart} to ${bEnd}).`,
        existing_invoice_id: existing.id
      });
    }

    // Calculate lines and summary
    let subtotal = 0.0;
    let totalTax = 0.0;
    const computedLines = lines.map(line => {
      const qty = Math.max(1, parseInt(line.quantity, 10) || 1);
      const unitPrice = parseFloat(line.unit_price || line.sales_price || 0.0);
      const gross = Number((unitPrice * qty).toFixed(2));
      subtotal += gross;

      const taxRate = parseFloat(line.tax_rate || 18.0);
      const lineTax = Number((gross * (taxRate / 100)).toFixed(2));
      const lineTotal = Number((gross + lineTax).toFixed(2));
      totalTax += lineTax;

      return {
        product_id: line.product_id || null,
        variant_id: line.variant_id || null,
        product_name: line.product_name || 'Standard Service',
        product_type: line.product_type || 'service',
        variant_name: line.variant_name || null,
        quantity: qty,
        base_unit_price: parseFloat(line.base_unit_price || unitPrice),
        variant_additional_price: parseFloat(line.variant_additional_price || 0.0),
        unit_price: unitPrice,
        gross_amount: gross,
        tax_id: line.tax_id || null,
        tax_code: line.tax_code || 'GST18',
        tax_rate: taxRate,
        tax_amount: lineTax,
        line_total: lineTotal
      };
    });

    const discAmt = parseFloat(discount_amount || 0.0);
    const taxableAmount = Math.max(0, Number((subtotal - discAmt).toFixed(2)));
    const totalAmount = Number((taxableAmount + totalTax).toFixed(2));

    const invoiceNumber = generateDocumentNumber('INV');
    const invoiceUuid = uuidv4();
    const createdBy = req.user ? req.user.id : null;

    const createTx = db.transaction(() => {
      const stmt = db.prepare(`
        INSERT INTO invoices (
          uuid, invoice_number, subscription_id, customer_id, customer_name, customer_email,
          subscription_number, plan_id, plan_name, billing_frequency,
          invoice_date, due_date, billing_period_start, billing_period_end,
          payment_terms, currency, subtotal, discount_code, discount_amount,
          taxable_amount, tax_amount, total_amount, amount_paid, status, notes, created_by
        ) VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, 0.0, 'Draft', ?, ?
        )
      `);

      const info = stmt.run(
        invoiceUuid,
        invoiceNumber,
        sub.id,
        customer.id,
        customer.name,
        customer.email,
        sub.subscription_number,
        sub.plan_id,
        sub.plan_name,
        sub.billing_frequency,
        invDate,
        dDate,
        bStart,
        bEnd,
        payment_terms,
        currency,
        Number(subtotal.toFixed(2)),
        discount_code || null,
        discAmt,
        taxableAmount,
        Number(totalTax.toFixed(2)),
        totalAmount,
        notes || null,
        createdBy
      );

      const invoiceId = info.lastInsertRowid;

      const lineInsert = db.prepare(`
        INSERT INTO invoice_lines (
          uuid, invoice_id, product_id, variant_id, product_name, product_type, variant_name,
          quantity, base_unit_price, variant_additional_price, unit_price,
          gross_amount, tax_id, tax_code, tax_rate, tax_amount, line_total
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const item of computedLines) {
        lineInsert.run(
          uuidv4(),
          invoiceId,
          item.product_id,
          item.variant_id,
          item.product_name,
          item.product_type,
          item.variant_name,
          item.quantity,
          item.base_unit_price,
          item.variant_additional_price,
          item.unit_price,
          item.gross_amount,
          item.tax_id,
          item.tax_code,
          item.tax_rate,
          item.tax_amount,
          item.line_total
        );
      }

      recordInvoiceHistory(invoiceId, {
        action: 'CREATE_CUSTOM',
        from_status: null,
        to_status: 'Draft',
        changed_by: createdBy,
        notes: `Created custom Draft invoice for subscription ${sub.subscription_number}`
      });

      return invoiceId;
    });

    const newId = createTx();

    res.status(201).json({
      success: true,
      message: `Invoice ${invoiceNumber} created successfully.`,
      data: {
        invoice_id: newId,
        invoice_number: invoiceNumber
      }
    });
  } catch (error) {
    console.error('Create invoice error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to create invoice.' });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 7. UPDATE DRAFT INVOICE (REQUIREMENT 5)
// ═══════════════════════════════════════════════════════════════════════════════

exports.updateInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const isNum = !isNaN(Number(id));

    const invoice = db.prepare(`
      SELECT * FROM invoices WHERE ${isNum ? 'id = ?' : 'uuid = ?'}
    `).get(isNum ? Number(id) : id);

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found.' });
    }

    // ─── CRITICAL RULE: ONLY DRAFT INVOICES CAN BE MODIFIED ───
    if (invoice.status !== 'Draft') {
      return res.status(400).json({
        success: false,
        message: `Only Draft invoices can be modified. This invoice is currently '${invoice.status}'.`
      });
    }

    const {
      due_date,
      payment_terms,
      notes,
      discount_code,
      discount_amount,
      lines
    } = req.body;

    const updateDueDate = due_date || invoice.due_date;
    const updateTerms = payment_terms || invoice.payment_terms;
    const updateNotes = notes !== undefined ? notes : invoice.notes;
    const updateDiscCode = discount_code !== undefined ? discount_code : invoice.discount_code;
    const updateDiscAmt = discount_amount !== undefined ? parseFloat(discount_amount || 0) : invoice.discount_amount;

    const updateTx = db.transaction(() => {
      let subtotal = invoice.subtotal;
      let taxAmount = invoice.tax_amount;
      let taxableAmount = invoice.taxable_amount;
      let totalAmount = invoice.total_amount;

      // If new lines provided, recalculate and replace invoice_lines
      if (Array.isArray(lines) && lines.length > 0) {
        subtotal = 0.0;
        taxAmount = 0.0;

        const newLines = lines.map(line => {
          const qty = Math.max(1, parseInt(line.quantity, 10) || 1);
          const unitPrice = parseFloat(line.unit_price || 0.0);
          const gross = Number((unitPrice * qty).toFixed(2));
          subtotal += gross;

          const taxRate = parseFloat(line.tax_rate || 18.0);
          const lineTax = Number((gross * (taxRate / 100)).toFixed(2));
          const lineTotal = Number((gross + lineTax).toFixed(2));
          taxAmount += lineTax;

          return {
            product_id: line.product_id || null,
            variant_id: line.variant_id || null,
            product_name: line.product_name || 'Service Item',
            product_type: line.product_type || 'service',
            variant_name: line.variant_name || null,
            quantity: qty,
            base_unit_price: parseFloat(line.base_unit_price || unitPrice),
            variant_additional_price: parseFloat(line.variant_additional_price || 0.0),
            unit_price: unitPrice,
            gross_amount: gross,
            tax_id: line.tax_id || null,
            tax_code: line.tax_code || 'GST18',
            tax_rate: taxRate,
            tax_amount: lineTax,
            line_total: lineTotal
          };
        });

        subtotal = Number(subtotal.toFixed(2));
        taxableAmount = Math.max(0, Number((subtotal - updateDiscAmt).toFixed(2)));
        totalAmount = Number((taxableAmount + taxAmount).toFixed(2));

        // Delete old lines
        db.prepare('DELETE FROM invoice_lines WHERE invoice_id = ?').run(invoice.id);

        // Insert new lines
        const lineInsert = db.prepare(`
          INSERT INTO invoice_lines (
            uuid, invoice_id, product_id, variant_id, product_name, product_type, variant_name,
            quantity, base_unit_price, variant_additional_price, unit_price,
            gross_amount, tax_id, tax_code, tax_rate, tax_amount, line_total
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const item of newLines) {
          lineInsert.run(
            uuidv4(),
            invoice.id,
            item.product_id,
            item.variant_id,
            item.product_name,
            item.product_type,
            item.variant_name,
            item.quantity,
            item.base_unit_price,
            item.variant_additional_price,
            item.unit_price,
            item.gross_amount,
            item.tax_id,
            item.tax_code,
            item.tax_rate,
            item.tax_amount,
            item.line_total
          );
        }
      } else if (discount_amount !== undefined) {
        // Recalculate totals with updated discount
        taxableAmount = Math.max(0, Number((subtotal - updateDiscAmt).toFixed(2)));
        totalAmount = Number((taxableAmount + taxAmount).toFixed(2));
      }

      db.prepare(`
        UPDATE invoices
        SET due_date = ?,
            payment_terms = ?,
            notes = ?,
            discount_code = ?,
            discount_amount = ?,
            subtotal = ?,
            taxable_amount = ?,
            tax_amount = ?,
            total_amount = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        updateDueDate,
        updateTerms,
        updateNotes,
        updateDiscCode,
        updateDiscAmt,
        subtotal,
        taxableAmount,
        taxAmount,
        totalAmount,
        invoice.id
      );

      recordInvoiceHistory(invoice.id, {
        action: 'UPDATE_DRAFT',
        from_status: 'Draft',
        to_status: 'Draft',
        changed_by: req.user ? req.user.id : null,
        notes: 'Updated Draft invoice parameters and lines'
      });
    });

    updateTx();

    const updated = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoice.id);
    const updatedLines = db.prepare('SELECT * FROM invoice_lines WHERE invoice_id = ?').all(invoice.id);

    res.json({
      success: true,
      message: `Draft invoice ${invoice.invoice_number} updated successfully.`,
      data: {
        invoice: {
          ...updated,
          lines: updatedLines
        }
      }
    });
  } catch (error) {
    console.error('Update draft invoice error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to update invoice.' });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 8. CONFIRM INVOICE (DRAFT -> CONFIRMED)
// ═══════════════════════════════════════════════════════════════════════════════

exports.confirmInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const isNum = !isNaN(Number(id));

    const invoice = db.prepare(`SELECT * FROM invoices WHERE ${isNum ? 'id = ?' : 'uuid = ?'}`).get(isNum ? Number(id) : id);
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found.' });
    }

    if (invoice.status !== 'Draft') {
      return res.status(400).json({
        success: false,
        message: `Only Draft invoices can be confirmed. Current status: ${invoice.status}`
      });
    }

    db.prepare(`
      UPDATE invoices
      SET status = 'Confirmed',
          confirmed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(invoice.id);

    recordInvoiceHistory(invoice.id, {
      action: 'CONFIRM_INVOICE',
      from_status: 'Draft',
      to_status: 'Confirmed',
      changed_by: req.user ? req.user.id : null,
      notes: 'Draft invoice confirmed as official billable contract'
    });

    db.prepare(`
      INSERT INTO activity_logs (user_id, action, details)
      VALUES (?, 'INVOICE_CONFIRMED', ?)
    `).run(req.user ? req.user.id : null, `Confirmed invoice ${invoice.invoice_number}`);

    res.json({
      success: true,
      message: `Invoice ${invoice.invoice_number} has been confirmed.`,
      data: { status: 'Confirmed' }
    });
  } catch (error) {
    console.error('Confirm invoice error:', error);
    res.status(500).json({ success: false, message: 'Failed to confirm invoice.' });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 9. PAY INVOICE (CONFIRMED -> PAID)
// ═══════════════════════════════════════════════════════════════════════════════

exports.payInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const isNum = !isNaN(Number(id));

    const invoice = db.prepare(`SELECT * FROM invoices WHERE ${isNum ? 'id = ?' : 'uuid = ?'}`).get(isNum ? Number(id) : id);
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found.' });
    }

    // Role check: customer can only pay their own invoice
    if (req.user && req.user.role_name === 'customer' && invoice.customer_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    if (invoice.status === 'Paid') {
      return res.status(400).json({ success: false, message: 'Invoice is already marked as Paid.' });
    }

    if (invoice.status === 'Cancelled') {
      return res.status(400).json({ success: false, message: 'Cannot pay a cancelled invoice.' });
    }

    const {
      payment_method = 'Credit Card',
      payment_reference = `PAY-${Date.now()}`,
      notes = ''
    } = req.body;

    db.prepare(`
      UPDATE invoices
      SET status = 'Paid',
          paid_at = CURRENT_TIMESTAMP,
          amount_paid = total_amount,
          payment_method = ?,
          payment_reference = ?,
          notes = COALESCE(notes || ' | ', '') || ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(payment_method, payment_reference, notes ? `Paid: ${notes}` : 'Paid in full', invoice.id);

    // If discount code was present, record discount usage
    if (invoice.discount_id) {
      recordDiscountUsage(invoice.discount_id, invoice.customer_id, invoice.invoice_number, invoice.discount_amount);
    }

    recordInvoiceHistory(invoice.id, {
      action: 'PAY_INVOICE',
      from_status: invoice.status,
      to_status: 'Paid',
      changed_by: req.user ? req.user.id : null,
      notes: `Recorded full payment of ₹${invoice.total_amount} via ${payment_method} (Ref: ${payment_reference})`
    });

    db.prepare(`
      INSERT INTO activity_logs (user_id, action, details)
      VALUES (?, 'INVOICE_PAID', ?)
    `).run(req.user ? req.user.id : null, `Invoice ${invoice.invoice_number} paid in full (₹${invoice.total_amount})`);

    res.json({
      success: true,
      message: `Invoice ${invoice.invoice_number} marked as Paid.`,
      data: {
        status: 'Paid',
        amount_paid: invoice.total_amount,
        payment_reference
      }
    });
  } catch (error) {
    console.error('Pay invoice error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to record payment.' });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 10. CANCEL INVOICE (REQUIREMENT 5 & 6)
// ═══════════════════════════════════════════════════════════════════════════════

exports.cancelInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const isNum = !isNaN(Number(id));

    const invoice = db.prepare(`SELECT * FROM invoices WHERE ${isNum ? 'id = ?' : 'uuid = ?'}`).get(isNum ? Number(id) : id);
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found.' });
    }

    if (invoice.status === 'Cancelled') {
      return res.status(400).json({ success: false, message: 'Invoice is already cancelled.' });
    }

    const { reason = 'Cancelled by staff' } = req.body;

    db.prepare(`
      UPDATE invoices
      SET status = 'Cancelled',
          cancelled_at = CURRENT_TIMESTAMP,
          cancellation_reason = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(reason, invoice.id);

    recordInvoiceHistory(invoice.id, {
      action: 'CANCEL_INVOICE',
      from_status: invoice.status,
      to_status: 'Cancelled',
      changed_by: req.user ? req.user.id : null,
      notes: reason
    });

    db.prepare(`
      INSERT INTO activity_logs (user_id, action, details)
      VALUES (?, 'INVOICE_CANCELLED', ?)
    `).run(req.user ? req.user.id : null, `Cancelled invoice ${invoice.invoice_number}. Reason: ${reason}`);

    res.json({
      success: true,
      message: `Invoice ${invoice.invoice_number} has been cancelled.`,
      data: {
        status: 'Cancelled',
        cancellation_reason: reason
      }
    });
  } catch (error) {
    console.error('Cancel invoice error:', error);
    res.status(500).json({ success: false, message: 'Failed to cancel invoice.' });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 11. GENERAL STATUS UPDATE (PATCH /api/invoices/:id/status)
// ═══════════════════════════════════════════════════════════════════════════════

exports.updateInvoiceStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reason, payment_method, payment_reference } = req.body;

    const validStatuses = ['Draft', 'Confirmed', 'Paid', 'Cancelled'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    if (status === 'Confirmed') {
      return exports.confirmInvoice(req, res);
    } else if (status === 'Paid') {
      return exports.payInvoice(req, res);
    } else if (status === 'Cancelled') {
      return exports.cancelInvoice(req, res);
    } else if (status === 'Draft') {
      const isNum = !isNaN(Number(id));
      const invoice = db.prepare(`SELECT * FROM invoices WHERE ${isNum ? 'id = ?' : 'uuid = ?'}`).get(isNum ? Number(id) : id);
      if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found.' });

      if (invoice.status === 'Paid') {
        return res.status(400).json({ success: false, message: 'Paid invoices cannot be reverted to Draft.' });
      }

      db.prepare(`UPDATE invoices SET status = 'Draft', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(invoice.id);
      recordInvoiceHistory(invoice.id, {
        action: 'REVERT_TO_DRAFT',
        from_status: invoice.status,
        to_status: 'Draft',
        changed_by: req.user ? req.user.id : null,
        notes: reason || 'Reverted to Draft'
      });
      return res.json({ success: true, message: `Invoice reverted to Draft.`, data: { status: 'Draft' } });
    }
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ success: false, message: 'Failed to update invoice status.' });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 12. DELETE DRAFT INVOICE (ADMIN ONLY)
// ═══════════════════════════════════════════════════════════════════════════════

exports.deleteInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const isNum = !isNaN(Number(id));

    const invoice = db.prepare(`SELECT * FROM invoices WHERE ${isNum ? 'id = ?' : 'uuid = ?'}`).get(isNum ? Number(id) : id);
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found.' });
    }

    if (invoice.status !== 'Draft') {
      return res.status(400).json({
        success: false,
        message: `Only Draft invoices can be deleted. Current status is '${invoice.status}'.`
      });
    }

    db.prepare('DELETE FROM invoices WHERE id = ?').run(invoice.id);

    db.prepare(`
      INSERT INTO activity_logs (user_id, action, details)
      VALUES (?, 'INVOICE_DELETED', ?)
    `).run(req.user ? req.user.id : null, `Deleted Draft invoice ${invoice.invoice_number}`);

    res.json({
      success: true,
      message: `Draft invoice ${invoice.invoice_number} has been deleted.`
    });
  } catch (error) {
    console.error('Delete invoice error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete invoice.' });
  }
};

