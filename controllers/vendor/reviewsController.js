const VendorReview = require('../../models/VendorReview');

exports.list = async (req, res) => {
  const { venue, rating, flagged } = req.query;
  const q = { vendor: req.vendorId };
  if (venue) q.venue = venue;
  if (rating) q.rating = Number(rating);
  if (flagged) q.flagged = flagged === 'true';
  const reviews = await VendorReview.find(q).sort('-createdAt').populate('venue','name').limit(500);
  res.json({ success: true, data: { reviews } });
};

exports.respond = async (req, res) => {
  const r = await VendorReview.findOneAndUpdate(
    { _id: req.params.id, vendor: req.vendorId },
    { response: { body: req.body.body, at: new Date(), by: req.vendor.businessName } },
    { new: true }
  );
  if (!r) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, data: { review: r } });
};

exports.flag = async (req, res) => {
  const r = await VendorReview.findOneAndUpdate(
    { _id: req.params.id, vendor: req.vendorId },
    { flagged: true, flagReason: req.body.reason },
    { new: true }
  );
  if (!r) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, data: { review: r } });
};

exports.hide = async (req, res) => {
  const r = await VendorReview.findOneAndUpdate(
    { _id: req.params.id, vendor: req.vendorId },
    { visible: false },
    { new: true }
  );
  if (!r) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, data: { review: r } });
};
