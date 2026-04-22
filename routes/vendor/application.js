const router = require('express').Router();
const c = require('../../controllers/vendor/applicationController');
const { vendorAuth } = require('../../middleware/vendorAuth');
const { uploadDocument } = require('../../config/cloudinary');

// All routes require vendor authentication
router.use(vendorAuth);

// Application management
router.post('/apply', c.submitApplication);
router.get('/application-status', c.getApplicationStatus);
router.put('/application', c.updateApplication);
router.put('/resubmit', c.resubmitApplication);

// Document upload
router.post('/upload-document', uploadDocument.single('document'), c.uploadDocument);

module.exports = router;
