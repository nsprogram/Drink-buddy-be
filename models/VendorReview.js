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

// Auto-generate a vendor notification on new review
vendorReviewSchema.post('save', async function(doc, next) {
  try {
    if (!doc.wasNew) return next && next();
  } catch (e) {}
  // `wasNew` isn't native; use isNew check in pre-save instead
  next && next();
});

vendorReviewSchema.pre('save', function(next) {
  this.$_wasNew = this.isNew;
  next();
});

vendorReviewSchema.post('save', async function(doc) {
  if (!doc.$_wasNew) return;
  try {
    const { pushVendorNotification } = require('../utils/vendorNotify');
    await pushVendorNotification(doc.vendor, {
      type: 'review',
      title: `New ${doc.rating}-star review`,
      message: (doc.body || '').slice(0, 140),
      link: `/reviews`,
      meta: { reviewId: doc._id, venueId: doc.venue, rating: doc.rating },
    });
  } catch (e) {
    console.error('[VendorReview] notify hook failed:', e.message);
  }
});

module.exports = mongoose.model('VendorReview', vendorReviewSchema);
