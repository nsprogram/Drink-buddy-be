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

// ── Web Google OAuth ──
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: `${process.env.FRONTEND_URL}/login?error=google_failed` }),
  async (req, res) => {
    try {
      const tokens = generateTokens(req.user);
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

// ── Mobile Google OAuth (Expo deep-link flow) ──
const MOBILE_CALLBACK = `${process.env.BACKEND_URL || 'https://drink-buddy-b.onrender.com'}/api/auth/google/mobile/callback`;

router.get('/google/mobile',
  (req, res, next) => {
    passport.authenticate('google', {
      scope: ['profile', 'email'],
      callbackURL: MOBILE_CALLBACK,
    })(req, res, next);
  }
);

router.get('/google/mobile/callback',
  (req, res, next) => {
    passport.authenticate('google', {
      session: false,
      callbackURL: MOBILE_CALLBACK,
      failureRedirect: 'drinkbuddy://auth/error',
    })(req, res, next);
  },
  async (req, res) => {
    try {
      const tokens = generateTokens(req.user);
      req.user.refreshTokens = req.user.refreshTokens || [];
      if (req.user.refreshTokens.length >= 5) req.user.refreshTokens.shift();
      req.user.refreshTokens.push({ token: tokens.refreshToken, device: req.headers['user-agent'] || 'Unknown', createdAt: new Date() });
      await req.user.save();
      // Redirect to the Expo app via deep link — tokens land in Linking event
      res.redirect(`drinkbuddy://auth/callback?accessToken=${tokens.accessToken}&refreshToken=${tokens.refreshToken}`);
    } catch (error) {
      console.error('Google mobile callback error:', error);
      res.redirect('drinkbuddy://auth/error');
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
