const express = require('express');
const router  = express.Router();
const User    = require('../models/User');
const { protect } = require('../middleware/auth');
const { sendPushToUser } = require('../utils/push');

router.use(protect);

/**
 * POST /api/push/register
 * Body: { token, platform? }
 * Adds the device's Expo push token to the user, dedupe by token.
 */
router.post('/register', async (req, res) => {
  try {
    const { token, platform = 'android' } = req.body || {};
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ success: false, message: 'token is required' });
    }
    if (!/^Expo(nent)?PushToken\[/.test(token)) {
      return res.status(400).json({ success: false, message: 'Invalid Expo push token' });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.pushTokens = (user.pushTokens || []).filter(t => t.token !== token);
    user.pushTokens.push({ token, platform, addedAt: new Date(), lastUsed: new Date() });

    // Cap to 5 most-recent tokens per user
    if (user.pushTokens.length > 5) user.pushTokens = user.pushTokens.slice(-5);

    await user.save();
    res.json({ success: true, count: user.pushTokens.length });
  } catch (err) {
    console.error('[push/register]', err);
    res.status(500).json({ success: false, message: 'Failed to register push token' });
  }
});

/**
 * POST /api/push/unregister  Body: { token }
 */
router.post('/unregister', async (req, res) => {
  try {
    const { token } = req.body || {};
    if (!token) return res.status(400).json({ success: false, message: 'token is required' });
    await User.updateOne({ _id: req.user._id }, { $pull: { pushTokens: { token } } });
    res.json({ success: true });
  } catch (err) {
    console.error('[push/unregister]', err);
    res.status(500).json({ success: false, message: 'Failed to unregister' });
  }
});

/**
 * POST /api/push/test  → sends a test push to caller
 */
router.post('/test', async (req, res) => {
  const r = await sendPushToUser(req.user._id, {
    title: 'Drink Buddy 🍷',
    body: 'Push notifications are working!',
    data: { kind: 'test' },
  });
  res.json({ success: r.ok, ...r });
});

module.exports = router;
