const Venue = require('../../models/Venue');

async function getVenue(vendorId, venueId) {
  return Venue.findOne({ _id: venueId, vendor: vendorId });
}

exports.list = async (req, res) => {
  const venue = await getVenue(req.vendorId, req.params.venueId);
  if (!venue) return res.status(404).json({ success: false, message: 'Venue not found' });
  res.json({ success: true, data: { menu: venue.menu } });
};

exports.add = async (req, res) => {
  const venue = await getVenue(req.vendorId, req.params.venueId);
  if (!venue) return res.status(404).json({ success: false, message: 'Venue not found' });
  venue.menu.push(req.body);
  await venue.save();
  res.status(201).json({ success: true, data: { item: venue.menu[venue.menu.length - 1], menu: venue.menu } });
};

exports.update = async (req, res) => {
  const venue = await getVenue(req.vendorId, req.params.venueId);
  if (!venue) return res.status(404).json({ success: false, message: 'Venue not found' });
  const item = venue.menu.id(req.params.itemId);
  if (!item) return res.status(404).json({ success: false, message: 'Item not found' });
  Object.assign(item, req.body);
  await venue.save();
  res.json({ success: true, data: { item, menu: venue.menu } });
};

exports.remove = async (req, res) => {
  const venue = await getVenue(req.vendorId, req.params.venueId);
  if (!venue) return res.status(404).json({ success: false, message: 'Venue not found' });
  const item = venue.menu.id(req.params.itemId);
  if (!item) return res.status(404).json({ success: false, message: 'Item not found' });
  item.deleteOne();
  await venue.save();
  res.json({ success: true, message: 'Removed' });
};

exports.bulkImport = async (req, res) => {
  const venue = await getVenue(req.vendorId, req.params.venueId);
  if (!venue) return res.status(404).json({ success: false, message: 'Venue not found' });
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  venue.menu.push(...items);
  await venue.save();
  res.json({ success: true, data: { count: items.length, menu: venue.menu } });
};

exports.uploadImage = async (req, res) => {
  try {
    const venue = await getVenue(req.vendorId, req.params.venueId);
    if (!venue) return res.status(404).json({ success: false, message: 'Venue not found' });
    
    const item = venue.menu.id(req.params.itemId);
    if (!item) return res.status(404).json({ success: false, message: 'Menu item not found' });
    
    if (!req.file) return res.status(400).json({ success: false, message: 'No image file provided' });
    
    item.image = req.file.path;
    await venue.save();
    
    res.json({ success: true, data: { imageUrl: req.file.path, item } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
