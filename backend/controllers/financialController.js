/**
 * Brightloop Software — Module 4 Feature 5: Financial Dashboard & Reports Controller
 * All figures are computed exclusively from live database records using SQL aggregation.
 * No hardcoded sample numbers anywhere.
 *
 * Endpoints:
 *  GET /api/financial/kpis             — 6 KPI cards with date-range support
 *  GET /api/financial/monthly-revenue  — Monthly revenue trend
 *  GET /api/financial/paid-vs-unpaid   — Paid vs unpaid invoice comparison
 *  GET /api/financial/revenue-by-method— Revenue breakdown by payment method
 *  GET /api/financial/status-distribution — Invoice status distribution
 *  GET /api/financial/report/invoices  — Filterable invoice report + CSV export
 *  GET /api/financial/report/payments  — Payment report + CSV export
 *  GET /api/financial/report/outstanding — Outstanding invoices (Confirmed, unpaid)
 *  GET /api/financial/report/overdue    — Overdue invoices (past due date, not Paid/Cancelled)
 *  GET /api/financial/report/customer-revenue — Customer-wise revenue summary
 */

const { db } = require('../config/database');

// ─── HELPERS ─────────────────────────────────────────────────────────────────

/**
 * Build SQL date filter clauses from ?start_date, ?end_date, ?period query params.
 * The period shortcuts: today, this_month, last_month, this_year
 */
function buildDateRange(query) {
  const today = new Date();
  const ymd = (d) => d.toISOString().split('T')[0];

  let startDate = query.start_date || null;
  let endDate   = query.end_date   || null;

  switch (query.period) {
    case 'today':
      startDate = ymd(today);
      endDate   = ymd(today);
      break;
    case 'this_month': {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      const last  = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      startDate = ymd(first);
      endDate   = ymd(last);
      break;
    }
    case 'last_month': {
      const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const last  = new Date(today.getFullYear(), today.getMonth(), 0);
      startDate = ymd(first);
      endDate   = ymd(last);
      break;
    }
    case 'this_year': {
      startDate = `${today.getFullYear()}-01-01`;
      endDate   = `${today.getFullYear()}-12-31`;
      break;
    }
    default:
      break;
  }

  return { startDate, endDate };
}

/**
 * Append date conditions to a WHERE clause array.
 * @param {string} column - SQL date column expression
 */
function appendDateConditions(conditions, params, startDate, endDate, column = 'date(i.invoice_date)') {
  if (startDate) {
    conditions.push(`${column} >= date(?)`);
    params.push(startDate);
  }
  if (endDate) {
    conditions.push(`${column} <= date(?)`);
    params.push(endDate);
  }
}

/** Format a number to 2 dp */
const fmt = (v) => Number(parseFloat(v || 0).toFixed(2));

/** CSV serialiser — escapes double-quotes, wraps all values */
function toCSV(headers, rows) {
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [headers.map(escape).join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h] ?? '')).join(','));
  }
  return lines.join('\r\n');
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. KPI CARDS — 6 headline financial metrics
// ═══════════════════════════════════════════════════════════════════════════════

