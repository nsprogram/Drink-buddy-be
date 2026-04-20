const Venue = require('../../models/Venue');

exports.list = async (req, res) => {
  const venues = await Venue.find({ vendor: req.vendorId }).sort('-createdAt');
  res.json({ success: true, data: { venues } });
};

exports.get = async (req, res) => {
  const venue = await Venue.findOne({ _id: req.params.id, vendor: req.vendorId });
  if (!venue) return res.status(404).json({ success: false, message: 'Venue not found' });
  res.json({ success: true, data: { venue } });
};

exports.create = async (req, res) => {
  const count = await Venue.countDocuments({ vendor: req.vendorId });
  if (count >= (req.vendor.subscription?.venueLimit || 1)) {
    return res.status(403).json({ success: false, message: 'Venue limit reached for your subscription tier' });
  }
  const venue = await Venue.create({ ...req.body, vendor: req.vendorId });
  res.status(201).json({ success: true, data: { venue } });
};

exports.update = async (req, res) => {
  const venue = await Venue.findOneAndUpdate(
    { _id: req.params.id, vendor: req.vendorId },
    req.body,
    { new: true }
  );
  if (!venue) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, data: { venue } });
};

exports.remove = async (req, res) => {
  const r = await Venue.findOneAndDelete({ _id: req.params.id, vendor: req.vendorId });
  if (!r) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, message: 'Deleted' });
};

exports.updatePhotos = async (req, res) => {
  const { photos, coverPhoto, logo } = req.body;
  const patch = {};
  if (photos) patch.photos = photos;
  if (coverPhoto) patch.coverPhoto = coverPhoto;
  if (logo) patch.logo = logo;
  const venue = await Venue.findOneAndUpdate({ _id: req.params.id, vendor: req.vendorId }, patch, { new: true });
  if (!venue) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, data: { venue } });
};

exports.uploadPhoto = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const photoUrl = req.file.path; // Cloudinary URL
    
    // Add the photo to the venue's photos array
    const venue = await Venue.findOne({ _id: req.params.id, vendor: req.vendorId });
    if (!venue) {
      return res.status(404).json({ success: false, message: 'Venue not found' });
    }

    venue.photos = venue.photos || [];
    venue.photos.push(photoUrl);
    await venue.save();

    res.json({ 
      success: true, 
      data: { 
        venue,
        photoUrl 
      } 
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, message: 'Failed to upload photo' });
  }
};

exports.updateHours = async (req, res) => {
  const venue = await Venue.findOneAndUpdate(
    { _id: req.params.id, vendor: req.vendorId },
    { hours: req.body.hours },
    { new: true }
  );
  if (!venue) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, data: { venue } });
};

exports.updateAmenities = async (req, res) => {
  const venue = await Venue.findOneAndUpdate(
    { _id: req.params.id, vendor: req.vendorId },
    { amenities: req.body.amenities || [] },
    { new: true }
  );
  if (!venue) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, data: { venue } });
};
