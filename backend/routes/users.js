const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate, authorize } = require('../middleware/auth');
const { validateStaffCreation } = require('../middleware/validation');

// All routes require authentication
router.use(authenticate);

// Admin & Staff routes (Staff needs user listing to assign subscriptions & quotations to customers)
router.get('/', authorize('admin', 'staff'), userController.getAllUsers);
router.get('/dashboard-stats', authorize('admin'), userController.getDashboardStats);
router.get('/roles', authorize('admin', 'staff'), userController.getRoles);
router.get('/:uuid', authorize('admin', 'staff'), userController.getUserByUuid);
router.post('/staff', authorize('admin'), validateStaffCreation, userController.createStaff);
router.patch('/:uuid/status', authorize('admin'), userController.updateUserStatus);
router.delete('/:uuid', authorize('admin'), userController.deleteUser);

module.exports = router;
