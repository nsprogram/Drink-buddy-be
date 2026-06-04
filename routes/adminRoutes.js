const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const admin = require('../controllers/adminController');
const User = require('../models/User');
const Venue = require('../models/Venue');
const Vendor = require('../models/Vendor');

// All admin routes require authentication + admin role
router.use(protect, adminOnly);

// ── Admin self-profile ──────────────────────────────────────────────────────

// GET /admin/me — return own profile
router.get('/me', async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('firstName lastName email role');
    res.json({ success: true, data: { user } });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to load profile' });
  }
});

// PUT /admin/me/email — change own email (requires current password)
router.put('/me/email', async (req, res) => {
  try {
    const { newEmail, currentPassword } = req.body;
    if (!newEmail || !currentPassword) {
      return res.status(400).json({ success: false, message: 'New email and current password are required' });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      return res.status(400).json({ success: false, message: 'Invalid email address' });
    }
    const user = await User.findById(req.user._id).select('+password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    const existing = await User.findOne({ email: newEmail.toLowerCase().trim(), _id: { $ne: user._id } });
    if (existing) return res.status(400).json({ success: false, message: 'Email is already in use' });
    user.email = newEmail.toLowerCase().trim();
    await user.save();
    res.json({ success: true, message: 'Email updated successfully' });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to update email' });
  }
});

// PUT /admin/me/password — change own password
router.put('/me/password', async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current and new password are required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'New password must be at least 8 characters' });
    }
    if (confirmPassword && newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match' });
    }
    const user = await User.findById(req.user._id).select('+password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    user.password = newPassword;
    await user.save();
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to change password' });
  }
});

// Dashboard
router.get('/dashboard', admin.getDashboard);

// Users
router.get('/users', admin.getUsers);
router.get('/users/:id', admin.getUserDetail);
router.put('/users/:id', admin.updateUser);
router.delete('/users/:id', admin.deleteUser);
router.put('/users/:id/permissions', admin.updateUserPermissions);

// Sessions
router.get('/sessions', admin.getSessions);
router.get('/sessions/:id', admin.getSessionDetail);
router.delete('/sessions/:id', admin.deleteSession);

// Rooms
router.get('/rooms', admin.getRooms);
router.get('/rooms/:id', admin.getRoomDetail);
router.delete('/rooms/:id', admin.deleteRoom);

// Messages
router.get('/messages', admin.getMessages);
router.delete('/messages/:id', admin.deleteMessage);

// Calls
router.get('/calls', admin.getCalls);

// Notifications
router.post('/notifications/send', admin.sendSystemNotification);

// Chatbot training
router.get('/chatbot/queries', admin.getChatbotQueries);

// Reports
router.get('/reports', admin.getReports);

// ── Bars / Venues ──────────────────────────────────────────────────────────

// GET /admin/bars — list all venues with pagination + search + filter
router.get('/bars', async (req, res) => {
  try {
    const { page = 1, limit = 20, search, status, type } = req.query;
    const query = {};
    if (search) {
      const r = new RegExp(search, 'i');
      query.$or = [{ name: r }, { 'address.city': r }, { 'address.state': r }];
    }
    if (status) query.status = status;
    if (type) query.type = type;

    const total = await Venue.countDocuments(query);
    const venues = await Venue.find(query)
      .populate('vendor', 'businessName email contactPhone')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();

    res.json({ success: true, data: { bars: venues, total, pages: Math.ceil(total / limit), page: Number(page) } });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to fetch bars' });
  }
});

// GET /admin/bars/:id — get single venue detail
router.get('/bars/:id', async (req, res) => {
  try {
    const venue = await Venue.findById(req.params.id)
      .populate('vendor', 'businessName email contactPhone')
      .lean();
    if (!venue) return res.status(404).json({ success: false, message: 'Bar not found' });
    res.json({ success: true, data: { bar: venue } });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to fetch bar' });
  }
});

// PUT /admin/bars/:id/status — update bar status
router.put('/bars/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['draft', 'active', 'paused', 'closed'];
    if (!allowed.includes(status)) return res.status(400).json({ success: false, message: 'Invalid status' });
    const venue = await Venue.findByIdAndUpdate(req.params.id, { status }, { new: true }).lean();
    if (!venue) return res.status(404).json({ success: false, message: 'Bar not found' });
    res.json({ success: true, message: `Bar status updated to ${status}`, data: { bar: venue } });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to update bar' });
  }
});

// DELETE /admin/bars/:id — delete a venue
router.delete('/bars/:id', async (req, res) => {
  try {
    const venue = await Venue.findByIdAndDelete(req.params.id);
    if (!venue) return res.status(404).json({ success: false, message: 'Bar not found' });
    res.json({ success: true, message: 'Bar deleted successfully' });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to delete bar' });
  }
});

// POST /admin/bars — create a new venue (admin-side)
router.post('/bars', async (req, res) => {
  try {
    const {
      name, type, status, description, priceLevel, capacity,
      address, location, contact, amenities, tags,
      photos, coverPhoto, logo, hours, vendor,
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Bar name is required' });
    }

    const venueData = {
      name: name.trim(),
      type: type || 'bar',
      status: status || 'draft',
      description: description || '',
      priceLevel: priceLevel || 2,
      capacity: capacity || 50,
      amenities: amenities || [],
      tags: tags || [],
      photos: photos || [],
      coverPhoto: coverPhoto || '',
      logo: logo || '',
      hours: hours || [],
    };

    if (address) venueData.address = address;
    if (contact) venueData.contact = contact;
    if (location?.coordinates) {
      venueData.location = { type: 'Point', coordinates: location.coordinates };
    }
    if (vendor) venueData.vendor = vendor;

    // Generate slug from name
    venueData.slug = name.trim().toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      + '-' + Date.now().toString(36);

    // If no vendor provided, we need to allow null — patch: use a temporary workaround
    // by finding first vendor or skipping the required check
    if (!vendor) {
      // Skip required validation by using validateBeforeSave: false
      const venue = new Venue(venueData);
      await venue.save({ validateBeforeSave: false });
      return res.json({ success: true, message: 'Bar created successfully', data: { bar: venue } });
    }

    const venue = new Venue(venueData);
    await venue.save();
    res.json({ success: true, message: 'Bar created successfully', data: { bar: venue } });
  } catch (e) {
    console.error('Create bar error:', e);
    res.status(500).json({ success: false, message: e.message || 'Failed to create bar' });
  }
});

// GET /admin/vendors — list vendors for dropdown
router.get('/vendors', async (req, res) => {
  try {
    const { search } = req.query;
    const query = { applicationStatus: { $in: ['approved', 'active'] } };
    if (search) {
      const r = new RegExp(search, 'i');
      query.$or = [{ businessName: r }, { email: r }];
    }
    const vendors = await Vendor.find(query)
      .select('businessName email phone')
      .sort({ businessName: 1 })
      .limit(50)
      .lean();
    res.json({ success: true, data: { vendors } });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to fetch vendors' });
  }
});

module.exports = router;
