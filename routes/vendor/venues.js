const router = require('express').Router();
const c = require('../../controllers/vendor/venuesController');
const { vendorAuth } = require('../../middleware/vendorAuth');
const { uploadVenuePhoto } = require('../../config/cloudinary');

router.use(vendorAuth);
router.get('/', c.list);
router.post('/', c.create);
router.get('/:id', c.get);
router.put('/:id', c.update);
router.delete('/:id', c.remove);
router.put('/:id/photos', c.updatePhotos);
router.post('/:id/upload-photo', uploadVenuePhoto.single('photo'), c.uploadPhoto);
router.post('/:id/upload-logo', uploadVenuePhoto.single('logo'), c.uploadLogo);
router.put('/:id/hours', c.updateHours);
router.put('/:id/amenities', c.updateAmenities);
router.put('/:id/social-media', c.updateSocialMedia);
router.put('/:id/policies', c.updatePolicies);
router.put('/:id/location', c.updateLocation);

module.exports = router;
