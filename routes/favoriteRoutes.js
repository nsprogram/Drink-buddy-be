const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Favorite = require('../models/Favorite');

// Get all favorites
router.get('/', protect, async (req, res) => {
  try {
    const { type } = req.query;
    const filter = { user: req.user._id };
    if (type) filter.type = type;
    const favorites = await Favorite.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, data: { favorites, total: favorites.length } });
  } catch (error) {
    console.error('Get favorites error:', error);
    res.status(500).json({ success: false, message: 'Failed to get favorites' });
  }
});

// Add favorite
router.post('/', protect, async (req, res) => {
  try {
    const data = { user: req.user._id, ...req.body };
    const favorite = await Favorite.create(data);
    res.status(201).json({ success: true, message: 'Added to favorites', data: { favorite } });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Already in favorites' });
    }
    console.error('Add favorite error:', error);
    res.status(500).json({ success: false, message: 'Failed to add favorite' });
  }
});

// Remove favorite
router.delete('/:id', protect, async (req, res) => {
  try {
    const favorite = await Favorite.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!favorite) {
      return res.status(404).json({ success: false, message: 'Favorite not found' });
    }
    res.json({ success: true, message: 'Removed from favorites' });
  } catch (error) {
    console.error('Remove favorite error:', error);
    res.status(500).json({ success: false, message: 'Failed to remove favorite' });
  }
});

module.exports = router;
