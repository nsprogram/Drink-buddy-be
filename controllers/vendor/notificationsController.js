// Vendor notifications: fetches from the shared Notification model, scoped by recipient (vendor email).
// Simple implementation: store notifications on the vendor doc under `notifications` array.
const Vendor = require('../../models/Vendor');

exports.list = async (req, res) => {
  const v = await Vendor.findById(req.vendorId).lean();
  const notifications = v.notifications || [];
  res.json({ success: true, data: { notifications } });
};

exports.markRead = async (req, res) => {
  await Vendor.updateOne(
    { _id: req.vendorId, 'notifications._id': req.params.id },
    { $set: { 'notifications.$.read': true } }
  );
  res.json({ success: true });
};

exports.markAllRead = async (req, res) => {
  await Vendor.updateOne({ _id: req.vendorId }, { $set: { 'notifications.$[].read': true } });
  res.json({ success: true });
};

exports.remove = async (req, res) => {
  await Vendor.updateOne({ _id: req.vendorId }, { $pull: { notifications: { _id: req.params.id } } });
  res.json({ success: true });
};
