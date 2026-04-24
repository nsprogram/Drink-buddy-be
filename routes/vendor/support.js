const router = require('express').Router();
const c = require('../../controllers/vendor/supportController');
const { vendorAuth } = require('../../middleware/vendorAuth');

router.use(vendorAuth);
router.post('/', c.createTicket);
router.get('/', c.listTickets);

module.exports = router;
