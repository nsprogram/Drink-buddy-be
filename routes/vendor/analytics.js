const router = require('express').Router();
const c = require('../../controllers/vendor/analyticsController');
const { vendorAuth } = require('../../middleware/vendorAuth');

router.use(vendorAuth);
router.get('/summary',  c.summary);
router.get('/revenue',  c.revenueSeries);
router.get('/bookings', c.bookingsSeries);
router.get('/customers', c.customers);
router.get('/export',   c.exportCsv);

module.exports = router;
