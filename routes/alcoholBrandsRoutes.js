const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const AlcoholBrand = require('../models/AlcoholBrand');

// All routes require admin auth
router.use(protect, adminOnly);

// GET /api/admin/alcohol-brands — list with search + filter + pagination
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, search, category, status } = req.query;
    const query = {};
    if (search) {
      const r = new RegExp(search, 'i');
      query.$or = [{ name: r }, { description: r }, { country: r }];
    }
    if (category) query.category = category;
    if (status === 'active')   query.isActive = true;
    if (status === 'inactive') query.isActive = false;

    const total = await AlcoholBrand.countDocuments(query);
    const brands = await AlcoholBrand.find(query)
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .lean();

    res.json({ success: true, data: { brands, total, pages: Math.ceil(total / Number(limit)), page: Number(page) } });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to fetch brands' });
  }
});

// POST /api/admin/alcohol-brands — create
router.post('/', async (req, res) => {
  try {
    const { name, category, description, image, country, abv } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: 'Brand name is required' });
    if (!category)     return res.status(400).json({ success: false, message: 'Category is required' });

    const brand = await AlcoholBrand.create({
      name: name.trim(), category, description: description || '',
      image: image || '', country: country || '',
      abv: abv != null && abv !== '' ? Number(abv) : null,
    });
    res.status(201).json({ success: true, message: 'Brand created successfully', data: { brand } });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message || 'Failed to create brand' });
  }
});

// PUT /api/admin/alcohol-brands/:id — update
router.put('/:id', async (req, res) => {
  try {
    const { name, category, description, image, country, abv, isActive } = req.body;
    const updates = {};
    if (name       !== undefined) updates.name        = name.trim();
    if (category   !== undefined) updates.category    = category;
    if (description!== undefined) updates.description = description;
    if (image      !== undefined) updates.image       = image;
    if (country    !== undefined) updates.country     = country;
    if (abv        !== undefined) updates.abv         = abv !== '' ? Number(abv) : null;
    if (isActive   !== undefined) updates.isActive    = isActive;

    const brand = await AlcoholBrand.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!brand) return res.status(404).json({ success: false, message: 'Brand not found' });
    res.json({ success: true, message: 'Brand updated', data: { brand } });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to update brand' });
  }
});

// PATCH /api/admin/alcohol-brands/:id/toggle — toggle active status
router.patch('/:id/toggle', async (req, res) => {
  try {
    const brand = await AlcoholBrand.findById(req.params.id);
    if (!brand) return res.status(404).json({ success: false, message: 'Brand not found' });
    brand.isActive = !brand.isActive;
    await brand.save();
    res.json({ success: true, message: `Brand ${brand.isActive ? 'activated' : 'deactivated'}`, data: { brand } });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to toggle brand' });
  }
});

// DELETE /api/admin/alcohol-brands/:id
router.delete('/:id', async (req, res) => {
  try {
    const brand = await AlcoholBrand.findByIdAndDelete(req.params.id);
    if (!brand) return res.status(404).json({ success: false, message: 'Brand not found' });
    res.json({ success: true, message: 'Brand deleted' });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to delete brand' });
  }
});

module.exports = router;
