const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { protect } = require('../middleware/auth');
const DrinkComment = require('../models/DrinkComment');

/**
 * Public: list comments + aggregate stats for a drink
 * GET /api/drink-comments/:drinkId
 */
router.get('/:drinkId', async (req, res) => {
  try {
    const { drinkId } = req.params;
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const skip  = Math.max(parseInt(req.query.skip)  || 0, 0);

    const filter = { drinkId, visible: true };
    const [comments, total, agg] = await Promise.all([
      DrinkComment.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      DrinkComment.countDocuments(filter),
      DrinkComment.aggregate([
        { $match: { drinkId, visible: true } },
        { $group: {
            _id: null,
            avg: { $avg: '$rating' },
            count: { $sum: 1 },
            r5: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } },
            r4: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } },
            r3: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } },
            r2: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } },
            r1: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } },
          } }
      ]),
    ]);

    const stats = agg[0] || { avg: 0, count: 0, r5: 0, r4: 0, r3: 0, r2: 0, r1: 0 };
    delete stats._id;
    stats.avg = Number((stats.avg || 0).toFixed(2));

    res.json({ success: true, data: { comments, total, stats } });
  } catch (error) {
    console.error('[drink-comments] list error:', error);
    res.status(500).json({ success: false, message: 'Failed to load comments' });
  }
});

/**
 * Authenticated: post a new comment.
 * POST /api/drink-comments/:drinkId
 * body: { rating, comment, drinkName?, drinkImage?, authorEmoji?, authorColor? }
 */
router.post('/:drinkId', protect, async (req, res) => {
  try {
    const { drinkId } = req.params;
    const { rating, comment, drinkName, drinkImage, authorEmoji, authorColor } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be 1–5' });
    }
    if (!comment || !comment.trim()) {
      return res.status(400).json({ success: false, message: 'Comment is required' });
    }

    const doc = await DrinkComment.create({
      drinkId,
      drinkName,
      drinkImage,
      user: req.user._id,
      authorName: [req.user.firstName, req.user.lastName].filter(Boolean).join(' ') || req.user.email?.split('@')[0] || 'Guest',
      authorAvatar: req.user.profileImage || req.user.avatar,
      authorEmoji: authorEmoji || '🥂',
      authorColor: authorColor || '#FF9F43',
      rating,
      comment: comment.trim(),
    });

    res.status(201).json({ success: true, data: { comment: doc } });
  } catch (error) {
    console.error('[drink-comments] create error:', error);
    res.status(500).json({ success: false, message: 'Failed to post comment' });
  }
});

/**
 * Authenticated: toggle like on a comment.
 * POST /api/drink-comments/:drinkId/:commentId/like
 */
router.post('/:drinkId/:commentId/like', protect, async (req, res) => {
  try {
    const { commentId } = req.params;
    if (!mongoose.isValidObjectId(commentId)) {
      return res.status(400).json({ success: false, message: 'Invalid comment id' });
    }
    const userId = req.user._id;
    const doc = await DrinkComment.findById(commentId);
    if (!doc) return res.status(404).json({ success: false, message: 'Comment not found' });

    const hasLiked = doc.likedBy.some(u => u.toString() === userId.toString());
    if (hasLiked) {
      doc.likedBy = doc.likedBy.filter(u => u.toString() !== userId.toString());
      doc.likes = Math.max(0, doc.likes - 1);
    } else {
      doc.likedBy.push(userId);
      doc.likes += 1;
    }
    await doc.save();
    res.json({ success: true, data: { likes: doc.likes, liked: !hasLiked } });
  } catch (error) {
    console.error('[drink-comments] like error:', error);
    res.status(500).json({ success: false, message: 'Failed to like comment' });
  }
});

/**
 * Authenticated: delete own comment.
 * DELETE /api/drink-comments/:drinkId/:commentId
 */
router.delete('/:drinkId/:commentId', protect, async (req, res) => {
  try {
    const { commentId } = req.params;
    if (!mongoose.isValidObjectId(commentId)) {
      return res.status(400).json({ success: false, message: 'Invalid comment id' });
    }
    const doc = await DrinkComment.findOneAndDelete({ _id: commentId, user: req.user._id });
    if (!doc) return res.status(404).json({ success: false, message: 'Comment not found' });
    res.json({ success: true, message: 'Comment deleted' });
  } catch (error) {
    console.error('[drink-comments] delete error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete comment' });
  }
});

module.exports = router;
