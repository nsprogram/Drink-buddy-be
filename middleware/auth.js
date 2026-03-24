const User = require('../models/User');
const { verifyToken, extractTokenFromHeader } = require('../utils/jwtUtils');

const protect = async (req, res, next) => {
  try {
    const token = extractTokenFromHeader(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const decoded = verifyToken(token);
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Token is not valid. User not found.'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated. Please contact support.'
      });
    }

    if (user.isBlocked) {
      return res.status(401).json({
        success: false,
        message: 'Account is blocked. Please contact support.',
        blockedReason: user.blockedReason
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired' });
    }

    return res.status(500).json({
      success: false,
      message: 'Server error during authentication'
    });
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const token = extractTokenFromHeader(req);
    if (token) {
      const decoded = verifyToken(token);
      const user = await User.findById(decoded.id).select('-password');
      if (user && user.isActive && !user.isBlocked) {
        req.user = user;
      }
    }
    next();
  } catch (error) {
    next();
  }
};

const requireEmailVerification = (req, res, next) => {
  if (!req.user.isEmailVerified) {
    return res.status(403).json({
      success: false,
      message: 'Please verify your email address to access this feature.',
      requiresEmailVerification: true
    });
  }
  next();
};

const requireAgeVerification = (req, res, next) => {
  if (!req.user.dateOfBirth || req.user.age < 18) {
    return res.status(403).json({
      success: false,
      message: 'Age verification required. You must be 18 or older.',
      requiresAgeVerification: true
    });
  }
  next();
};

const sensitiveOperationLimit = (maxAttempts = 5, windowMs = 15 * 60 * 1000) => {
  const attempts = new Map();

  return (req, res, next) => {
    const key = req.ip + (req.user ? req.user._id : '');
    const now = Date.now();

    if (!attempts.has(key)) {
      attempts.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }

    const userAttempts = attempts.get(key);

    if (now > userAttempts.resetTime) {
      attempts.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (userAttempts.count >= maxAttempts) {
      return res.status(429).json({
        success: false,
        message: 'Too many attempts. Please try again later.',
        retryAfter: Math.ceil((userAttempts.resetTime - now) / 1000)
      });
    }

    userAttempts.count++;
    next();
  };
};

const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin privileges required.'
    });
  }
  next();
};

module.exports = {
  protect,
  optionalAuth,
  requireEmailVerification,
  requireAgeVerification,
  sensitiveOperationLimit,
  adminOnly
};
