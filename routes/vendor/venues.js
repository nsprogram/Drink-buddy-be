const router = require('express').Router();
const c = require('../../controllers/vendor/venuesController');
const { vendorAuth } = require('../../middleware/vendorAuth');

router.use(vendorAuth);
router.get('/', c.list);
router.post('/', c.create);
router.get('/:id', c.get);
router.put('/:id', c.update);
router.delete('/:id', c.remove);
router.put('/:id/photos', c.updatePhotos);
router.put('/:id/hours', c.updateHours);
router.put('/:id/amenities', c.updateAmenities);

module.exports = router;
