const User = require('../models/User');
const { generateTokens, refreshAccessToken } = require('../utils/jwtUtils');
const {
  generateOTP,
  sendEmailVerification,
  sendLoginOTP,
  sendPasswordResetEmail,
  sendWelcomeEmail
} = require('../utils/emailService');
const { sendWelcomeNotification } = require('../utils/notifications');

class AuthController {
  static async register(req, res) {
    try {
      const { firstName, lastName, email, password, dateOfBirth } = req.body;

      if (!firstName || !lastName || !email || !password) {
        return res.status(400).json({ success: false, message: 'All fields are required' });
      }

      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        return res.status(400).json({ success: false, message: 'User already exists with this email address' });
      }

      // Compute age from dateOfBirth
      let computedAge;
      if (dateOfBirth) {
        const dob = new Date(dateOfBirth);
        computedAge = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      }

      const verificationToken = generateOTP();

      const user = new User({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        fullName: `${firstName.trim()} ${lastName.trim()}`,
        email: email.toLowerCase().trim(),
        password,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
        age: computedAge,
        emailVerificationToken: verificationToken,
        emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });

      await user.save();

      // Send welcome notification
      sendWelcomeNotification(user._id, firstName).catch(() => {});

      try {
        await sendEmailVerification(email, firstName, verificationToken);
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError);
      }

