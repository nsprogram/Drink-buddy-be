const Booking = require('../../models/Booking');
const Venue   = require('../../models/Venue');
const { pushVendorNotification } = require('../../utils/vendorNotify');

const ALLOWED = {
  pending:    ['confirmed','cancelled'],
  confirmed:  ['checked-in','cancelled','no-show'],
  'checked-in': ['completed','cancelled'],
  completed:  [],
  cancelled:  [],
  'no-show':  [],
};

exports.list = async (req, res) => {
  const { venue, status, from, to, q } = req.query;
  const query = { vendor: req.vendorId };
  if (venue) query.venue = venue;
  if (status) query.status = status;
  if (from || to) {
    query.date = {};
    if (from) query.date.$gte = new Date(from);
    if (to) query.date.$lte = new Date(to);
  }
  if (q) query.guestName = new RegExp(q, 'i');
  const bookings = await Booking.find(query).sort('-date').populate('venue', 'name').limit(500);
  res.json({ success: true, data: { bookings } });
};

exports.get = async (req, res) => {
  const b = await Booking.findOne({ _id: req.params.id, vendor: req.vendorId }).populate('venue', 'name');
  if (!b) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, data: { booking: b } });
};

exports.create = async (req, res) => {
  const booking = await Booking.create({ ...req.body, vendor: req.vendorId });
  pushVendorNotification(req.vendorId, {
    type: 'booking',
    title: 'New booking',
    message: `${booking.guestName || 'Guest'} booked ${booking.partySize || ''} for ${new Date(booking.date).toLocaleDateString()}${booking.time ? ' at ' + booking.time : ''}`,
    link: `/bookings/${booking._id}`,
    meta: { bookingId: booking._id, venueId: booking.venue, status: booking.status },
  });
  res.status(201).json({ success: true, data: { booking } });
};

exports.update = async (req, res) => {
  const b = await Booking.findOneAndUpdate(
    { _id: req.params.id, vendor: req.vendorId },
    req.body, { new: true }
  );
  if (!b) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, data: { booking: b } });
};

async function transition(req, res, nextStatus) {
  const b = await Booking.findOne({ _id: req.params.id, vendor: req.vendorId });
  if (!b) return res.status(404).json({ success: false, message: 'Not found' });
  const allowed = ALLOWED[b.status] || [];
  if (!allowed.includes(nextStatus)) {
    return res.status(400).json({ success: false, message: `Cannot transition from ${b.status} to ${nextStatus}` });
  }
  b.transitionTo(nextStatus, req.vendor.email, req.body?.note);
  if (nextStatus === 'completed' && b.amount) {
    await Venue.updateOne({ _id: b.venue }, { $inc: { 'stats.revenue': b.amount, 'stats.bookings': 1 } });
  }
  await b.save();
  res.json({ success: true, data: { booking: b } });
}

exports.confirm  = (req, res) => transition(req, res, 'confirmed');
exports.checkIn  = (req, res) => transition(req, res, 'checked-in');
exports.complete = (req, res) => transition(req, res, 'completed');
exports.cancel   = (req, res) => transition(req, res, 'cancelled');
exports.noShow   = (req, res) => transition(req, res, 'no-show');

exports.calendar = async (req, res) => {
  const { venue, month } = req.query;
  const query = { vendor: req.vendorId };
  if (venue) query.venue = venue;
  if (month) {
    const start = new Date(month + '-01');
    const end = new Date(start); end.setMonth(end.getMonth() + 1);
    query.date = { $gte: start, $lt: end };
  }
  const bookings = await Booking.find(query).select('date time status partySize guestName venue').sort('date');
  res.json({ success: true, data: { bookings } });
};
