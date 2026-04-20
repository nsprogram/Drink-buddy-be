const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true },
  venue:  { type: mongoose.Schema.Types.ObjectId, ref: 'Venue', required: true, index: true },
  name:   { type: String, required: true, trim: true },
  sku:    { type: String, trim: true },
  category: { type: String, enum: ['beer','wine','spirit','cocktail','mixer','food','supplies','other'], default: 'other' },
  unit:    { type: String, default: 'bottle' },
  quantity: { type: Number, default: 0 },
  lowStockThreshold: { type: Number, default: 5 },
  costPrice:  { type: Number, default: 0 },
  sellPrice:  { type: Number, default: 0 },
  supplier:   String,
  lastRestockedAt: Date,
  notes: String,
}, { timestamps: true });

inventorySchema.virtual('isLowStock').get(function() {
  return this.quantity <= this.lowStockThreshold;
});

module.exports = mongoose.model('Inventory', inventorySchema);
