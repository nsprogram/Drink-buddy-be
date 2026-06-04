const mongoose = require('mongoose');

const alcoholBrandSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true },
  category:    {
    type: String,
    enum: ['Beer', 'Wine', 'Whiskey', 'Vodka', 'Rum', 'Gin', 'Tequila', 'Brandy', 'Liqueur', 'Cider', 'Champagne', 'Other'],
    required: true,
  },
  description: { type: String, default: '' },
  image:       { type: String, default: '' },
  country:     { type: String, default: '' },
  abv:         { type: Number, min: 0, max: 100, default: null },
  isActive:    { type: Boolean, default: true },
}, { timestamps: true });

alcoholBrandSchema.index({ name: 1 });
alcoholBrandSchema.index({ category: 1 });
alcoholBrandSchema.index({ isActive: 1 });

module.exports = mongoose.model('AlcoholBrand', alcoholBrandSchema);
