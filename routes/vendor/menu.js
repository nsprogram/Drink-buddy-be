const router = require('express').Router();
const c = require('../../controllers/vendor/menuController');
const { vendorAuth } = require('../../middleware/vendorAuth');
const { uploadDocument } = require('../../config/cloudinary');

router.use(vendorAuth);
router.get('/:venueId', c.list);
router.post('/:venueId', c.add);
router.post('/:venueId/bulk', c.bulkImport);
router.put('/:venueId/:itemId', c.update);
router.delete('/:venueId/:itemId', c.remove);
router.post('/:venueId/:itemId/upload-image', uploadDocument.single('image'), c.uploadImage);

module.exports = router;
