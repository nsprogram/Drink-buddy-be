const mongoose = require('mongoose');

const promotionSchema = new mongoose.Schema({
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true },
  venue:  { type: mongoose.Schema.Types.ObjectId, ref: 'Venue', required: true, index: true },
  title: { type: String, required: true, trim: true },
  description: String,
  type: { type: String, enum: ['happy-hour','ladies-night','discount','bogo','combo','event','loyalty','flash'], default: 'discount' },
  discountType: { type: String, enum: ['percent','flat','bogo','none'], default: 'percent' },
  discountValue: { type: Number, default: 0 },
  code: { type: String, uppercase: true, trim: true },
  image: String,
  startsAt: { type: Date, required: true },
  endsAt:   { type: Date, required: true },
  daysOfWeek: [{ type: String, enum: ['mon','tue','wed','thu','fri','sat','sun'] }],
  timeWindow: {
    start: String,  // "18:00"
    end:   String,  // "21:00"
  },
  applicableItems: [{ type: mongoose.Schema.Types.ObjectId }],
  usageLimit: { type: Number, default: 0 }, // 0 = unlimited
  perUserLimit: { type: Number, default: 0 },
  minSpend: { type: Number, default: 0 },
  status: { type: String, enum: ['draft','scheduled','active','paused','expired'], default: 'draft' },
  impressions: { type: Number, default: 0 },
  clicks:      { type: Number, default: 0 },
  redemptions: { type: Number, default: 0 },
  revenue:     { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Promotion', promotionSchema);
