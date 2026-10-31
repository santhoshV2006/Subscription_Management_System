const express = require('express');
const router = express.Router();
const quotationController = require('../controllers/quotationController');
const { authenticate, authorize } = require('../middleware/auth');

// All quotation routes require authentication
router.use(authenticate);

// ─── Quotation Templates ────────────────────────────────────────────────────────
router.get('/templates', quotationController.getAllTemplates);
router.get('/templates/:id', quotationController.getTemplateById);
router.post('/templates', authorize('admin', 'staff'), quotationController.createTemplate);
router.put('/templates/:id', authorize('admin', 'staff'), quotationController.updateTemplate);
router.delete('/templates/:id', authorize('admin'), quotationController.deleteTemplate);

// ─── Quotations Management ──────────────────────────────────────────────────────
router.get('/', quotationController.getAllQuotations);
router.get('/:id', quotationController.getQuotationById);
router.post('/', quotationController.createQuotation);
router.put('/:id', quotationController.updateQuotation);
router.patch('/:id/status', quotationController.updateQuotationStatus);
router.post('/:id/convert', authorize('admin', 'staff'), quotationController.convertQuotationToSubscription);
router.delete('/:id', authorize('admin', 'staff'), quotationController.deleteQuotation);

module.exports = router;
