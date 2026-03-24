const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Room = require('../models/Room');

// Create room
router.post('/create', protect, async (req, res) => {
  try {
    const { name, size, isPrivate } = req.body;
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
    });
    await room.populate('members.user', 'firstName lastName profileImage');
    res.status(201).json({ success: true, message: 'Room created', data: { room } });
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ success: false, message: 'Failed to create room' });
  }
});

// Get user's rooms
router.get('/', protect, async (req, res) => {
  try {
    const rooms = await Room.find({
      $or: [{ creator: req.user._id }, { 'members.user': req.user._id }],
      isActive: true,
    })
      .populate('creator', 'firstName lastName profileImage')
      .populate('members.user', 'firstName lastName profileImage')
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

// Join room
router.post('/:id/join', protect, async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }
    if (!room.isActive) {
      return res.status(400).json({ success: false, message: 'Room is no longer active' });
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
    res.json({ success: true, message: 'Joined room', data: { room } });
  } catch (error) {
    console.error('Join room error:', error);
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
    if (room.members.length === 0) {
      room.isActive = false;
    }
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
