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
  const venueLimit = req.vendor.subscription?.venueLimit || 1;
  
  if (count >= venueLimit) {
    return res.status(403).json({ 
      success: false, 
      message: `Venue limit reached. You have ${count} venue(s) and your ${req.vendor.subscription?.tier || 'free'} plan allows ${venueLimit}. Please upgrade your subscription to add more venues.`,
      data: {
        currentCount: count,
        limit: venueLimit,
        tier: req.vendor.subscription?.tier || 'free'
      }
    });
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

exports.uploadLogo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const logoUrl = req.file.path; // Cloudinary URL
    
    // Update the venue's logo
    const venue = await Venue.findOneAndUpdate(
      { _id: req.params.id, vendor: req.vendorId },
      { logo: logoUrl },
      { new: true }
    );
    
    if (!venue) {
      return res.status(404).json({ success: false, message: 'Venue not found' });
    }

    res.json({ 
      success: true, 
      data: { 
        venue,
        logoUrl 
      } 
    });
  } catch (error) {
    console.error('Upload logo error:', error);
    res.status(500).json({ success: false, message: 'Failed to upload logo' });
  }
};

exports.updateLocation = async (req, res) => {
  try {
    const { address, coordinates } = req.body;
    
    const updateData = {};
    if (address) updateData.address = address;
    if (coordinates) updateData.coordinates = coordinates;
    
    const venue = await Venue.findOneAndUpdate(
      { _id: req.params.id, vendor: req.vendorId },
      updateData,
      { new: true }
    );
    
    if (!venue) {
      return res.status(404).json({ success: false, message: 'Venue not found' });
    }

    res.json({ 
      success: true, 
      data: { venue } 
    });
  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({ success: false, message: 'Failed to update location' });
  }
};

exports.updateSocialMedia = async (req, res) => {
  try {
    const { socialMedia } = req.body;
    
    const venue = await Venue.findOneAndUpdate(
      { _id: req.params.id, vendor: req.vendorId },
      { socialMedia },
      { new: true }
    );
    
    if (!venue) {
      return res.status(404).json({ success: false, message: 'Venue not found' });
    }

    res.json({ 
      success: true, 
      data: { venue } 
    });
  } catch (error) {
    console.error('Update social media error:', error);
    res.status(500).json({ success: false, message: 'Failed to update social media' });
  }
};

exports.updatePolicies = async (req, res) => {
  try {
    const { policies } = req.body;
    
    const venue = await Venue.findOneAndUpdate(
      { _id: req.params.id, vendor: req.vendorId },
      { policies },
      { new: true }
    );
    
    if (!venue) {
      return res.status(404).json({ success: false, message: 'Venue not found' });
    }

    res.json({ 
      success: true, 
      data: { venue } 
    });
  } catch (error) {
    console.error('Update policies error:', error);
    res.status(500).json({ success: false, message: 'Failed to update policies' });
  }
};
