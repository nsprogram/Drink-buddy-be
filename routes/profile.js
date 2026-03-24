const express = require('express');
const router = express.Router();
const ProfileController = require('../controllers/profileController');
const { protect } = require('../middleware/auth');
const { uploadProfile } = require('../config/cloudinary');

// Upload profile/cover image
router.post('/upload-image',
  protect,
  (req, res, next) => {
    const upload = uploadProfile.fields([
      { name: 'profileImage', maxCount: 1 },
      { name: 'coverImage', maxCount: 1 }
    ]);
    upload(req, res, (err) => {
      if (err) return res.status(400).json({ success: false, message: err.message });
      next();
    });
  },
  ProfileController.uploadImage
);

// Delete image
router.delete('/image/:type', protect, ProfileController.deleteImage);

// Preferences
router.put('/preferences', protect, ProfileController.updatePreferences);

// Location
router.put('/location', protect, ProfileController.updateLocation);

// Stats
router.get('/stats', protect, ProfileController.getStats);
router.put('/stats', protect, ProfileController.updateStats);

// Account
router.delete('/account', protect, ProfileController.deactivateAccount);

module.exports = router;
