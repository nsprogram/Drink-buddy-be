const Vendor = require('../../models/Vendor');

exports.getProfile = async (req, res) => {
  res.json({ success: true, data: { vendor: req.vendor } });
};

exports.updateProfile = async (req, res) => {
  const allowed = ['businessName', 'ownerName', 'phone', 'logo', 'billing', 'notificationPrefs'];
  const patch = {};
  for (const k of allowed) if (req.body[k] !== undefined) patch[k] = req.body[k];
  const v = await Vendor.findByIdAndUpdate(req.vendorId, patch, { new: true });
  res.json({ success: true, data: { vendor: v } });
};

exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ success: false, message: 'Both passwords required' });
  const v = await Vendor.findById(req.vendorId).select('+password');
  const ok = await v.comparePassword(currentPassword);
  if (!ok) return res.status(401).json({ success: false, message: 'Current password incorrect' });
  v.password = newPassword;
  await v.save();
  res.json({ success: true, message: 'Password changed' });
};

exports.getSubscription = async (req, res) => {
  res.json({ success: true, data: { subscription: req.vendor.subscription, billing: req.vendor.billing } });
};

exports.updateSubscription = async (req, res) => {
  const { tier } = req.body;
  const limits = { free: 1, starter: 3, pro: 10, enterprise: 100 };
  const v = await Vendor.findByIdAndUpdate(
    req.vendorId,
    { 'subscription.tier': tier, 'subscription.venueLimit': limits[tier] || 1, 'subscription.status': 'active' },
    { new: true }
  );
  res.json({ success: true, data: { subscription: v.subscription } });
};
