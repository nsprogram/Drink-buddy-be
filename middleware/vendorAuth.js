const jwt = require('jsonwebtoken');
const Vendor = require('../models/Vendor');

const VENDOR_SECRET = process.env.VENDOR_JWT_SECRET || process.env.JWT_SECRET || 'vendor-dev-secret';

function signVendorToken(vendor) {
  return jwt.sign(
    { id: vendor._id.toString(), role: vendor.role, type: 'vendor' },
    VENDOR_SECRET,
    { expiresIn: '7d' }
  );
}

async function vendorAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ success: false, message: 'No token provided' });
    const decoded = jwt.verify(token, VENDOR_SECRET);
    if (decoded.type !== 'vendor') return res.status(401).json({ success: false, message: 'Invalid token type' });
    const vendor = await Vendor.findById(decoded.id);
    if (!vendor) return res.status(401).json({ success: false, message: 'Vendor not found' });
    if (vendor.isBlocked) return res.status(403).json({ success: false, message: 'Account blocked' });
    if (!vendor.isActive) return res.status(403).json({ success: false, message: 'Account inactive' });
    req.vendor = vendor;
    req.vendorId = vendor._id;
    next();
  } catch (e) {
    if (e.name === 'TokenExpiredError') return res.status(401).json({ success: false, message: 'Token expired' });
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.vendor) return res.status(401).json({ success: false, message: 'Unauthorized' });
    if (!roles.includes(req.vendor.role)) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    }
    next();
  };
}

module.exports = { vendorAuth, requireRole, signVendorToken, VENDOR_SECRET };
