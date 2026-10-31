const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoiceController');
const { authenticate, authorize } = require('../middleware/auth');

// All invoice routes require authentication
router.use(authenticate);

// ─── Query Endpoints ────────────────────────────────────────────────────────────
router.get('/', invoiceController.getAllInvoices);
router.get('/stats', authorize('admin', 'staff'), invoiceController.getInvoiceStats);
router.get('/:id', invoiceController.getInvoiceById);
router.get('/:id/history', invoiceController.getInvoiceHistory);

// ─── Creation & Generation ─────────────────────────────────────────────────────
router.post('/', authorize('admin', 'staff'), invoiceController.createInvoice);
router.post('/generate/:subscriptionId', authorize('admin', 'staff'), invoiceController.generateFromSubscription);

// ─── Draft Modification ────────────────────────────────────────────────────────
router.put('/:id', authorize('admin', 'staff'), invoiceController.updateInvoice);

// ─── Lifecycle & Status Transitions ────────────────────────────────────────────
router.patch('/:id/status', authorize('admin', 'staff'), invoiceController.updateInvoiceStatus);
router.post('/:id/confirm', authorize('admin', 'staff'), invoiceController.confirmInvoice);
router.post('/:id/pay', invoiceController.payInvoice);
router.post('/:id/cancel', authorize('admin', 'staff'), invoiceController.cancelInvoice);

// ─── Deletion (Draft Only, Admin Only) ─────────────────────────────────────────
router.delete('/:id', authorize('admin'), invoiceController.deleteInvoice);

module.exports = router;

