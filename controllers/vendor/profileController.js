const Vendor = require('../../models/Vendor');
const Venue = require('../../models/Venue');
const Booking = require('../../models/Booking');
const Promotion = require('../../models/Promotion');
const VendorReview = require('../../models/VendorReview');
const Inventory = require('../../models/Inventory');
const SupportTicket = require('../../models/SupportTicket');

exports.getProfile = async (req, res) => {
  const v = await Vendor.findById(req.vendorId).lean();
  if (!v) return res.status(404).json({ success: false, message: 'Vendor not found' });
  const auditLog = (v.auditLog || []).slice(-50).reverse();
  res.json({
    success: true,
    data: {
      vendor: { ...v, auditLog },
      auditLog,
    },
  });
};

exports.updateProfile = async (req, res) => {
  const allowed = ['businessName', 'ownerName', 'phone', 'logo', 'billing', 'notificationPrefs', 'description', 'address'];
  const v = await Vendor.findById(req.vendorId);
  if (!v) return res.status(404).json({ success: false, message: 'Vendor not found' });
  const entries = [];
  for (const k of allowed) {
    if (req.body[k] !== undefined) {
      const before = v[k];
      if (JSON.stringify(before) !== JSON.stringify(req.body[k])) {
        entries.push({ action: 'update', field: k, before, after: req.body[k], actorEmail: req.vendor.email, at: new Date() });
      }
      v[k] = req.body[k];
    }
  }
  if (entries.length) v.auditLog.push(...entries);
  await v.save();
  res.json({ success: true, data: { vendor: v } });
};

exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ success: false, message: 'Both passwords required' });
  if (String(newPassword).length < 8) return res.status(400).json({ success: false, message: 'New password must be at least 8 characters' });
  const v = await Vendor.findById(req.vendorId).select('+password');
  const ok = await v.comparePassword(currentPassword);
  if (!ok) return res.status(401).json({ success: false, message: 'Current password incorrect' });
  v.password = newPassword;
  v.auditLog.push({ action: 'change-password', field: 'password', actorEmail: req.vendor.email, at: new Date() });
  await v.save();
  res.json({ success: true, message: 'Password changed' });
};

exports.getSubscription = async (req, res) => {
  res.json({ success: true, data: { subscription: req.vendor.subscription, billing: req.vendor.billing } });
};

exports.updateSubscription = async (req, res) => {
  const { tier } = req.body;
  const limits = { free: 1, starter: 3, pro: 10, enterprise: 100 };
  if (!limits[tier]) return res.status(400).json({ success: false, message: 'Invalid tier' });
  const v = await Vendor.findById(req.vendorId);
  const before = v.subscription?.tier;
  v.subscription = v.subscription || {};
  v.subscription.tier = tier;
  v.subscription.venueLimit = limits[tier];
  v.subscription.status = 'active';
  v.subscription.startedAt = new Date();
  v.auditLog.push({ action: 'subscription-change', field: 'subscription.tier', before, after: tier, actorEmail: req.vendor.email, at: new Date() });
  await v.save();
  res.json({ success: true, data: { subscription: v.subscription } });
};

// POST /profile/accept-terms
exports.acceptTerms = async (req, res) => {
  const { version } = req.body || {};
  const v = await Vendor.findById(req.vendorId);
  if (!v) return res.status(404).json({ success: false, message: 'Vendor not found' });
  v.termsAccepted = {
    accepted: true,
    acceptedAt: new Date(),
    version: version || '1.0',
    ipAddress: req.ip || req.headers['x-forwarded-for'] || null,
  };
  v.auditLog.push({ action: 'accept-terms', field: 'termsAccepted', after: v.termsAccepted, actorEmail: req.vendor.email, at: new Date() });
  await v.save();
  res.json({ success: true, data: { termsAccepted: v.termsAccepted } });
};

// DELETE /profile  (deleteAccount)
exports.deleteAccount = async (req, res) => {
  try {
    const vendorId = req.vendorId;
    await Promise.all([
      Venue.deleteMany({ vendor: vendorId }),
      Booking.deleteMany({ vendor: vendorId }),
      Promotion.deleteMany({ vendor: vendorId }),
      VendorReview.deleteMany({ vendor: vendorId }),
      Inventory.deleteMany({ vendor: vendorId }),
      SupportTicket.deleteMany({ vendor: vendorId }),
    ]);
    await Vendor.deleteOne({ _id: vendorId });
    res.json({ success: true, message: 'Account and all associated data deleted' });
  } catch (e) {
    console.error('deleteAccount error:', e);
    res.status(500).json({ success: false, message: e.message });
  }
};
