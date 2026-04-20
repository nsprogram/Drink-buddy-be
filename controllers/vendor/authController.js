const Vendor = require('../../models/Vendor');
const { signVendorToken } = require('../../middleware/vendorAuth');

exports.register = async (req, res) => {
  try {
    const { email, password, businessName, ownerName, phone } = req.body;
    if (!email || !password || !businessName) {
      return res.status(400).json({ success: false, message: 'email, password, businessName are required' });
    }
    const exists = await Vendor.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(409).json({ success: false, message: 'Email already registered' });
    const vendor = await Vendor.create({
      email: email.toLowerCase(), password, businessName, ownerName, phone,
    });
    const token = signVendorToken(vendor);
    res.status(201).json({
      success: true,
      message: 'Vendor registered',
      data: {
        accessToken: token,
        vendor: { id: vendor._id, email: vendor.email, businessName: vendor.businessName, role: vendor.role, subscription: vendor.subscription }
      }
    });
  } catch (e) {
    console.error('vendor.register', e);
    res.status(500).json({ success: false, message: e.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'email and password required' });
    const vendor = await Vendor.findOne({ email: email.toLowerCase() }).select('+password');
    if (!vendor) return res.status(401).json({ success: false, message: 'Invalid credentials' });
    if (vendor.isBlocked) return res.status(403).json({ success: false, message: 'Account blocked' });
    const ok = await vendor.comparePassword(password);
    if (!ok) return res.status(401).json({ success: false, message: 'Invalid credentials' });
    vendor.lastLoginAt = new Date();
    await vendor.save();
    const token = signVendorToken(vendor);
    res.json({
      success: true,
      message: 'Login successful',
      data: {
        accessToken: token,
        vendor: {
          id: vendor._id, email: vendor.email, businessName: vendor.businessName,
          ownerName: vendor.ownerName, phone: vendor.phone, role: vendor.role,
          subscription: vendor.subscription, logo: vendor.logo,
        }
      }
    });
  } catch (e) {
    console.error('vendor.login', e);
    res.status(500).json({ success: false, message: e.message });
  }
};

exports.me = async (req, res) => {
  res.json({ success: true, data: { vendor: req.vendor } });
};

exports.logout = async (req, res) => {
  res.json({ success: true, message: 'Logged out' });
};
