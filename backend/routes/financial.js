/**
 * Brightloop Software — Financial Dashboard & Reports Routes
 * Module 4 Feature 5: All endpoints are admin/staff protected.
 */

const express = require('express');
const router = express.Router();
const financial = require('../controllers/financialController');
const { authenticate, authorize } = require('../middleware/auth');

// All financial endpoints: authenticated + admin/staff only
router.use(authenticate);
router.use(authorize('admin', 'staff'));

// ─── Charts & KPIs ───────────────────────────────────────────────────────────
router.get('/kpis',                 financial.getKPIs);
router.get('/monthly-revenue',      financial.getMonthlyRevenue);
router.get('/paid-vs-unpaid',       financial.getPaidVsUnpaid);
router.get('/revenue-by-method',    financial.getRevenueByMethod);
router.get('/status-distribution',  financial.getStatusDistribution);

// ─── Reports (filterable + CSV export) ────────────────────────────────────────
router.get('/report/invoices',          financial.getInvoiceReport);
router.get('/report/payments',          financial.getPaymentReport);
router.get('/report/outstanding',       financial.getOutstandingReport);
router.get('/report/overdue',           financial.getOverdueReport);
router.get('/report/customer-revenue',  financial.getCustomerRevenueReport);

module.exports = router;

