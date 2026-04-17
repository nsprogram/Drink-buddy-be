const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const places = require('../controllers/placesController');

// Photo proxy must be public so <Image> tags can load without auth header
router.get('/photo', places.photo);

// Nearby search + details require auth (prevents API key abuse)
router.get('/nearby', protect, places.nearby);
router.get('/details/:placeId', protect, places.details);

module.exports = router;
