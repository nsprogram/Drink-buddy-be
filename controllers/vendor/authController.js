const jwt = require('jsonwebtoken');
const Vendor = require('../../models/Vendor');
const { signVendorToken, VENDOR_SECRET } = require('../../middleware/vendorAuth');
const { generateOTP, sendVendorVerifyEmail, sendVendorResetEmail } = require('../../utils/emailService');

const IS_PROD = process.env.NODE_ENV === 'production';
const OTP_TTL_MS = 10 * 60 * 1000;       // 10 min
const OTP_RESEND_COOLDOWN_MS = 60 * 1000; // 60s

const validatePassword = (pw) => {
  if (typeof pw !== 'string' || pw.length < 8) {
    return 'Password must be at least 8 characters';
  }
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) {
    return 'Password must contain at least one letter and one number';
  }
  return null;
};

const vendorPublic = (v) => ({
  id: v._id,
  email: v.email,
  businessName: v.businessName,
  ownerName: v.ownerName,
  phone: v.phone,
  role: v.role,
  subscription: v.subscription,
  logo: v.logo,
  isVerified: v.isVerified,
});

exports.register = async (req, res) => {
  try {
    const { email, password, businessName, ownerName, phone } = req.body || {};
    if (!email || !password || !businessName) {
      return res.status(400).json({ success: false, message: 'email, password, businessName are required' });
    }
    const pwErr = validatePassword(password);
    if (pwErr) return res.status(400).json({ success: false, message: pwErr });

    const normEmail = email.toLowerCase().trim();
    const existing = await Vendor.findOne({ email: normEmail }).select('+emailOtp +emailOtpExpires +otpLastSentAt');
    if (existing && existing.isVerified) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    // Cooldown enforcement on rapid re-registers of same unverified email
    if (existing && !existing.isVerified && existing.otpLastSentAt &&
        (Date.now() - existing.otpLastSentAt.getTime()) < OTP_RESEND_COOLDOWN_MS) {
      const waitMs = OTP_RESEND_COOLDOWN_MS - (Date.now() - existing.otpLastSentAt.getTime());
      return res.status(429).json({
        success: false,
        message: `Please wait ${Math.ceil(waitMs/1000)}s before requesting another code`,
        retryAfter: Math.ceil(waitMs/1000),
      });
    }

    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + OTP_TTL_MS);

    let vendor;
    if (existing && !existing.isVerified) {
      existing.password = password;
      existing.businessName = businessName;
      existing.ownerName = ownerName;
      existing.phone = phone;
      existing.isVerified = false;
      existing.isEmailVerified = false;
      existing.emailOtp = otp;
      existing.emailOtpExpires = otpExpires;
      existing.otpLastSentAt = new Date();
      await existing.save();
      vendor = existing;
    } else {
      vendor = await Vendor.create({
        email: normEmail,
        password,
        businessName,
        ownerName,
        phone,
        isVerified: false,
        isEmailVerified: false,
        emailOtp: otp,
        emailOtpExpires: otpExpires,
        otpLastSentAt: new Date(),
      });
    }

    const emailed = await sendVendorVerifyEmail(vendor.email, vendor.ownerName || vendor.businessName, otp);
    if (!emailed) console.warn('[vendor.register] email delivery failed for', vendor.email, 'OTP:', otp);

    const resp = {
      success: true,
      message: 'OTP sent',
      email: normEmail,
    };
    if (!IS_PROD) resp.devOtp = otp;
    return res.status(201).json(resp);
  } catch (e) {
    console.error('vendor.register', e);
    return res.status(500).json({ success: false, message: e.message });
  }
};

