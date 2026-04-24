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

// Two-stage approval
router.post('/:id/approve-basic', c.approveBasicInfo);
router.post('/:id/reject-basic', c.rejectBasicInfo);
router.post('/:id/approve-kyc', c.approveKyc);
router.post('/:id/reject-kyc', c.rejectKyc);

router.put('/:id/under-review', c.setUnderReview);

// Suspend / unsuspend (POST preferred, PUT kept for legacy compat)
router.post('/:id/suspend', c.suspendVendor);
router.post('/:id/unsuspend', c.unsuspendVendor);
router.put('/:id/suspend', c.suspendVendor);
router.put('/:id/reactivate', c.reactivateVendor);

module.exports = router;
