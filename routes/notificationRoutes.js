const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Notification = require('../models/Notification');

// Get all notifications (paginated)
router.get('/', protect, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 30;
    const skip = (page - 1) * limit;

    const notifications = await Notification.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const unreadCount = await Notification.countDocuments({ user: req.user._id, read: false });
    const total = await Notification.countDocuments({ user: req.user._id });

    res.json({
      success: true,
      message: 'Notifications fetched',
      data: { notifications, unreadCount, total, page, hasMore: skip + notifications.length < total },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch notifications' });
  }
});

// Get unread count
router.get('/unread-count', protect, async (req, res) => {
  try {
    const count = await Notification.countDocuments({ user: req.user._id, read: false });
    res.json({ success: true, data: { count } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to get count' });
  }
});

// Mark all as read (must be before /:id routes)
router.put('/read-all', protect, async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { user: req.user._id, read: false },
      { read: true, readAt: new Date() }
    );
    res.json({ 
      success: true, 
      message: 'All notifications marked as read',
      data: { modifiedCount: result.modifiedCount }
    });
  } catch (err) {
    console.error('Error marking all as read:', err);
    res.status(500).json({ success: false, message: 'Failed to mark all as read' });
  }
});

// Get single notification
router.get('/:id', protect, async (req, res) => {
  try {
    const notification = await Notification.findOne({ _id: req.params.id, user: req.user._id }).lean();
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    res.json({ success: true, data: { notification } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch notification' });
  }
});

// Mark one as read
router.put('/:id/read', protect, async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { read: true, readAt: new Date() },
      { new: true }
    );
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    res.json({ success: true, message: 'Marked as read', data: { notification } });
  } catch (err) {
    console.error('Error marking notification as read:', err);
    res.status(500).json({ success: false, message: 'Failed to mark as read' });
  }
});

// Delete all (must be before /:id route)
router.delete('/all', protect, async (req, res) => {
  try {
    const result = await Notification.deleteMany({ user: req.user._id });
    res.json({ 
      success: true, 
      message: 'All notifications deleted',
      data: { deletedCount: result.deletedCount }
    });
  } catch (err) {
    console.error('Error deleting all notifications:', err);
    res.status(500).json({ success: false, message: 'Failed to delete notifications' });
  }
});

// Delete one
router.delete('/:id', protect, async (req, res) => {
  try {
    const notification = await Notification.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    res.json({ success: true, message: 'Notification deleted', data: { notification } });
  } catch (err) {
    console.error('Error deleting notification:', err);
    res.status(500).json({ success: false, message: 'Failed to delete notification' });
  }
});

module.exports = router;
