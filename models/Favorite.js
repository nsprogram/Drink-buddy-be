const mongoose = require('mongoose');

const favoriteSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['bar', 'drink'], required: true },
  // Bar fields
  barName: { type: String },
  barType: { type: String },
  barDistance: { type: String },
  barRating: { type: String },
  barStatus: { type: String },
  barPrice: { type: String },
  // Drink fields
  drinkName: { type: String },
  drinkType: { type: String },
  drinkBrand: { type: String },
  drinkRating: { type: Number, min: 1, max: 5 },
  drinkNotes: { type: String, maxlength: 500 },
  drinkColor: { type: String },
}, { timestamps: true });

favoriteSchema.index({ user: 1, type: 1 });
favoriteSchema.index({ user: 1, type: 1, barName: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Favorite', favoriteSchema);
