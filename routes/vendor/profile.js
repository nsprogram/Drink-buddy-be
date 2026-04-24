const router = require('express').Router();
const c = require('../../controllers/vendor/profileController');
const { vendorAuth } = require('../../middleware/vendorAuth');

router.use(vendorAuth);
router.get('/', c.getProfile);
router.put('/', c.updateProfile);
router.delete('/', c.deleteAccount);
router.post('/change-password', c.changePassword);
router.post('/accept-terms', c.acceptTerms);
router.get('/subscription', c.getSubscription);
router.put('/subscription', c.updateSubscription);

module.exports = router;
