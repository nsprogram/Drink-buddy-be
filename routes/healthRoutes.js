const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const health = require('../controllers/healthController');

// Public health-ping endpoint used by the app to check server availability
router.get('/', (req, res) => res.json({ success: true, status: 'ok', ts: Date.now() }));

router.get('/report', protect, health.report);

module.exports = router;