      res.status(201).json({
        success: true,
        message: 'Registration successful! Please check your email for verification code.',
        data: { userId: user._id, email: user.email, firstName: user.firstName, lastName: user.lastName, requiresEmailVerification: true }
      });
    } catch (error) {
      console.error('Registration error:', error);
      if (error.name === 'ValidationError') {
        const errors = Object.values(error.errors).map(err => ({ field: err.path, message: err.message }));
        return res.status(400).json({ success: false, message: 'Validation failed', errors });
      }
      res.status(500).json({ success: false, message: 'Server error. Please try again in a moment.' });
    }
  }

  static async verifyEmail(req, res) {
    try {
      const { email, token } = req.body;
      const user = await User.findOne({ email, emailVerificationExpires: { $gt: Date.now() } })
        .select('+emailVerificationToken +emailVerificationExpires');

      if (user && user.emailVerificationToken !== token) {
        return res.status(400).json({ success: false, message: 'Invalid verification code' });
      }

      if (!user) {
        return res.status(400).json({ success: false, message: 'Invalid or expired verification code' });
      }

      user.isEmailVerified = true;
      user.emailVerificationToken = undefined;
      user.emailVerificationExpires = undefined;
      await user.save();

      try { await sendWelcomeEmail(email, user.firstName); } catch (e) { console.error(e); }

      const tokens = generateTokens(user);
      user.refreshTokens = user.refreshTokens || [];
      user.refreshTokens.push({ token: tokens.refreshToken, device: req.headers['user-agent'] || 'Unknown', createdAt: new Date() });
      await user.save();

      res.json({
        success: true,
        message: 'Email verified successfully! Welcome to DrinkBuddy!',
        data: { user: { id: user._id, firstName: user.firstName, lastName: user.lastName, email: user.email, isEmailVerified: user.isEmailVerified, profileImage: user.profileImage }, ...tokens }
      });
    } catch (error) {
      console.error('Email verification error:', error);
      res.status(500).json({ success: false, message: 'Email verification failed. Please try again.' });
    }
  }

  static async resendVerification(req, res) {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

      const user = await User.findOne({ email, isEmailVerified: false })
        .select('+emailVerificationToken +emailVerificationExpires');
      if (!user) return res.status(404).json({ success: false, message: 'User not found or email already verified' });

      const verificationToken = generateOTP();
      user.emailVerificationToken = verificationToken;
      user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await user.save();

      await sendEmailVerification(email, user.firstName, verificationToken);
      res.json({ success: true, message: 'Verification code sent successfully!' });
    } catch (error) {
      console.error('Resend verification error:', error);
      res.status(500).json({ success: false, message: 'Failed to resend verification code. Please try again.' });
    }
  }

  static async login(req, res) {
    try {
      const { email, password } = req.body;
      const user = await User.findOne({ email }).select('+password');

      if (!user) return res.status(401).json({ success: false, message: 'Invalid email or password' });
      if (user.isLocked) return res.status(423).json({ success: false, message: 'Account is temporarily locked due to too many failed login attempts. Please try again later.' });
      if (user.isBlocked) return res.status(403).json({ success: false, message: 'Account is blocked. Please contact support.', blockedReason: user.blockedReason });

      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        await user.incLoginAttempts();
        return res.status(401).json({ success: false, message: 'Invalid email or password' });
      }

      if (user.loginAttempts > 0) await user.resetLoginAttempts();
      user.lastLogin = new Date();

      const tokens = generateTokens(user);
      user.refreshTokens = user.refreshTokens || [];
      if (user.refreshTokens.length >= 5) user.refreshTokens.shift();
      user.refreshTokens.push({ token: tokens.refreshToken, device: req.headers['user-agent'] || 'Unknown', createdAt: new Date() });
      await user.save();

      res.json({
        success: true,
        message: 'Login successful!',
        data: {
          user: { id: user._id, firstName: user.firstName, lastName: user.lastName, email: user.email, isEmailVerified: user.isEmailVerified, profileImage: user.profileImage, coverImage: user.coverImage, age: user.age, location: user.location, bio: user.bio },
          ...tokens
        }
      });
    } catch (error) {
      console.error('Login error:', error.message || error);
      if (error.message?.includes('secretOrPrivateKey')) {
        console.error('JWT_SECRET or JWT_REFRESH_SECRET is missing from environment variables!');
        return res.status(500).json({ success: false, message: 'Server configuration error. Contact support.' });
      }
      res.status(500).json({ success: false, message: 'Server error. Please try again in a moment.' });
    }
  }

  static async requestLoginOTP(req, res) {
    try {
      const { email } = req.body;
      const user = await User.findOne({ email });
      if (!user) return res.status(404).json({ success: false, message: 'No account found with this email address' });
      if (user.isBlocked) return res.status(403).json({ success: false, message: 'Account is blocked. Please contact support.' });

      const otp = generateOTP();
      user.loginOTP = { code: otp, expires: new Date(Date.now() + (process.env.OTP_EXPIRE_MINUTES || 10) * 60 * 1000), attempts: 0 };
      await user.save();

      await sendLoginOTP(email, user.firstName, otp);
      res.json({ success: true, message: 'Login code sent to your email address', expiresIn: process.env.OTP_EXPIRE_MINUTES || 10 });
    } catch (error) {
      console.error('OTP login request error:', error);
      res.status(500).json({ success: false, message: 'Failed to send login code. Please try again.' });
    }
  }

  static async verifyLoginOTP(req, res) {
    try {
      const { email, otp } = req.body;
      const user = await User.findOne({ email });
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });

      if (!user.loginOTP || !user.loginOTP.code || user.loginOTP.expires < Date.now()) {
        return res.status(400).json({ success: false, message: 'Invalid or expired login code' });
      }

      if (user.loginOTP.attempts >= 3) {
        user.loginOTP = undefined;
        await user.save();
        return res.status(429).json({ success: false, message: 'Too many failed attempts. Please request a new login code.' });
      }

      if (user.loginOTP.code !== otp) {
        user.loginOTP.attempts += 1;
        await user.save();
        return res.status(400).json({ success: false, message: 'Invalid login code', attemptsRemaining: 3 - user.loginOTP.attempts });
      }

      user.loginOTP = undefined;
      user.lastLogin = new Date();
      const tokens = generateTokens(user);
      user.refreshTokens = user.refreshTokens || [];
      if (user.refreshTokens.length >= 5) user.refreshTokens.shift();
      user.refreshTokens.push({ token: tokens.refreshToken, device: req.headers['user-agent'] || 'Unknown', createdAt: new Date() });
      await user.save();

      res.json({
        success: true,
        message: 'Login successful!',
        data: {
          user: { id: user._id, firstName: user.firstName, lastName: user.lastName, email: user.email, isEmailVerified: user.isEmailVerified, profileImage: user.profileImage, coverImage: user.coverImage, age: user.age, location: user.location, bio: user.bio },
          ...tokens
        }
      });
    } catch (error) {
      console.error('OTP verification error:', error);
      res.status(500).json({ success: false, message: 'Login verification failed. Please try again.' });
    }
  }

  static async forgotPassword(req, res) {
    try {
      const { email } = req.body;
      const user = await User.findOne({ email });

      if (!user) {
        return res.json({ success: true, message: 'If an account with this email exists, you will receive a password reset code.' });
      }

      const resetOTP = generateOTP();
      user.passwordResetToken = resetOTP;
      user.passwordResetExpires = new Date(Date.now() + (process.env.OTP_EXPIRE_MINUTES || 10) * 60 * 1000);
      user.passwordResetAttempts = 0;
      await user.save();

      await sendPasswordResetEmail(email, user.firstName, resetOTP);
      res.json({ success: true, message: 'If an account with this email exists, you will receive a password reset code.', expiresIn: process.env.OTP_EXPIRE_MINUTES || 10 });
    } catch (error) {
      console.error('Password reset request error:', error);
      res.status(500).json({ success: false, message: 'Failed to process password reset request. Please try again.' });
    }
  }

  static async resetPassword(req, res) {
    try {
      const { email, otp, newPassword } = req.body;

      const user = await User.findOne({ email, passwordResetExpires: { $gt: Date.now() } })
        .select('+passwordResetToken +passwordResetExpires +passwordResetAttempts');

      if (user && user.passwordResetToken !== otp) {
        user.passwordResetAttempts = (user.passwordResetAttempts || 0) + 1;
        await user.save();
        return res.status(400).json({ success: false, message: 'Invalid reset code' });
      }

      if (!user) {
        return res.status(400).json({ success: false, message: 'Invalid or expired reset code' });
      }

      if (user.passwordResetAttempts >= 3) {
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        user.passwordResetAttempts = 0;
        await user.save();
        return res.status(429).json({ success: false, message: 'Too many failed attempts. Please request a new reset code.' });
      }

      user.password = newPassword;
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      user.passwordResetAttempts = 0;
      if (user.loginAttempts > 0) await user.resetLoginAttempts();
      await user.save();

      res.json({ success: true, message: 'Password reset successful! You can now login with your new password.' });
    } catch (error) {
      console.error('Password reset error:', error);
      res.status(500).json({ success: false, message: 'Password reset failed. Please try again.' });
    }
  }

  static async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) return res.status(401).json({ success: false, message: 'Refresh token is required' });

      const tokens = await refreshAccessToken(refreshToken);
      res.json({ success: true, message: 'Token refreshed successfully', data: tokens });
    } catch (error) {
      console.error('Token refresh error:', error);
      if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
        return res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
      }
      res.status(500).json({ success: false, message: 'Token refresh failed' });
    }
  }

  static async logout(req, res) {
    try {
      const refreshToken = req.body.refreshToken;
      const user = req.user;
      if (user && refreshToken) {
        await User.findByIdAndUpdate(user._id, { $pull: { refreshTokens: { token: refreshToken } } });
      }
      res.json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ success: false, message: 'Logout failed' });
    }
  }

  static async getCurrentUser(req, res) {
    try {
      const user = await require('../models/User').findById(req.user._id)
        .select('-password -refreshTokens -emailVerificationToken -passwordResetToken')
        .populate('friends.user', 'firstName lastName profileImage');

      res.json({
        success: true,
        data: {
          user: {
            id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            isEmailVerified: user.isEmailVerified,
            profileImage: user.profileImage,
            coverImage: user.coverImage,
            age: user.age,
            dateOfBirth: user.dateOfBirth,
            location: user.location,
            bio: user.bio,
            preferences: user.preferences,
            drinkingStats: user.drinkingStats,
            friends: user.friends,
            role: user.role,
            createdAt: user.createdAt
          }
        }
      });
    } catch (error) {
      console.error('Get current user error:', error);
      res.status(500).json({ success: false, message: 'Failed to get user information' });
    }
  }
}

module.exports = AuthController;
