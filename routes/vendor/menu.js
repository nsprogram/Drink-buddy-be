const router = require('express').Router();
const c = require('../../controllers/vendor/menuController');
const { vendorAuth } = require('../../middleware/vendorAuth');

router.use(vendorAuth);
router.get('/:venueId', c.list);
router.post('/:venueId', c.add);
router.post('/:venueId/bulk', c.bulkImport);
router.put('/:venueId/:itemId', c.update);
router.delete('/:venueId/:itemId', c.remove);

module.exports = router;
