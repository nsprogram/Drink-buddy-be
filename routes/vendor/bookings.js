const router = require('express').Router();
const c = require('../../controllers/vendor/bookingsController');
const { vendorAuth } = require('../../middleware/vendorAuth');

router.use(vendorAuth);
router.get('/', c.list);
router.get('/calendar', c.calendar);
router.post('/', c.create);
router.get('/:id', c.get);
router.put('/:id', c.update);
router.post('/:id/confirm',  c.confirm);
router.post('/:id/checkin',  c.checkIn);
router.post('/:id/complete', c.complete);
router.post('/:id/cancel',   c.cancel);
router.post('/:id/no-show',  c.noShow);

module.exports = router;
