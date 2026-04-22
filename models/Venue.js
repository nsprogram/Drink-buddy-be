const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: String,
  category: { 
    type: String, 
    enum: [
      'beer', 
      'wine', 
      'cocktail', 
      'spirit', 
      'food', 
      'non-alcoholic', 
      'other',
      // Additional categories from frontend
      'signature-cocktails',
      'premium-whiskey',
      'craft-beer',
      'house-specials',
      'happy-hour',
      'seasonal-drinks',
      'food-pairings',
      'mocktails',
      'bottles-packages'
    ], 
    default: 'other' 
  },
  price: { type: Number, required: true, min: 0 },
  discountPrice: { type: Number, min: 0, default: 0 },
  currency: { type: String, default: 'INR' },
  brand: { type: String, trim: true },
  servingSize: String,
  alcoholPercentage: { type: Number, min: 0, max: 100, default: 0 },
  image: String,
  video: String,
  isAvailable: { type: Boolean, default: true },
  isFeatured: { type: Boolean, default: false },
  ageRestricted: { type: Boolean, default: false },
  minAge: { type: Number, min: 0, max: 100, default: 18 },
  tags: [String],
  allergens: String,
  dietaryNotes: String,
  abv: Number,
  volume: String,
  stockStatus: { type: String, enum: ['in-stock', 'low-stock', 'out-of-stock'], default: 'in-stock' },
  isVegetarian: { type: Boolean, default: false },
  isVegan: { type: Boolean, default: false },
  isGlutenFree: { type: Boolean, default: false },
}, { timestamps: true });

const hoursSchema = new mongoose.Schema({
  day: { type: String, enum: ['mon','tue','wed','thu','fri','sat','sun'], required: true },
  open: String,
  close: String,
  closed: { type: Boolean, default: false },
}, { _id: false });

const venueSchema = new mongoose.Schema({
  vendor:   { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true },
  name:     { type: String, required: true, trim: true },
  slug:     { type: String, trim: true, lowercase: true, index: true },
  description: String,
  type:     { type: String, enum: ['bar','pub','lounge','nightclub','restaurant','brewery','winery','cafe','other'], default: 'bar' },
  status:   { type: String, enum: ['draft','active','paused','closed'], default: 'draft' },

  address: {
    line1: String, line2: String, city: String, state: String,
    country: { type: String, default: 'India' }, postalCode: String,
  },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [0,0] }, // [lng, lat]
  },
  contact: {
    phone: String, email: String, website: String,
    instagram: String, facebook: String,
  },
  photos: [String],
  coverPhoto: String,
  logo: String,
  amenities: [String],       // e.g. "wifi","parking","outdoor","livemusic"
  tags: [String],
  priceLevel: { type: Number, min: 1, max: 4, default: 2 },
  capacity: { type: Number, default: 50 },

  hours: [hoursSchema],
  menu: [menuItemSchema],

  rating: { type: Number, default: 0, min: 0, max: 5 },
  reviewCount: { type: Number, default: 0 },

  stats: {
    views: { type: Number, default: 0 },
    bookings: { type: Number, default: 0 },
    revenue: { type: Number, default: 0 },
  },
}, { timestamps: true });

venueSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Venue', venueSchema);
