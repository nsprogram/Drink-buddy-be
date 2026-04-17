const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const theme = require('../controllers/themeController');

// Public — mobile app fetches on startup (no auth)
router.get('/', theme.getTheme);
router.get('/presets', theme.getPresets);

// Admin only — update/reset/apply preset
router.post('/', protect, adminOnly, theme.updateTheme);
router.post('/apply-preset', protect, adminOnly, theme.applyPreset);
router.post('/reset', protect, adminOnly, theme.resetTheme);

module.exports = router;
