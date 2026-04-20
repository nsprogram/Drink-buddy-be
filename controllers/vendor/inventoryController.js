const Inventory = require('../../models/Inventory');

exports.list = async (req, res) => {
  const { venue, lowStock } = req.query;
  const q = { vendor: req.vendorId };
  if (venue) q.venue = venue;
  let items = await Inventory.find(q).sort('-createdAt').populate('venue','name');
  if (lowStock === 'true') items = items.filter(i => i.quantity <= i.lowStockThreshold);
  res.json({ success: true, data: { items } });
};

exports.create = async (req, res) => {
  const item = await Inventory.create({ ...req.body, vendor: req.vendorId });
  res.status(201).json({ success: true, data: { item } });
};

exports.update = async (req, res) => {
  const item = await Inventory.findOneAndUpdate(
    { _id: req.params.id, vendor: req.vendorId }, req.body, { new: true }
  );
  if (!item) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, data: { item } });
};

exports.remove = async (req, res) => {
  const r = await Inventory.findOneAndDelete({ _id: req.params.id, vendor: req.vendorId });
  if (!r) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, message: 'Deleted' });
};

exports.restock = async (req, res) => {
  const { qty } = req.body;
  const item = await Inventory.findOneAndUpdate(
    { _id: req.params.id, vendor: req.vendorId },
    { $inc: { quantity: Number(qty) || 0 }, lastRestockedAt: new Date() },
    { new: true }
  );
  if (!item) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, data: { item } });
};
