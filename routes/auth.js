const express = require('express');
const passport = require('passport');
const router = express.Router();
const AuthController = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { generateTokens } = require('../utils/jwtUtils');

// Register
router.post('/register', AuthController.register);

// Email verification
router.post('/verify-email', AuthController.verifyEmail);
router.post('/resend-verification', AuthController.resendVerification);

// Login
router.post('/login', AuthController.login);

// OTP Login
router.post('/login-otp', AuthController.requestLoginOTP);

// Google OAuth
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: `${process.env.FRONTEND_URL}/login?error=google_failed` }),
  async (req, res) => {
    try {
      const tokens = generateTokens(req.user);
      // Store refresh token
      req.user.refreshTokens = req.user.refreshTokens || [];
      if (req.user.refreshTokens.length >= 5) req.user.refreshTokens.shift();
      req.user.refreshTokens.push({ token: tokens.refreshToken, device: req.headers['user-agent'] || 'Unknown', createdAt: new Date() });
      await req.user.save();

      const redirectUrl = `${process.env.FRONTEND_URL}/auth/callback?accessToken=${tokens.accessToken}&refreshToken=${tokens.refreshToken}`;
      res.redirect(redirectUrl);
    } catch (error) {
      console.error('Google callback error:', error);
      res.redirect(`${process.env.FRONTEND_URL}/login?error=server_error`);
    }
  }
);

// Password reset
router.post('/forgot-password', AuthController.forgotPassword);
router.post('/reset-password', AuthController.resetPassword);

// Token management
router.post('/refresh', AuthController.refreshToken);
router.post('/logout', protect, AuthController.logout);

// Current user
router.get('/me', protect, AuthController.getMe);

module.exports = router;
