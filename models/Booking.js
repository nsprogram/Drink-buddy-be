const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true },
  venue:  { type: mongoose.Schema.Types.ObjectId, ref: 'Venue', required: true, index: true },
  user:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  guestName:  { type: String, required: true },
  guestEmail: String,
  guestPhone: String,
  partySize:  { type: Number, default: 2, min: 1 },
  date:       { type: Date, required: true, index: true },
  time:       { type: String, required: true }, // "19:30"
  specialRequests: String,
  tableNumber: String,
  status: { type: String, enum: ['pending','confirmed','checked-in','completed','cancelled','no-show'], default: 'pending', index: true },
  statusHistory: [{
    status: String,
    at: { type: Date, default: Date.now },
    by: String,
    note: String,
  }],
  amount:    { type: Number, default: 0 },
  depositPaid: { type: Number, default: 0 },
  promotion: { type: mongoose.Schema.Types.ObjectId, ref: 'Promotion' },
  source: { type: String, enum: ['app','web','walk-in','phone'], default: 'app' },
}, { timestamps: true });

bookingSchema.methods.transitionTo = function(nextStatus, by, note) {
  this.statusHistory.push({ status: nextStatus, by, note, at: new Date() });
  this.status = nextStatus;
};

module.exports = mongoose.model('Booking', bookingSchema);
