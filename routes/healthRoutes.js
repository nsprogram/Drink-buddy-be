const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const health = require('../controllers/healthController');

router.get('/report', protect, health.report);

module.exports = router;
