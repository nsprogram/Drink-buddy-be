const router = require('express').Router();
const c = require('../../controllers/vendor/authController');
const { vendorAuth } = require('../../middleware/vendorAuth');

router.post('/register', c.register);
router.post('/login', c.login);
router.get('/me', vendorAuth, c.me);
router.post('/logout', vendorAuth, c.logout);

module.exports = router;
