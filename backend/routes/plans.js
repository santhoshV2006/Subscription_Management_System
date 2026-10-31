const express = require('express');
const router = express.Router();
const planController = require('../controllers/planController');
const { authenticate, authorize } = require('../middleware/auth');

// All plan routes require authentication
router.use(authenticate);

// View routes: Admin, Staff, Customer
router.get('/', planController.getAllPlans);
router.get('/:id', planController.getPlanById);

// Admin-only management routes
router.post('/', authorize('admin'), planController.createPlan);
router.put('/:id', authorize('admin'), planController.updatePlan);
router.delete('/:id', authorize('admin'), planController.deletePlan);

// Admin-only lifecycle operations
router.post('/:id/close', authorize('admin'), planController.closePlanEarly);
router.post('/:id/pause', authorize('admin'), planController.pausePlan);
router.post('/:id/resume', authorize('admin'), planController.resumePlan);

module.exports = router;
