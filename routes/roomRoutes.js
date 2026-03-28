const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Room = require('../models/Room');

// Create room
router.post('/create', protect, async (req, res) => {
  try {
    const { name, size, isPrivate, description, category } = req.body;
    if (!name || !size) {
      return res.status(400).json({ success: false, message: 'Name and size are required' });
    }
    const maxMap = { small: 5, medium: 10, large: 20 };
    const room = await Room.create({
      name: name.trim(),
      creator: req.user._id,
      size,
      isPrivate: !!isPrivate,
      maxMembers: maxMap[size] || 6,
      members: [{ user: req.user._id, role: 'host' }],
      description: description?.trim() || '',
      category: category || 'other',
    });
    await room.populate('creator', 'firstName lastName profileImage');
    await room.populate('members.user', 'firstName lastName profileImage');
    res.status(201).json({ success: true, message: 'Room created', data: { room } });
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ success: false, message: 'Failed to create room' });
  }
});

// Get all active rooms (public + user's private)
router.get('/', protect, async (req, res) => {
  try {
    const rooms = await Room.find({
      isActive: true,
      $or: [
        { isPrivate: false },
        { creator: req.user._id },
        { 'members.user': req.user._id },
      ],
    })
      .populate('creator', 'firstName lastName profileImage')
      .populate('members.user', 'firstName lastName profileImage isOnline')
      .sort({ updatedAt: -1 });
    res.json({ success: true, data: { rooms, total: rooms.length } });
  } catch (error) {
    console.error('Get rooms error:', error);
    res.status(500).json({ success: false, message: 'Failed to get rooms' });
  }
});

// Get room by ID
router.get('/:id', protect, async (req, res) => {
  try {
    const room = await Room.findById(req.params.id)
      .populate('creator', 'firstName lastName profileImage')
      .populate('members.user', 'firstName lastName profileImage isOnline');
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }
    res.json({ success: true, data: { room } });
  } catch (error) {
    console.error('Get room error:', error);
    res.status(500).json({ success: false, message: 'Failed to get room' });
  }
});

// Join room by ID
router.post('/:id/join', protect, async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room || !room.isActive) {
      return res.status(404).json({ success: false, message: 'Room not found or inactive' });
    }
    if (room.isPrivate) {
      return res.status(403).json({ success: false, message: 'Use join code for private rooms' });
    }
    const alreadyMember = room.members.some(m => m.user.toString() === req.user._id.toString());
    if (alreadyMember) {
      return res.status(400).json({ success: false, message: 'Already in this room' });
    }
    if (room.members.length >= room.maxMembers) {
      return res.status(400).json({ success: false, message: 'Room is full' });
    }
    room.members.push({ user: req.user._id, role: 'member' });
    await room.save();
    await room.populate('members.user', 'firstName lastName profileImage isOnline');
    res.json({ success: true, message: 'Joined room!', data: { room } });
  } catch (error) {
    console.error('Join room error:', error);
    res.status(500).json({ success: false, message: 'Failed to join room' });
  }
});

// Join room by CODE (for private rooms)
router.post('/join-by-code', protect, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code || code.length !== 6) {
      return res.status(400).json({ success: false, message: 'Invalid join code' });
    }
    const room = await Room.findOne({ joinCode: code.toUpperCase(), isActive: true });
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found. Check the code and try again.' });
    }
    const alreadyMember = room.members.some(m => m.user.toString() === req.user._id.toString());
    if (alreadyMember) {
      await room.populate('members.user', 'firstName lastName profileImage isOnline');
      return res.json({ success: true, message: 'Already in this room', data: { room } });
    }
    if (room.members.length >= room.maxMembers) {
      return res.status(400).json({ success: false, message: 'Room is full' });
    }
    room.members.push({ user: req.user._id, role: 'member' });
    await room.save();
    await room.populate('creator', 'firstName lastName profileImage');
    await room.populate('members.user', 'firstName lastName profileImage isOnline');
    res.json({ success: true, message: `Joined "${room.name}"!`, data: { room } });
  } catch (error) {
    console.error('Join by code error:', error);
    res.status(500).json({ success: false, message: 'Failed to join room' });
  }
});

// Leave room
router.post('/:id/leave', protect, async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }
    room.members = room.members.filter(m => m.user.toString() !== req.user._id.toString());
    if (room.members.length === 0) room.isActive = false;
    await room.save();
    res.json({ success: true, message: 'Left room' });
  } catch (error) {
    console.error('Leave room error:', error);
    res.status(500).json({ success: false, message: 'Failed to leave room' });
  }
});

// Delete room (creator only)
router.delete('/:id', protect, async (req, res) => {
  try {
    const room = await Room.findOne({ _id: req.params.id, creator: req.user._id });
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found or not authorized' });
    }
    room.isActive = false;
    await room.save();
    res.json({ success: true, message: 'Room deleted' });
  } catch (error) {
    console.error('Delete room error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete room' });
  }
});

module.exports = router;