exports.verifyEmail = async (req, res) => {
  try {
    const { email, otp } = req.body || {};
    if (!email || !otp) return res.status(400).json({ success: false, message: 'email and otp are required' });
    const vendor = await Vendor.findOne({ email: email.toLowerCase().trim() })
      .select('+emailOtp +emailOtpExpires');
    if (!vendor) return res.status(400).json({ success: false, message: 'Invalid code' });
    if (vendor.isVerified) return res.status(400).json({ success: false, message: 'Account already verified' });
    if (!vendor.emailOtp || !vendor.emailOtpExpires) {
      return res.status(400).json({ success: false, message: 'No OTP pending. Please request a new one.' });
    }
    if (vendor.emailOtpExpires.getTime() < Date.now()) {
      return res.status(400).json({ success: false, message: 'OTP expired. Please request a new one.' });
    }
    if (String(vendor.emailOtp) !== String(otp).trim()) {
      return res.status(400).json({ success: false, message: 'Invalid code' });
    }
    vendor.isVerified = true;
    vendor.isEmailVerified = true;
    vendor.emailVerifiedAt = new Date();
    vendor.emailOtp = undefined;
    vendor.emailOtpExpires = undefined;
    vendor.lastLoginAt = new Date();
    await vendor.save();
    const token = signVendorToken(vendor);
    return res.json({
      success: true,
      message: 'Email verified',
      data: { accessToken: token, vendor: vendorPublic(vendor) },
      accessToken: token,
      vendor: vendorPublic(vendor),
    });
  } catch (e) {
    console.error('vendor.verifyEmail', e);
    return res.status(500).json({ success: false, message: e.message });
  }
};

exports.resendOtp = async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ success: false, message: 'email is required' });
    const vendor = await Vendor.findOne({ email: email.toLowerCase().trim() })
      .select('+emailOtp +emailOtpExpires +otpLastSentAt');
    if (!vendor) return res.status(400).json({ success: false, message: 'Account not found' });
    if (vendor.isVerified) return res.status(400).json({ success: false, message: 'Account already verified' });

    if (vendor.otpLastSentAt && (Date.now() - vendor.otpLastSentAt.getTime()) < OTP_RESEND_COOLDOWN_MS) {
      const waitMs = OTP_RESEND_COOLDOWN_MS - (Date.now() - vendor.otpLastSentAt.getTime());
      return res.status(429).json({
        success: false,
        message: `Please wait ${Math.ceil(waitMs/1000)}s before requesting another code`,
        retryAfter: Math.ceil(waitMs/1000),
      });
    }

    const otp = generateOTP();
    vendor.emailOtp = otp;
    vendor.emailOtpExpires = new Date(Date.now() + OTP_TTL_MS);
    vendor.otpLastSentAt = new Date();
    await vendor.save();

    const emailed = await sendVendorVerifyEmail(vendor.email, vendor.ownerName || vendor.businessName, otp);
    if (!emailed) console.warn('[vendor.resendOtp] email delivery failed for', vendor.email, 'OTP:', otp);

    const resp = { success: true, message: 'OTP sent' };
    if (!IS_PROD) resp.devOtp = otp;
    return res.json(resp);
  } catch (e) {
    console.error('vendor.resendOtp', e);
    return res.status(500).json({ success: false, message: e.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ success: false, message: 'email and password required' });
    const normEmail = email.toLowerCase().trim();
    const vendor = await Vendor.findOne({ email: normEmail }).select('+password');
    if (!vendor) return res.status(401).json({ success: false, message: 'Invalid credentials' });
    if (vendor.isBlocked) return res.status(403).json({ success: false, message: 'Account blocked' });
    const ok = await vendor.comparePassword(password);
    if (!ok) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    if (!vendor.isVerified) {
      return res.status(403).json({
        success: false,
        message: 'Please verify your email first',
        needsVerification: true,
        email: vendor.email,
      });
    }

    vendor.lastLoginAt = new Date();
    await vendor.save();
    const token = signVendorToken(vendor);
    return res.json({
      success: true,
      message: 'Login successful',
      data: { accessToken: token, vendor: vendorPublic(vendor) },
    });
  } catch (e) {
    console.error('vendor.login', e);
    return res.status(500).json({ success: false, message: e.message });
  }
};

