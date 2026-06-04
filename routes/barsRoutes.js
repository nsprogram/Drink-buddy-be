const express = require('express');
const router = express.Router();
const Venue = require('../models/Venue');

// GET /api/bars — list all active venues (public, no auth required)
router.get('/', async (req, res) => {
  try {
    const { search, type, page = 1, limit = 100 } = req.query;
    const query = { status: 'active' };

    if (search) {
      const r = new RegExp(search, 'i');
      query.$or = [
        { name: r },
        { 'address.city': r },
        { 'address.state': r },
        { type: r },
        { tags: r },
        { description: r },
      ];
    }
    if (type) query.type = type;

    const total = await Venue.countDocuments(query);
    const venues = await Venue.find(query)
      .select('-vendor -__v -stats -slug')
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .lean();

    res.json({
      success: true,
      data: { bars: venues, total, pages: Math.ceil(total / Number(limit)), page: Number(page) },
    });
  } catch (e) {
    console.error('Public bars error:', e);
    res.status(500).json({ success: false, message: 'Failed to fetch bars' });
  }
});

// GET /api/bars/:id — single active bar
router.get('/:id', async (req, res) => {
  try {
    const venue = await Venue.findOne({ _id: req.params.id, status: 'active' })
      .select('-vendor -__v')
      .lean();
    if (!venue) return res.status(404).json({ success: false, message: 'Bar not found' });
    res.json({ success: true, data: { bar: venue } });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to fetch bar' });
  }
});

module.exports = router;
