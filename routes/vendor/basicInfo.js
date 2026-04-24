const router = require('express').Router();
const c = require('../../controllers/vendor/basicInfoController');
const { vendorAuth } = require('../../middleware/vendorAuth');

router.use(vendorAuth);

router.post('/', c.submitBasicInfo);
router.get('/status', c.getBasicInfoStatus);

module.exports = router;
