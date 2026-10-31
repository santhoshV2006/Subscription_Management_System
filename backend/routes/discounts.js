const express = require('express');
const router = express.Router();
const discountController = require('../controllers/discountController');
const { authenticate, authorize } = require('../middleware/auth');

// All discount routes require authentication
router.use(authenticate);

// Public discount validation for checkout / calculator (Admin, Staff, Customer)
router.post('/validate', discountController.validateDiscount);

// Billing integration: record discount usage
router.post('/record-usage', authorize('admin', 'staff'), discountController.recordUsage);

// Admin-only discount management routes
router.get('/', authorize('admin'), discountController.getAllDiscounts);
router.get('/:id', authorize('admin'), discountController.getDiscountById);
router.post('/', authorize('admin'), discountController.createDiscount);
router.put('/:id', authorize('admin'), discountController.updateDiscount);
router.delete('/:id', authorize('admin'), discountController.deleteDiscount);

module.exports = router;
