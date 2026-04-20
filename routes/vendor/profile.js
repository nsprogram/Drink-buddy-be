const router = require('express').Router();
const c = require('../../controllers/vendor/profileController');
const { vendorAuth } = require('../../middleware/vendorAuth');

router.use(vendorAuth);
router.get('/', c.getProfile);
router.put('/', c.updateProfile);
router.post('/change-password', c.changePassword);
router.get('/subscription', c.getSubscription);
router.put('/subscription', c.updateSubscription);

module.exports = router;
