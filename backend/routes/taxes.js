const express = require('express');
const router = express.Router();
const taxController = require('../controllers/taxController');
const { authenticate, authorize } = require('../middleware/auth');

// All tax routes require authentication
router.use(authenticate);

// View routes: Admin, Staff, Customer
router.get('/', taxController.getAllTaxes);
router.get('/:id', taxController.getTaxById);

// Admin-only management routes
router.post('/', authorize('admin'), taxController.createTax);
router.put('/:id', authorize('admin'), taxController.updateTax);
router.delete('/:id', authorize('admin'), taxController.deleteTax);

module.exports = router;
