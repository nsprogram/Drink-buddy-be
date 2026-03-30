const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Room = require('../models/Room');

const populateRoom = (query) => query
  .populate('creator', 'firstName lastName profileImage')
  .populate('members.user', 'firstName lastName profileImage isOnline')
  .populate('joinRequests.user', 'firstName lastName profileImage')
  .populate('chatMessages.sender', 'firstName lastName profileImage');

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
    const populated = await populateRoom(Room.findById(room._id));
    res.status(201).json({ success: true, message: 'Room created', data: { room: populated } });
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ success: false, message: 'Failed to create room' });
  }
});

// Get all active rooms (public + user's private)
router.get('/', protect, async (req, res) => {
  try {
    const rooms = await populateRoom(Room.find({
      isActive: true,
      $or: [
        { isPrivate: false },
        { creator: req.user._id },
        { 'members.user': req.user._id },
      ],
    })).sort({ updatedAt: -1 });
    res.json({ success: true, data: { rooms, total: rooms.length } });
  } catch (error) {
    console.error('Get rooms error:', error);
    res.status(500).json({ success: false, message: 'Failed to get rooms' });
  }
});

// Get room by ID
router.get('/:id', protect, async (req, res) => {
  try {
    const room = await populateRoom(Room.findById(req.params.id));
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }
    res.json({ success: true, data: { room } });
  } catch (error) {
    console.error('Get room error:', error);
    res.status(500).json({ success: false, message: 'Failed to get room' });
  }
});

// Join room by ID (public rooms — direct join)
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
    // Public rooms also require join request — host must approve
    const existingReq = room.joinRequests.find(r => r.user.toString() === req.user._id.toString() && r.status === 'pending');
    if (existingReq) {
      return res.status(400).json({ success: false, message: 'Request already pending' });
    }
    room.joinRequests.push({ user: req.user._id, status: 'pending', message: req.body.message || '' });
    await room.save();
    res.json({ success: true, message: 'Join request sent! Waiting for host approval.' });
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
      const populated = await populateRoom(Room.findById(room._id));
      return res.json({ success: true, message: 'Already in this room', data: { room: populated } });
    }
    if (room.members.length >= room.maxMembers) {
      return res.status(400).json({ success: false, message: 'Room is full' });
    }
    room.members.push({ user: req.user._id, role: 'member' });
    await room.save();
    const populated = await populateRoom(Room.findById(room._id));
    res.json({ success: true, message: `Joined "${room.name}"!`, data: { room: populated } });
  } catch (error) {
    console.error('Join by code error:', error);
    res.status(500).json({ success: false, message: 'Failed to join room' });
  }
});

// Request to join (public rooms with approval)
router.post('/:id/request-join', protect, async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room || !room.isActive) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }
    const alreadyMember = room.members.some(m => m.user.toString() === req.user._id.toString());
    if (alreadyMember) {
      return res.status(400).json({ success: false, message: 'Already in this room' });
    }
    const existingReq = room.joinRequests.find(r => r.user.toString() === req.user._id.toString() && r.status === 'pending');
    if (existingReq) {
      return res.status(400).json({ success: false, message: 'Request already pending' });
    }
    room.joinRequests.push({ user: req.user._id, message: req.body.message || '' });
    await room.save();
    res.json({ success: true, message: 'Join request sent!' });
  } catch (error) {
    console.error('Request join error:', error);
    res.status(500).json({ success: false, message: 'Failed to send request' });
  }
});

// Accept/deny join request (host only)
router.post('/:id/handle-request', protect, async (req, res) => {
  try {
    const { userId, action } = req.body; // action: 'accept' | 'deny'
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    if (room.creator.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only the host can handle requests' });
    }
    const reqIdx = room.joinRequests.findIndex(r => r.user.toString() === userId && r.status === 'pending');
    if (reqIdx === -1) return res.status(404).json({ success: false, message: 'Request not found' });

    if (action === 'accept') {
      if (room.members.length >= room.maxMembers) {
        return res.status(400).json({ success: false, message: 'Room is full' });
      }
      room.joinRequests[reqIdx].status = 'accepted';
      room.members.push({ user: userId, role: 'member' });
    } else {
      room.joinRequests[reqIdx].status = 'denied';
    }
    await room.save();
    const populated = await populateRoom(Room.findById(room._id));
    res.json({ success: true, message: action === 'accept' ? 'Request accepted' : 'Request denied', data: { room: populated } });
  } catch (error) {
    console.error('Handle request error:', error);
    res.status(500).json({ success: false, message: 'Failed to handle request' });
  }
});

