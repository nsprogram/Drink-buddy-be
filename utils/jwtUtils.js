const jwt = require('jsonwebtoken');

const generateTokens = (user) => {
  const payload = {
    id: user._id,
    email: user.email,
    role: user.role || 'user'
  };

  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '15m'
  });

  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d'
  });

  return { accessToken, refreshToken };
};

const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

const verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
};

const extractTokenFromHeader = (req) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
};

const refreshAccessToken = async (refreshToken) => {
  const decoded = verifyRefreshToken(refreshToken);

  const User = require('../models/User');
  const user = await User.findById(decoded.id);

  if (!user) {
    throw new Error('User not found');
  }

  // Check if refresh token exists in DB
  const tokenExists = user.refreshTokens && user.refreshTokens.some(t => t.token === refreshToken);
  if (!tokenExists) {
    throw new Error('Refresh token not found or revoked');
  }

  const payload = {
    id: user._id,
    email: user.email,
    role: user.role || 'user'
  };

  const newAccessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '15m'
  });

  return { accessToken: newAccessToken };
};

module.exports = {
  generateTokens,
  verifyToken,
  verifyRefreshToken,
  extractTokenFromHeader,
  refreshAccessToken
};