exports.me = async (req, res) => {
  res.json({ success: true, data: { vendor: req.vendor } });
};

exports.logout = async (req, res) => {
  res.json({ success: true, message: 'Logged out' });
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ success: false, message: 'email is required' });
    const normEmail = email.toLowerCase().trim();
    const vendor = await Vendor.findOne({ email: normEmail })
      .select('+resetOtp +resetOtpExpires +resetOtpLastSentAt');

    // Always respond success to prevent enumeration
    const genericResp = { success: true, message: 'If the email exists, a reset code was sent' };

    if (!vendor) {
      return res.json(genericResp);
    }

    if (vendor.resetOtpLastSentAt && (Date.now() - vendor.resetOtpLastSentAt.getTime()) < OTP_RESEND_COOLDOWN_MS) {
      return res.json(genericResp);
    }

    const otp = generateOTP();
    vendor.resetOtp = otp;
    vendor.resetOtpExpires = new Date(Date.now() + OTP_TTL_MS);
    vendor.resetOtpLastSentAt = new Date();
    await vendor.save();

    const emailed = await sendVendorResetEmail(vendor.email, vendor.ownerName || vendor.businessName, otp);
    if (!emailed) console.warn('[vendor.forgotPassword] email delivery failed for', vendor.email, 'OTP:', otp);

    const resp = { ...genericResp };
    if (!IS_PROD) resp.devOtp = otp;
    return res.json(resp);
  } catch (e) {
    console.error('vendor.forgotPassword', e);
    return res.status(500).json({ success: false, message: e.message });
  }
};

exports.verifyResetOtp = async (req, res) => {
  try {
    const { email, otp } = req.body || {};
    if (!email || !otp) return res.status(400).json({ success: false, message: 'email and otp are required' });
    const vendor = await Vendor.findOne({ email: email.toLowerCase().trim() })
      .select('+resetOtp +resetOtpExpires');
    if (!vendor || !vendor.resetOtp || !vendor.resetOtpExpires) {
      return res.status(400).json({ success: false, message: 'Invalid code' });
    }
    if (vendor.resetOtpExpires.getTime() < Date.now()) {
      return res.status(400).json({ success: false, message: 'OTP expired. Please request a new one.' });
    }
    if (String(vendor.resetOtp) !== String(otp).trim()) {
      return res.status(400).json({ success: false, message: 'Invalid code' });
    }
    const resetToken = jwt.sign(
      { vendorId: vendor._id.toString(), type: 'reset' },
      VENDOR_SECRET,
      { expiresIn: '15m' }
    );
    return res.json({ success: true, message: 'OTP verified', resetToken });
  } catch (e) {
    console.error('vendor.verifyResetOtp', e);
    return res.status(500).json({ success: false, message: e.message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body || {};
    if (!resetToken || !newPassword) {
      return res.status(400).json({ success: false, message: 'resetToken and newPassword are required' });
    }
    const pwErr = validatePassword(newPassword);
    if (pwErr) return res.status(400).json({ success: false, message: pwErr });

    let decoded;
    try {
      decoded = jwt.verify(resetToken, VENDOR_SECRET);
    } catch (e) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
    }
    if (decoded.type !== 'reset' || !decoded.vendorId) {
      return res.status(400).json({ success: false, message: 'Invalid reset token' });
    }
    const vendor = await Vendor.findById(decoded.vendorId).select('+password');
    if (!vendor) return res.status(400).json({ success: false, message: 'Account not found' });

    vendor.password = newPassword;
    vendor.resetOtp = undefined;
    vendor.resetOtpExpires = undefined;
    vendor.resetOtpLastSentAt = undefined;
    await vendor.save();

    return res.json({ success: true, message: 'Password reset successful' });
  } catch (e) {
    console.error('vendor.resetPassword', e);
    return res.status(500).json({ success: false, message: e.message });
  }
};
