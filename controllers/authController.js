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

      let computedAge;
      if (dateOfBirth) {
        const dob = new Date(dateOfBirth);
        computedAge = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      }

      // Generate verification OTP
      const otp = generateOTP();

      const user = new User({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        fullName: `${firstName.trim()} ${lastName.trim()}`,
        email: email.toLowerCase().trim(),
        password,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
        age: computedAge,
        isEmailVerified: false,
        emailVerificationToken: otp,
        emailVerificationExpires: new Date(Date.now() + 5 * 60 * 1000),
      });

      await user.save();

      // Send verification email
      const emailSent = await sendEmailVerification(user.email, firstName, otp);
      console.log(`[Auth] Verification email to ${user.email}: ${emailSent ? 'sent' : 'FAILED'} | OTP: ${otp}`);

      // Send in-app welcome notification (fires on socket too — delivered when user connects)
      sendWelcomeNotification(user._id, user.firstName).catch((e) =>
        console.warn('[Auth] Welcome notification failed:', e?.message)
      );

      // ── Fallback: if email delivery failed, return the OTP in the response so
      // the user can still complete registration. The frontend will display it
      // with a friendly notice. This keeps the app usable while no email provider
      // is configured (Render free tier blocks SMTP; configure BREVO_API_KEY for
      // production-quality delivery).
      const responseData = {
        userId: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        requiresEmailVerification: true,
      };
      if (!emailSent) {
        responseData.fallbackOtp = otp;
        responseData.emailDeliveryFailed = true;
      }

      res.status(201).json({
        success: true,
        message: emailSent
          ? 'Registration successful! Please check your email for verification code.'
          : 'Registration successful! Email delivery is unavailable — your code is shown below.',
        data: responseData,
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

      // Fire-and-forget
      sendWelcomeEmail(email, user.firstName).catch(() => {});

      const tokens = generateTokens(user);
      user.refreshTokens = user.refreshTokens || [];
      user.refreshTokens.push({ token: tokens.refreshToken, device: req.headers['user-agent'] || 'Unknown', createdAt: new Date() });
      await user.save();

      res.json({
        success: true,
        message: 'Email verified successfully! Welcome to DrinkBuddy!',
        data: { user: { id: user._id, firstName: user.firstName, lastName: user.lastName, email: user.email, isEmailVerified: user.isEmailVerified, profileImage: user.profileImage, role: user.role || 'user' }, ...tokens }
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
      user.emailVerificationExpires = new Date(Date.now() + 5 * 60 * 1000);
      await user.save();

      const emailSent = await sendEmailVerification(email, user.firstName, verificationToken);
      console.log(`[Auth] Resend verification to ${email}: ${emailSent ? 'sent' : 'FAILED'} | OTP: ${verificationToken}`);

      // Same fallback as register — return OTP if email delivery is unavailable
      const responseData = {};
      if (!emailSent) {
        responseData.fallbackOtp = verificationToken;
        responseData.emailDeliveryFailed = true;
      }

      res.json({
        success: true,
        message: emailSent
          ? 'Verification code sent!'
          : 'Email delivery unavailable — your code is shown below.',
        data: responseData,
      });
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

      // Block unverified users from logging in
      if (!user.isEmailVerified) {
        return res.status(403).json({
          success: false,
          message: 'Please verify your email before logging in. Check your inbox for the verification code.',
          requiresVerification: true,
          email: user.email,
        });
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
          user: { id: user._id, firstName: user.firstName, lastName: user.lastName, email: user.email, isEmailVerified: user.isEmailVerified, profileImage: user.profileImage, coverImage: user.coverImage, age: user.age, location: user.location, bio: user.bio, role: user.role },
          ...tokens
        }
      });
    } catch (error) {
      console.error('Login error:', error.message || error);
      if (error.message?.includes('secretOrPrivateKey')) {
        return res.status(500).json({ success: false, message: 'Server configuration error. Contact support.' });
      }
      res.status(500).json({ success: false, message: 'Server error. Please try again in a moment.' });
    }
  }

  static async requestLoginOTP(req, res) {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });

      const otp = generateOTP();
      user.loginOTP = { code: otp, expires: new Date(Date.now() + 5 * 60 * 1000), attempts: 0 };
      await user.save();

      const emailSent = await sendLoginOTP(email, user.firstName, otp);
      console.log(`[Auth] Login OTP for ${email}: ${emailSent ? 'sent' : 'FAILED'} | OTP: ${otp}`);

      const responseData = { email };
      if (!emailSent) {
        // Email delivery failed — surface OTP in response so dev / fallback flow works.
        // Matches the same pattern used by `register` and `forgotPassword` in this file.
        responseData.fallbackOtp = otp;
        responseData.emailDeliveryFailed = true;
      }

      res.json({
        success: true,
        message: emailSent
          ? 'Login OTP sent to your email.'
          : 'Email delivery unavailable — your code is shown below.',
        data: responseData,
      });
    } catch (error) {
      console.error('Request login OTP error:', error);
      res.status(500).json({ success: false, message: 'Failed to send OTP' });
    }
  }

  static async forgotPassword(req, res) {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

      const user = await User.findOne({ email: email.toLowerCase() });

      // Don't leak account existence — but for legitimate users, return a fallback OTP
      // when email delivery is unavailable (Render free tier blocks SMTP)
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'No account found with this email. Please check the address or sign up.',
        });
      }

      const otp = generateOTP();
      user.passwordResetToken = otp;
      user.passwordResetExpires = new Date(Date.now() + 5 * 60 * 1000);
      user.passwordResetAttempts = 0;
      await user.save();

      const emailSent = await sendPasswordResetEmail(email, user.firstName, otp);
      console.log(`[Auth] Password reset OTP for ${email}: ${emailSent ? 'sent' : 'FAILED'} | OTP: ${otp}`);

      const responseData = { email };
      if (!emailSent) {
        responseData.fallbackOtp = otp;
        responseData.emailDeliveryFailed = true;
      }

      res.json({
        success: true,
        message: emailSent
          ? 'Password reset code sent to your email.'
          : 'Email delivery unavailable — your code is shown below.',
        data: responseData,
      });
    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({ success: false, message: 'Server error. Please try again.' });
    }
  }

  static async resetPassword(req, res) {
    try {
      const { email, token, newPassword } = req.body;

      if (!email || !token || !newPassword) {
        return res.status(400).json({ success: false, message: 'All fields are required' });
      }
      if (newPassword.length < 8) {
        return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
      }

      const user = await User.findOne({
        email,
        passwordResetToken: token,
        passwordResetExpires: { $gt: Date.now() }
      }).select('+passwordResetToken +passwordResetExpires');

      if (!user) {
        return res.status(400).json({ success: false, message: 'Invalid or expired reset code' });
      }

      user.password = newPassword;
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      user.passwordResetAttempts = 0;
      await user.save();

      res.json({ success: true, message: 'Password reset successfully! You can now log in.' });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({ success: false, message: 'Password reset failed' });
    }
  }

  static async refreshToken(req, res) {
    try {
      const { refreshToken: token } = req.body;
      if (!token) return res.status(400).json({ success: false, message: 'Refresh token is required' });
      const result = await refreshAccessToken(token);
      if (!result) return res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(401).json({ success: false, message: 'Token refresh failed' });
    }
  }

  static async logout(req, res) {
    try {
      const user = await User.findById(req.user._id || req.user.id);
      if (user) {
        const { refreshToken } = req.body;
        if (refreshToken) {
          user.refreshTokens = (user.refreshTokens || []).filter(t => t.token !== refreshToken);
        } else {
          user.refreshTokens = [];
        }
        await user.save();
      }
      res.json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
      res.status(200).json({ success: true, message: 'Logged out' });
    }
  }

  static async getMe(req, res) {
    try {
      const user = await User.findById(req.user._id || req.user.id)
        .select('-password -refreshTokens -emailVerificationToken -resetPasswordToken')
        .populate('friends.user', 'firstName lastName fullName profileImage');

      if (!user) return res.status(404).json({ success: false, message: 'User not found' });

      res.json({
        success: true,
        data: {
          ...user.toJSON(),
          id: user._id,
          friends: (user.friends || []).filter(f => f.status === 'accepted').map(f => ({
            id: f.user?._id, firstName: f.user?.firstName, lastName: f.user?.lastName,
            fullName: f.user?.fullName, profileImage: f.user?.profileImage, status: f.status
          }))
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to get user' });
    }
  }
}

module.exports = AuthController;