exports.getKPIs = async (req, res) => {
  try {
    const { startDate, endDate } = buildDateRange(req.query);
    const today = new Date().toISOString().split('T')[0];

    const conditions = [];
    const params = [];
    appendDateConditions(conditions, params, startDate, endDate);
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const row = db.prepare(`
      SELECT
        COUNT(*) AS total_invoices,
        COALESCE(SUM(total_amount), 0)  AS total_invoiced,
        COALESCE(SUM(CASE WHEN status = 'Paid' THEN amount_paid ELSE 0 END), 0) AS total_collected,
        COALESCE(SUM(CASE WHEN status IN ('Confirmed','Draft') THEN (total_amount - amount_paid) ELSE 0 END), 0) AS outstanding_amount,
        COALESCE(SUM(CASE WHEN status IN ('Confirmed','Draft') AND date(due_date) < date(?) THEN (total_amount - amount_paid) ELSE 0 END), 0) AS overdue_amount,
        COALESCE(SUM(CASE WHEN status = 'Paid' THEN 1 ELSE 0 END), 0) AS total_payments_received
      FROM invoices i
      ${where}
    `).get(...params, today);

    res.json({
      success: true,
      data: {
        total_invoices:          row.total_invoices || 0,
        total_invoiced:          fmt(row.total_invoiced),
        total_collected:         fmt(row.total_collected),
        outstanding_amount:      fmt(row.outstanding_amount),
        overdue_amount:          fmt(row.overdue_amount),
        total_payments_received: row.total_payments_received || 0
      },
      filters: { start_date: startDate, end_date: endDate, period: req.query.period || null }
    });
  } catch (err) {
    console.error('Financial KPIs error:', err);
    res.status(500).json({ success: false, message: 'Failed to compute financial KPIs.' });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 2. MONTHLY REVENUE TREND — last 12 calendar months
// ═══════════════════════════════════════════════════════════════════════════════

exports.getMonthlyRevenue = async (req, res) => {
  try {
    // Use strftime to group by year-month for paid invoices
    const rows = db.prepare(`
      SELECT
        strftime('%Y-%m', invoice_date) AS month,
        COALESCE(SUM(amount_paid), 0)   AS revenue,
        COUNT(*)                        AS invoice_count
      FROM invoices
      WHERE status = 'Paid'
      GROUP BY strftime('%Y-%m', invoice_date)
      ORDER BY month ASC
      LIMIT 24
    `).all();

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Monthly revenue trend error:', err);
    res.status(500).json({ success: false, message: 'Failed to load monthly revenue trend.' });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 3. PAID VS UNPAID COMPARISON
// ═══════════════════════════════════════════════════════════════════════════════

exports.getPaidVsUnpaid = async (req, res) => {
  try {
    const { startDate, endDate } = buildDateRange(req.query);
    const conditions = [];
    const params = [];
    appendDateConditions(conditions, params, startDate, endDate);
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = db.prepare(`
      SELECT
        status,
        COUNT(*)                 AS invoice_count,
        COALESCE(SUM(total_amount), 0)  AS total_value,
        COALESCE(SUM(amount_paid), 0)   AS amount_paid
      FROM invoices i
      ${where}
      GROUP BY status
    `).all(...params);

    const summary = {
      paid:       rows.find(r => r.status === 'Paid')        || { status: 'Paid',       invoice_count: 0, total_value: 0, amount_paid: 0 },
      confirmed:  rows.find(r => r.status === 'Confirmed')   || { status: 'Confirmed',  invoice_count: 0, total_value: 0, amount_paid: 0 },
      draft:      rows.find(r => r.status === 'Draft')       || { status: 'Draft',      invoice_count: 0, total_value: 0, amount_paid: 0 },
      cancelled:  rows.find(r => r.status === 'Cancelled')   || { status: 'Cancelled',  invoice_count: 0, total_value: 0, amount_paid: 0 }
    };

    res.json({ success: true, data: summary, raw: rows });
  } catch (err) {
    console.error('Paid vs unpaid error:', err);
    res.status(500).json({ success: false, message: 'Failed to load paid vs unpaid data.' });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 4. REVENUE BY PAYMENT METHOD
// ═══════════════════════════════════════════════════════════════════════════════

exports.getRevenueByMethod = async (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT
        COALESCE(payment_method, 'Not Recorded') AS method,
        COUNT(*)                                  AS payment_count,
        COALESCE(SUM(amount_paid), 0)             AS total_collected
      FROM invoices
      WHERE status = 'Paid'
      GROUP BY COALESCE(payment_method, 'Not Recorded')
      ORDER BY total_collected DESC
    `).all();

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Revenue by method error:', err);
    res.status(500).json({ success: false, message: 'Failed to load revenue by payment method.' });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 5. INVOICE STATUS DISTRIBUTION
// ═══════════════════════════════════════════════════════════════════════════════

exports.getStatusDistribution = async (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT
        status,
        COUNT(*) AS invoice_count,
        COALESCE(SUM(total_amount), 0) AS total_value
      FROM invoices
      GROUP BY status
      ORDER BY invoice_count DESC
    `).all();

    const total = rows.reduce((s, r) => s + r.invoice_count, 0);
    const data  = rows.map(r => ({
      ...r,
      percentage: total > 0 ? Number(((r.invoice_count / total) * 100).toFixed(1)) : 0
    }));

    res.json({ success: true, data, total_invoices: total });
  } catch (err) {
    console.error('Status distribution error:', err);
    res.status(500).json({ success: false, message: 'Failed to load status distribution.' });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 6. INVOICE REPORT — filterable, sortable, CSV-exportable
// ═══════════════════════════════════════════════════════════════════════════════

exports.getInvoiceReport = async (req, res) => {
  try {
    const { startDate, endDate } = buildDateRange(req.query);
    const { status, customer_id, search, export: exportFormat, page = 1, limit = 100 } = req.query;

    const conditions = [];
    const params = [];
    appendDateConditions(conditions, params, startDate, endDate);

    if (status) { conditions.push('i.status = ?'); params.push(status); }
    if (customer_id) { conditions.push('i.customer_id = ?'); params.push(Number(customer_id)); }
    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      conditions.push('(i.invoice_number LIKE ? OR i.customer_name LIKE ? OR i.customer_email LIKE ?)');
      params.push(q, q, q);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const total = db.prepare(`SELECT COUNT(*) as cnt FROM invoices i ${where}`).get(...params).cnt;
    const offset = (Math.max(1, parseInt(page, 10)) - 1) * Math.max(1, parseInt(limit, 10));
    const limitNum = Math.max(1, parseInt(limit, 10));

    const invoices = db.prepare(`
      SELECT
        i.invoice_number,
        i.customer_name,
        i.customer_email,
        i.subscription_number,
        i.plan_name,
        i.billing_frequency,
        i.invoice_date,
        i.due_date,
        i.billing_period_start,
        i.billing_period_end,
        i.payment_terms,
        i.currency,
        i.subtotal,
        i.discount_code,
        i.discount_amount,
        i.tax_amount,
        i.total_amount,
        i.amount_paid,
        (i.total_amount - i.amount_paid) AS balance_due,
        i.status,
        i.payment_method,
        i.payment_reference,
        i.paid_at,
        i.confirmed_at,
        i.cancelled_at,
        i.notes,
        i.created_at
      FROM invoices i
      ${where}
      ORDER BY i.invoice_date DESC, i.id DESC
      LIMIT ? OFFSET ?
    `).all(...params, limitNum, offset);

    // ── CSV Export ─────────────────────────────────────────────────────────────
    if (exportFormat === 'csv') {
      const headers = [
        'invoice_number','customer_name','customer_email','subscription_number','plan_name',
        'billing_frequency','invoice_date','due_date','billing_period_start','billing_period_end',
        'payment_terms','currency','subtotal','discount_code','discount_amount','tax_amount',
        'total_amount','amount_paid','balance_due','status','payment_method','payment_reference',
        'paid_at','confirmed_at','notes','created_at'
      ];
      const csv = toCSV(headers, invoices);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="invoice_report.csv"');
      return res.send('\uFEFF' + csv); // BOM for Excel compatibility
    }

    res.json({
      success: true,
      data: { invoices, total, page: Number(page), limit: limitNum, total_pages: Math.ceil(total / limitNum) },
      filters: { start_date: startDate, end_date: endDate, status, period: req.query.period || null }
    });
  } catch (err) {
    console.error('Invoice report error:', err);
    res.status(500).json({ success: false, message: 'Failed to generate invoice report.' });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 7. PAYMENT REPORT — all payments received (Paid invoices), CSV-exportable
// ═══════════════════════════════════════════════════════════════════════════════

exports.getPaymentReport = async (req, res) => {
  try {
    const { startDate, endDate } = buildDateRange(req.query);
    const { payment_method, customer_id, search, export: exportFormat, page = 1, limit = 100 } = req.query;

    const conditions = ["i.status = 'Paid'"];
    const params = [];

    if (startDate) { conditions.push("date(i.paid_at) >= date(?)"); params.push(startDate); }
    if (endDate)   { conditions.push("date(i.paid_at) <= date(?)"); params.push(endDate); }

    if (payment_method) { conditions.push('i.payment_method = ?'); params.push(payment_method); }
    if (customer_id) { conditions.push('i.customer_id = ?'); params.push(Number(customer_id)); }
    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      conditions.push('(i.invoice_number LIKE ? OR i.customer_name LIKE ? OR i.payment_reference LIKE ?)');
      params.push(q, q, q);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;
    const total = db.prepare(`SELECT COUNT(*) as cnt FROM invoices i ${where}`).get(...params).cnt;
    const offset = (Math.max(1, parseInt(page, 10)) - 1) * Math.max(1, parseInt(limit, 10));
    const limitNum = Math.max(1, parseInt(limit, 10));

    const payments = db.prepare(`
      SELECT
        i.invoice_number,
        i.customer_name,
        i.customer_email,
        i.subscription_number,
        i.invoice_date,
        i.due_date,
        i.total_amount,
        i.amount_paid,
        i.currency,
        COALESCE(i.payment_method, 'Not Recorded') AS payment_method,
        i.payment_reference,
        i.paid_at,
        i.notes
      FROM invoices i
      ${where}
      ORDER BY i.paid_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limitNum, offset);

    const summaryRow = db.prepare(`
      SELECT
        COUNT(*) AS payment_count,
        COALESCE(SUM(amount_paid), 0) AS total_collected,
        COALESCE(AVG(amount_paid), 0) AS avg_payment
      FROM invoices i ${where}
    `).get(...params);

    if (exportFormat === 'csv') {
      const headers = [
        'invoice_number','customer_name','customer_email','subscription_number',
        'invoice_date','due_date','total_amount','amount_paid','currency',
        'payment_method','payment_reference','paid_at','notes'
      ];
      const csv = toCSV(headers, payments);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="payment_report.csv"');
      return res.send('\uFEFF' + csv);
    }

    res.json({
      success: true,
      data: {
        payments,
        total,
        page: Number(page),
        limit: limitNum,
        total_pages: Math.ceil(total / limitNum),
        summary: {
          payment_count:   summaryRow.payment_count || 0,
          total_collected: fmt(summaryRow.total_collected),
          avg_payment:     fmt(summaryRow.avg_payment)
        }
      },
      filters: { start_date: startDate, end_date: endDate, period: req.query.period || null }
    });
  } catch (err) {
    console.error('Payment report error:', err);
    res.status(500).json({ success: false, message: 'Failed to generate payment report.' });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 8. OUTSTANDING INVOICE REPORT — Confirmed invoices with balance due > 0
// ═══════════════════════════════════════════════════════════════════════════════

exports.getOutstandingReport = async (req, res) => {
  try {
    const { customer_id, search, export: exportFormat } = req.query;

    const conditions = ["i.status = 'Confirmed'", "(i.total_amount - i.amount_paid) > 0"];
    const params = [];

    if (customer_id) { conditions.push('i.customer_id = ?'); params.push(Number(customer_id)); }
    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      conditions.push('(i.invoice_number LIKE ? OR i.customer_name LIKE ?)');
      params.push(q, q);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;
    const today = new Date().toISOString().split('T')[0];

    const invoices = db.prepare(`
      SELECT
        i.invoice_number,
        i.customer_name,
        i.customer_email,
        i.subscription_number,
        i.invoice_date,
        i.due_date,
        i.total_amount,
        i.amount_paid,
        (i.total_amount - i.amount_paid) AS balance_due,
        i.payment_terms,
        i.currency,
        CASE WHEN date(i.due_date) < date(?) THEN 1 ELSE 0 END AS is_overdue,
        CAST(JULIANDAY(?) - JULIANDAY(i.due_date) AS INTEGER) AS days_overdue
      FROM invoices i
      ${where}
      ORDER BY i.due_date ASC
    `).all(...params, today, today);

    const totals = invoices.reduce((acc, r) => {
      acc.total_outstanding = fmt(acc.total_outstanding + r.balance_due);
      if (r.is_overdue) acc.total_overdue = fmt(acc.total_overdue + r.balance_due);
      return acc;
    }, { total_outstanding: 0, total_overdue: 0 });

    if (exportFormat === 'csv') {
      const headers = [
        'invoice_number','customer_name','customer_email','subscription_number',
        'invoice_date','due_date','total_amount','amount_paid','balance_due',
        'payment_terms','currency','is_overdue','days_overdue'
      ];
      const csv = toCSV(headers, invoices.map(r => ({
        ...r,
        is_overdue: r.is_overdue ? 'Yes' : 'No',
        days_overdue: r.is_overdue ? r.days_overdue : 0
      })));
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="outstanding_invoices.csv"');
      return res.send('\uFEFF' + csv);
    }

    res.json({
      success: true,
      data: {
        invoices,
        summary: { ...totals, count: invoices.length, overdue_count: invoices.filter(r => r.is_overdue).length }
      }
    });
  } catch (err) {
    console.error('Outstanding report error:', err);
    res.status(500).json({ success: false, message: 'Failed to generate outstanding report.' });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 9. OVERDUE INVOICE REPORT — past due date, not Paid or Cancelled
// ═══════════════════════════════════════════════════════════════════════════════

exports.getOverdueReport = async (req, res) => {
  try {
    const { customer_id, search, export: exportFormat } = req.query;
    const today = new Date().toISOString().split('T')[0];

    const conditions = [
      "i.status NOT IN ('Paid','Cancelled')",
      "date(i.due_date) < date(?)"
    ];
    const params = [today];

    if (customer_id) { conditions.push('i.customer_id = ?'); params.push(Number(customer_id)); }
    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      conditions.push('(i.invoice_number LIKE ? OR i.customer_name LIKE ?)');
      params.push(q, q);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const invoices = db.prepare(`
      SELECT
        i.invoice_number,
        i.customer_name,
        i.customer_email,
        i.subscription_number,
        i.invoice_date,
        i.due_date,
        i.total_amount,
        i.amount_paid,
        (i.total_amount - i.amount_paid) AS balance_due,
        i.status,
        i.payment_terms,
        i.currency,
        CAST(JULIANDAY(?) - JULIANDAY(i.due_date) AS INTEGER) AS days_overdue
      FROM invoices i
      ${where}
      ORDER BY days_overdue DESC
    `).all(...params, today);

    const totalOverdue = invoices.reduce((s, r) => s + r.balance_due, 0);

    if (exportFormat === 'csv') {
      const headers = [
        'invoice_number','customer_name','customer_email','subscription_number',
        'invoice_date','due_date','total_amount','amount_paid','balance_due',
        'status','days_overdue','payment_terms','currency'
      ];
      const csv = toCSV(headers, invoices);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="overdue_invoices.csv"');
      return res.send('\uFEFF' + csv);
    }

    res.json({
      success: true,
      data: {
        invoices,
        summary: { count: invoices.length, total_overdue: fmt(totalOverdue) }
      }
    });
  } catch (err) {
    console.error('Overdue report error:', err);
    res.status(500).json({ success: false, message: 'Failed to generate overdue report.' });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 10. CUSTOMER-WISE REVENUE REPORT — revenue, outstanding, invoice counts per customer
// ═══════════════════════════════════════════════════════════════════════════════

exports.getCustomerRevenueReport = async (req, res) => {
  try {
    const { startDate, endDate } = buildDateRange(req.query);
    const { search, export: exportFormat } = req.query;

    const conditions = [];
    const params = [];
    appendDateConditions(conditions, params, startDate, endDate);

    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      conditions.push('(i.customer_name LIKE ? OR i.customer_email LIKE ?)');
      params.push(q, q);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = db.prepare(`
      SELECT
        i.customer_id,
        i.customer_name,
        i.customer_email,
        COUNT(*)                                                                          AS total_invoices,
        COALESCE(SUM(CASE WHEN i.status = 'Paid' THEN 1 ELSE 0 END), 0)                AS paid_invoices,
        COALESCE(SUM(CASE WHEN i.status IN ('Draft','Confirmed') THEN 1 ELSE 0 END), 0) AS open_invoices,
        COALESCE(SUM(i.total_amount), 0)                                                  AS total_invoiced,
        COALESCE(SUM(CASE WHEN i.status = 'Paid' THEN i.amount_paid ELSE 0 END), 0)    AS total_collected,
        COALESCE(SUM(CASE WHEN i.status IN ('Draft','Confirmed') THEN (i.total_amount - i.amount_paid) ELSE 0 END), 0) AS outstanding
      FROM invoices i
      ${where}
      GROUP BY i.customer_id, i.customer_name, i.customer_email
      ORDER BY total_collected DESC
    `).all(...params);

    const grandTotal = rows.reduce((acc, r) => {
      acc.total_invoiced  += r.total_invoiced;
      acc.total_collected += r.total_collected;
      acc.outstanding     += r.outstanding;
      return acc;
    }, { total_invoiced: 0, total_collected: 0, outstanding: 0 });

    if (exportFormat === 'csv') {
      const headers = [
        'customer_name','customer_email','total_invoices','paid_invoices','open_invoices',
        'total_invoiced','total_collected','outstanding'
      ];
      const csv = toCSV(headers, rows);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="customer_revenue_report.csv"');
      return res.send('\uFEFF' + csv);
    }

    res.json({
      success: true,
      data: {
        customers: rows,
        summary: {
          customer_count:  rows.length,
          total_invoiced:  fmt(grandTotal.total_invoiced),
          total_collected: fmt(grandTotal.total_collected),
          outstanding:     fmt(grandTotal.outstanding)
        }
      },
      filters: { start_date: startDate, end_date: endDate, period: req.query.period || null }
    });
  } catch (err) {
    console.error('Customer revenue report error:', err);
    res.status(500).json({ success: false, message: 'Failed to generate customer revenue report.' });
  }
};

