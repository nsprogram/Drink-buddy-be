const express = require('express');
const router  = express.Router();
const AlcoholBrand = require('../models/AlcoholBrand');

// GET /api/alcohol-brands — public, no auth required
// Query: ?category=Beer&search=jack&page=1&limit=50
router.get('/', async (req, res) => {
  try {
    const { category, search, page = 1, limit = 50 } = req.query;
    const query = { isActive: true };

    if (category) query.category = category;
    if (search) {
      const r = new RegExp(search, 'i');
      query.$or = [{ name: r }, { description: r }, { country: r }];
    }

    const total  = await AlcoholBrand.countDocuments(query);
    const brands = await AlcoholBrand.find(query)
      .sort({ name: 1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .lean();

    res.json({
      success: true,
      data: { brands, total, pages: Math.ceil(total / Number(limit)), page: Number(page) },
    });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to fetch brands' });
  }
});

module.exports = router;
