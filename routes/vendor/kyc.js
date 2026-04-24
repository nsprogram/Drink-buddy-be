const router = require('express').Router();
const c = require('../../controllers/vendor/kycController');
const { vendorAuth } = require('../../middleware/vendorAuth');

router.use(vendorAuth);

router.post('/submit', c.submitKyc);
router.get('/status', c.getKycStatus);

module.exports = router;