// Update drink selection
router.post('/:id/drink-selection', protect, async (req, res) => {
  try {
    const { drinkType, brandName, quantity } = req.body;
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });

    const member = room.members.find(m => m.user.toString() === req.user._id.toString());
    if (!member) return res.status(403).json({ success: false, message: 'Not a member of this room' });

    member.drinkSelection = { drinkType, brandName: brandName || '', quantity: quantity || 1, isReady: true };
    await room.save();
    const populated = await populateRoom(Room.findById(room._id));
    res.json({ success: true, message: 'Drink selected!', data: { room: populated } });
  } catch (error) {
    console.error('Drink selection error:', error);
    res.status(500).json({ success: false, message: 'Failed to update drink' });
  }
});

// Start session (host only)
router.post('/:id/start-session', protect, async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    if (room.creator.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only the host can start the session' });
    }
    if (room.sessionStatus === 'active') {
      return res.status(400).json({ success: false, message: 'Session already active' });
    }
    room.sessionStatus = 'active';
    room.sessionStartedAt = new Date();
    // Add system message
    room.chatMessages.push({ sender: req.user._id, message: 'Session started! Cheers! 🍻', type: 'system' });
    await room.save();
    const populated = await populateRoom(Room.findById(room._id));
    res.json({ success: true, message: 'Session started!', data: { room: populated } });
  } catch (error) {
    console.error('Start session error:', error);
    res.status(500).json({ success: false, message: 'Failed to start session' });
  }
});

// End session (host only)
router.post('/:id/end-session', protect, async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    if (room.creator.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only the host can end the session' });
    }
    room.sessionStatus = 'ended';
    room.sessionEndedAt = new Date();
    room.chatMessages.push({ sender: req.user._id, message: 'Session ended. Thanks everyone! 🎉', type: 'system' });
    await room.save();
    const populated = await populateRoom(Room.findById(room._id));
    res.json({ success: true, message: 'Session ended', data: { room: populated } });
  } catch (error) {
    console.error('End session error:', error);
    res.status(500).json({ success: false, message: 'Failed to end session' });
  }
});

// Send chat message in room
router.post('/:id/chat', protect, async (req, res) => {
  try {
    const { message, type } = req.body;
    if (!message?.trim()) return res.status(400).json({ success: false, message: 'Message required' });
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    const isMember = room.members.some(m => m.user.toString() === req.user._id.toString());
    if (!isMember) return res.status(403).json({ success: false, message: 'Not a member' });

    room.chatMessages.push({ sender: req.user._id, message: message.trim(), type: type || 'text' });
    // Keep last 200 messages
    if (room.chatMessages.length > 200) {
      room.chatMessages = room.chatMessages.slice(-200);
    }
    await room.save();

    const populated = await populateRoom(Room.findById(room._id));
    const lastMsg = populated.chatMessages[populated.chatMessages.length - 1];
    res.json({ success: true, data: { message: lastMsg, room: populated } });
  } catch (error) {
    console.error('Room chat error:', error);
    res.status(500).json({ success: false, message: 'Failed to send message' });
  }
});

// Send cheers/reaction
router.post('/:id/cheers', protect, async (req, res) => {
  try {
    const { emoji } = req.body;
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    room.chatMessages.push({ sender: req.user._id, message: emoji || '🍻', type: 'cheers' });
    await room.save();
    const populated = await populateRoom(Room.findById(room._id));
    res.json({ success: true, data: { room: populated } });
  } catch (error) {
    console.error('Cheers error:', error);
    res.status(500).json({ success: false, message: 'Failed' });
  }
});

// Send safety warning (host only)
router.post('/:id/safety-warning', protect, async (req, res) => {
  try {
    const { targetUserId, type } = req.body;
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    if (room.creator.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only host can send warnings' });
    }
    const warningMessages = {
      slow_down: 'Hey, maybe slow down a bit! 🐢',
      hydrate: 'Time to drink some water! 💧',
      limit_reached: 'You might want to take a break 🛑',
    };
    room.safetyWarnings.push({ userId: targetUserId, type });
    room.chatMessages.push({ sender: req.user._id, message: warningMessages[type] || 'Take care!', type: 'system' });
    await room.save();
    res.json({ success: true, message: 'Warning sent' });
  } catch (error) {
    console.error('Safety warning error:', error);
    res.status(500).json({ success: false, message: 'Failed' });
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
    room.chatMessages.push({ sender: req.user._id, message: 'left the room', type: 'system' });
    await room.save();
    res.json({ success: true, message: 'Left room' });
  } catch (error) {
    console.error('Leave room error:', error);
    res.status(500).json({ success: false, message: 'Failed to leave room' });
  }
});

// Kick member (host only)
router.post('/:id/kick', protect, async (req, res) => {
  try {
    const { userId } = req.body;
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    if (room.creator.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only host can kick members' });
    }
    if (userId === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot kick yourself' });
    }
    room.members = room.members.filter(m => m.user.toString() !== userId);
    await room.save();
    const populated = await populateRoom(Room.findById(room._id));
    res.json({ success: true, message: 'Member removed', data: { room: populated } });
  } catch (error) {
    console.error('Kick error:', error);
    res.status(500).json({ success: false, message: 'Failed to kick member' });
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
