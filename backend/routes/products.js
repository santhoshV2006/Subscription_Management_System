const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { authenticate, authorize } = require('../middleware/auth');

// All product routes require authentication
router.use(authenticate);

// View routes: Admin, Staff, and Customer
router.get('/', productController.getAllProducts);
router.get('/:id', productController.getProductById);

// Admin-only management routes
router.post('/', authorize('admin'), productController.createProduct);
router.put('/:id', authorize('admin'), productController.updateProduct);
router.delete('/:id', authorize('admin'), productController.deleteProduct);

// Variant management routes (Admin only)
router.post('/:id/variants', authorize('admin'), productController.addVariant);
router.put('/:id/variants/:variantId', authorize('admin'), productController.updateVariant);
router.delete('/:id/variants/:variantId', authorize('admin'), productController.deleteVariant);

module.exports = router;
