const router = require('express').Router();
const c = require('../../controllers/vendor/promotionsController');
const { vendorAuth } = require('../../middleware/vendorAuth');

router.use(vendorAuth);
router.get('/', c.list);
router.post('/', c.create);
router.get('/:id', c.get);
router.put('/:id', c.update);
router.delete('/:id', c.remove);
router.put('/:id/status', c.setStatus);
router.post('/:id/impression', c.trackImpression);
router.post('/:id/click', c.trackClick);
router.post('/:id/redeem', c.trackRedemption);

module.exports = router;
