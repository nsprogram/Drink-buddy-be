const express = require('express');
const router = express.Router();
const AppConfigController = require('../controllers/appConfigController');
const { protect, adminOnly } = require('../middleware/auth');

// Public: mobile app reads config on session screen load
router.get('/', AppConfigController.getConfig);

// Admin only: admin panel saves config
router.put('/', protect, adminOnly, AppConfigController.saveConfig);

module.exports = router;
