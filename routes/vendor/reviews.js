const router = require('express').Router();
const c = require('../../controllers/vendor/reviewsController');
const { vendorAuth } = require('../../middleware/vendorAuth');

router.use(vendorAuth);
router.get('/', c.list);
router.post('/:id/respond', c.respond);
router.post('/:id/flag', c.flag);
router.post('/:id/hide', c.hide);

module.exports = router;
