const express = require('express');
const router = express.Router();
const Call = require('../models/Call');
const { protect } = require('../middleware/auth');

router.use(protect);

// Get call history
router.get('/history', async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 20 } = req.query;

    const calls = await Call.find({
      $or: [{ caller: userId }, { receiver: userId }],
    })
      .populate('caller', 'firstName lastName profileImage')
      .populate('receiver', 'firstName lastName profileImage')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Call.countDocuments({
      $or: [{ caller: userId }, { receiver: userId }],
    });

    res.json({
      success: true,
      data: {
        calls,
        pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    console.error('Get call history error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch call history' });
  }
});

// Get call history with a specific friend
router.get('/history/:friendId', async (req, res) => {
  try {
    const userId = req.user._id;
    const friendId = req.params.friendId;

    const calls = await Call.find({
      $or: [
        { caller: userId, receiver: friendId },
        { caller: friendId, receiver: userId },
      ],
    })
      .populate('caller', 'firstName lastName profileImage')
      .populate('receiver', 'firstName lastName profileImage')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ success: true, data: calls });
  } catch (error) {
    console.error('Get friend call history error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch call history' });
  }
});

// Get a specific call
router.get('/:callId', async (req, res) => {
  try {
    const call = await Call.findById(req.params.callId)
      .populate('caller', 'firstName lastName profileImage')
      .populate('receiver', 'firstName lastName profileImage');

    if (!call) return res.status(404).json({ success: false, message: 'Call not found' });

    res.json({ success: true, data: call });
  } catch (error) {
    console.error('Get call error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch call' });
  }
});

module.exports = router;
