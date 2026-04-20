const Promotion = require('../../models/Promotion');

exports.list = async (req, res) => {
  const { venue, status } = req.query;
  const q = { vendor: req.vendorId };
  if (venue) q.venue = venue;
  if (status) q.status = status;
  const promotions = await Promotion.find(q).sort('-createdAt').populate('venue', 'name');
  res.json({ success: true, data: { promotions } });
};

exports.get = async (req, res) => {
  const promo = await Promotion.findOne({ _id: req.params.id, vendor: req.vendorId }).populate('venue', 'name');
  if (!promo) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, data: { promotion: promo } });
};

exports.create = async (req, res) => {
  const promo = await Promotion.create({ ...req.body, vendor: req.vendorId });
  res.status(201).json({ success: true, data: { promotion: promo } });
};

exports.update = async (req, res) => {
  const promo = await Promotion.findOneAndUpdate(
    { _id: req.params.id, vendor: req.vendorId },
    req.body, { new: true }
  );
  if (!promo) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, data: { promotion: promo } });
};

exports.remove = async (req, res) => {
  const r = await Promotion.findOneAndDelete({ _id: req.params.id, vendor: req.vendorId });
  if (!r) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, message: 'Deleted' });
};

exports.trackImpression = async (req, res) => {
  await Promotion.updateOne({ _id: req.params.id, vendor: req.vendorId }, { $inc: { impressions: 1 } });
  res.json({ success: true });
};
exports.trackClick = async (req, res) => {
  await Promotion.updateOne({ _id: req.params.id, vendor: req.vendorId }, { $inc: { clicks: 1 } });
  res.json({ success: true });
};
exports.trackRedemption = async (req, res) => {
  const { amount = 0 } = req.body || {};
  await Promotion.updateOne({ _id: req.params.id, vendor: req.vendorId }, { $inc: { redemptions: 1, revenue: amount } });
  res.json({ success: true });
};

exports.setStatus = async (req, res) => {
  const promo = await Promotion.findOneAndUpdate(
    { _id: req.params.id, vendor: req.vendorId },
    { status: req.body.status },
    { new: true }
  );
  if (!promo) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, data: { promotion: promo } });
};
