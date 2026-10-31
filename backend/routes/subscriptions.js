const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscriptionController');
const { authenticate, authorize } = require('../middleware/auth');

// All subscription routes require authentication
router.use(authenticate);

// List and stats
router.get('/', subscriptionController.getAllSubscriptions);
router.get('/stats', authorize('admin', 'staff'), subscriptionController.getSubscriptionStats);

// Single subscription details
router.get('/:id', subscriptionController.getSubscriptionById);
router.get('/:id/history', subscriptionController.getSubscriptionHistory);
router.get('/:id/invoice-payload', subscriptionController.getInvoicePayload);

// Create subscription
router.post('/', subscriptionController.createSubscription);

// Lifecycle actions (Admin and Staff)
router.post('/:id/pause', authorize('admin', 'staff'), subscriptionController.pauseSubscription);
router.post('/:id/resume', authorize('admin', 'staff'), subscriptionController.resumeSubscription);
router.post('/:id/renew', authorize('admin', 'staff'), subscriptionController.renewSubscription);
router.post('/:id/close', authorize('admin', 'staff'), subscriptionController.closeSubscription);

module.exports = router;
