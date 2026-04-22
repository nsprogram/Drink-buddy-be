const router = require('express').Router();
const c = require('../../controllers/admin/vendorApplicationController');
const { protect, adminOnly } = require('../../middleware/auth');

// All routes require admin authentication
router.use(protect);
router.use(adminOnly);

// Application management
router.get('/', c.listApplications);
router.get('/stats', c.getStats);
router.get('/:id', c.getApplication);

// Application actions
router.put('/:id/approve', c.approveApplication);
router.put('/:id/reject', c.rejectApplication);
router.put('/:id/under-review', c.setUnderReview);
router.put('/:id/suspend', c.suspendVendor);
router.put('/:id/reactivate', c.reactivateVendor);

module.exports = router;
