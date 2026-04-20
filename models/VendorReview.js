const mongoose = require('mongoose');

const vendorReviewSchema = new mongoose.Schema({
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true },
  venue:  { type: mongoose.Schema.Types.ObjectId, ref: 'Venue', required: true, index: true },
  user:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  authorName:  String,
  authorAvatar: String,
  rating: { type: Number, required: true, min: 1, max: 5 },
  title:  String,
  body:   { type: String, required: true },
  photos: [String],
  response: {
    body: String,
    at:   Date,
    by:   String,
  },
  flagged: { type: Boolean, default: false },
  flagReason: String,
  visible: { type: Boolean, default: true },
  helpfulCount: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('VendorReview', vendorReviewSchema);
