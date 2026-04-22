const mongoose = require('mongoose');
const Booking = require('../../models/Booking');
const VendorReview = require('../../models/VendorReview');
const Venue = require('../../models/Venue');
const Promotion = require('../../models/Promotion');

const toObjId = (v) => new mongoose.Types.ObjectId(v);

exports.summary = async (req, res) => {
  const vendorId = toObjId(req.vendorId);
  
  // Get basic counts
  const [venues, bookings, reviews, promos] = await Promise.all([
    Venue.countDocuments({ vendor: vendorId }),
    Booking.countDocuments({ vendor: vendorId }),
    VendorReview.countDocuments({ vendor: vendorId }),
    Promotion.countDocuments({ vendor: vendorId, status: 'active' }),
  ]);

  // Get revenue
  const revenueAgg = await Booking.aggregate([
    { $match: { vendor: vendorId, status: 'completed' } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);

  // Get average rating
  const ratingAgg = await VendorReview.aggregate([
    { $match: { vendor: vendorId } },
    { $group: { _id: null, avg: { $avg: '$rating' } } }
  ]);

  // Get today's bookings
  const today = new Date(); today.setHours(0,0,0,0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const todayBookings = await Booking.countDocuments({
    vendor: vendorId, date: { $gte: today, $lt: tomorrow }
  });

  // Get menu items count and stock status
  const venuesWithMenu = await Venue.find({ vendor: vendorId }).select('menu stats').lean();
  let menuItems = 0;
  let availableItems = 0;
  let outOfStock = 0;
  let lowStock = 0;
  let totalViews = 0;
  
  venuesWithMenu.forEach(venue => {
    if (venue.menu && Array.isArray(venue.menu)) {
      menuItems += venue.menu.length;
      venue.menu.forEach(item => {
        if (item.stockStatus === 'in-stock' || item.isAvailable) {
          availableItems++;
        } else if (item.stockStatus === 'out-of-stock') {
          outOfStock++;
        } else if (item.stockStatus === 'low-stock') {
          lowStock++;
        }
      });
    }
    if (venue.stats && venue.stats.views) {
      totalViews += venue.stats.views;
    }
  });

  res.json({
    success: true,
    data: {
      venues,
      bookings,
      reviews,
      totalReviews: reviews,
      activePromotions: promos,
      revenue: revenueAgg[0]?.total || 0,
      avgRating: ratingAgg[0]?.avg || 0,
      todayBookings,
      menuItems,
      availableItems,
      outOfStock,
      lowStock,
      views: totalViews,
      likes: 0, // TODO: Implement likes system
      favorites: 0, // TODO: Implement favorites system
    }
  });
};

exports.revenueSeries = async (req, res) => {
  const vendorId = toObjId(req.vendorId);
  const days = Math.min(parseInt(req.query.days) || 30, 365);
  const from = new Date(); from.setDate(from.getDate() - days); from.setHours(0,0,0,0);

  const series = await Booking.aggregate([
    { $match: { vendor: vendorId, status: 'completed', createdAt: { $gte: from } } },
    { $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        revenue: { $sum: '$amount' },
        bookings: { $sum: 1 }
    }},
    { $sort: { _id: 1 } }
  ]);

  res.json({ success: true, data: { series } });
};

exports.bookingsSeries = async (req, res) => {
  const vendorId = toObjId(req.vendorId);
  const days = Math.min(parseInt(req.query.days) || 30, 365);
  const from = new Date(); from.setDate(from.getDate() - days); from.setHours(0,0,0,0);
  const series = await Booking.aggregate([
    { $match: { vendor: vendorId, createdAt: { $gte: from } } },
    { $group: {
        _id: { d: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, status: '$status' },
        count: { $sum: 1 }
    }},
    { $sort: { '_id.d': 1 } }
  ]);
  res.json({ success: true, data: { series } });
};

exports.customers = async (req, res) => {
  const vendorId = toObjId(req.vendorId);
  const top = await Booking.aggregate([
    { $match: { vendor: vendorId } },
    { $group: {
        _id: '$guestEmail',
        name: { $first: '$guestName' },
        visits: { $sum: 1 },
        spend: { $sum: '$amount' }
    }},
    { $sort: { visits: -1 } },
    { $limit: 50 }
  ]);
  res.json({ success: true, data: { customers: top } });
};

exports.exportCsv = async (req, res) => {
  const vendorId = toObjId(req.vendorId);
  const { type = 'bookings' } = req.query;
  let rows = [], header = '';
  if (type === 'bookings') {
    const bookings = await Booking.find({ vendor: vendorId }).populate('venue','name').limit(5000).lean();
    header = 'Date,Time,Guest,Party,Status,Amount,Venue';
    rows = bookings.map(b => [
      new Date(b.date).toISOString().slice(0,10), b.time, b.guestName, b.partySize, b.status, b.amount || 0, b.venue?.name || ''
    ].map(v => `"${String(v).replace(/"/g,'""')}"`).join(','));
  }
  const csv = [header, ...rows].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${type}.csv"`);
  res.send(csv);
};
