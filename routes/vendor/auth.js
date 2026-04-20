const router = require('express').Router();
const c = require('../../controllers/vendor/authController');
const { vendorAuth } = require('../../middleware/vendorAuth');

router.post('/register', c.register);
router.post('/verify-email', c.verifyEmail);
router.post('/resend-otp', c.resendOtp);
router.post('/login', c.login);
router.post('/forgot-password', c.forgotPassword);
router.post('/verify-reset-otp', c.verifyResetOtp);
router.post('/reset-password', c.resetPassword);
router.get('/me', vendorAuth, c.me);
router.post('/logout', vendorAuth, c.logout);

module.exports = router;
