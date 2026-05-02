const express = require('express');
const router = express.Router();
const Vendor = require('../models/Vendor');

// Public: list approved vendor profiles (no auth)
router.get('/', async (req, res) => {
  try {
    const { limit = 50, q } = req.query;
    const filter = { applicationStatus: 'approved' };
    if (q && q.trim()) {
      const safe = q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { businessName: { $regex: safe, $options: 'i' } },
        { description: { $regex: safe, $options: 'i' } },
      ];
    }
    const vendors = await Vendor.find(filter)
      .select('businessName description logo logoUrl coverImage category city state country website rating reviewCount createdAt')
      .sort({ rating: -1, createdAt: -1 })
      .limit(Math.min(parseInt(limit) || 50, 100))
      .lean();
    res.json({ success: true, data: { vendors, total: vendors.length } });
  } catch (err) {
    console.error('[PublicVendor] list:', err);
    res.status(500).json({ success: false, message: 'Failed to load vendors' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id)
      .select('-password -refreshTokens -bankDetails -__v')
      .lean();
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });
    if (vendor.applicationStatus !== 'approved') {
      return res.status(403).json({ success: false, message: 'Vendor not public' });
    }
    res.json({ success: true, data: { vendor } });
  } catch (err) {
    console.error('[PublicVendor] get:', err);
    res.status(500).json({ success: false, message: 'Failed to load vendor' });
  }
});

module.exports = router;
