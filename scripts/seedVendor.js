#!/usr/bin/env node
// Seeds a demo vendor with venues, menu, promotions, bookings, and reviews.
// Usage: node scripts/seedVendor.js
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const Vendor = require('../models/Vendor');
const Venue  = require('../models/Venue');
const Promotion = require('../models/Promotion');
const Booking   = require('../models/Booking');
const VendorReview = require('../models/VendorReview');
const Inventory    = require('../models/Inventory');

const URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/drinkbuddy';

async function main() {
  await mongoose.connect(URI);
  console.log('Connected', mongoose.connection.name);

  const email = 'demo@vendor.com';
  await Vendor.deleteOne({ email });

  const vendor = await Vendor.create({
    email, password: 'Vendor@123',
    businessName: 'The Tipsy Fox Group',
    ownerName: 'Alex Morgan',
    phone: '+91 90000 00000',
    isEmailVerified: true,
    subscription: { tier: 'pro', venueLimit: 10, status: 'active' },
  });
  console.log('Vendor created:', vendor.email);

  // Clear old data for this vendor
  await Promise.all([
    Venue.deleteMany({ vendor: vendor._id }),
    Promotion.deleteMany({ vendor: vendor._id }),
    Booking.deleteMany({ vendor: vendor._id }),
    VendorReview.deleteMany({ vendor: vendor._id }),
    Inventory.deleteMany({ vendor: vendor._id }),
  ]);

  const baseHours = ['mon','tue','wed','thu','fri','sat','sun'].map(d => ({
    day: d, open: '17:00', close: d === 'fri' || d === 'sat' ? '02:00' : '00:00',
  }));

  const menuSample = [
    { name: 'Kingfisher Draught',    category: 'beer',      price: 180, abv: 4.8, volume: '500ml', isFeatured: true },
    { name: 'Old Monk & Coke',       category: 'cocktail',  price: 250 },
    { name: 'Whiskey Sour',          category: 'cocktail',  price: 380, isFeatured: true },
    { name: 'House Red Wine',        category: 'wine',      price: 420, volume: '150ml' },
    { name: 'Chicken Wings (8pc)',   category: 'food',      price: 340 },
    { name: 'Margherita Pizza',      category: 'food',      price: 380 },
    { name: 'Virgin Mojito',         category: 'non-alcoholic', price: 180 },
  ];

  const venue1 = await Venue.create({
    vendor: vendor._id, name: 'The Tipsy Fox — Bandra', slug: 'tipsy-fox-bandra',
    description: 'Cozy neighborhood bar with craft cocktails, live music on weekends, and a rooftop garden.',
    type: 'bar', status: 'active',
    address: { line1: '12 Waterfield Rd', city: 'Mumbai', state: 'MH', postalCode: '400050' },
    location: { type: 'Point', coordinates: [72.8295, 19.0597] },
    contact: { phone: '+91 22 1234 5678', email: 'bandra@tipsyfox.com', instagram: '@tipsyfox' },
    photos: [
      'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=1200',
      'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=1200',
    ],
    coverPhoto: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=1600',
    amenities: ['wifi','outdoor','livemusic','parking','cardsaccepted'],
    priceLevel: 3, capacity: 80,
    hours: baseHours, menu: menuSample,
    rating: 4.4, reviewCount: 127,
  });

  const venue2 = await Venue.create({
    vendor: vendor._id, name: 'The Tipsy Fox — Andheri', slug: 'tipsy-fox-andheri',
    description: 'Modern sports lounge with big screens, craft beer on tap, and late-night food.',
    type: 'lounge', status: 'active',
    address: { line1: '4th Rd, Andheri West', city: 'Mumbai', state: 'MH', postalCode: '400058' },
    location: { type: 'Point', coordinates: [72.8336, 19.1364] },
    contact: { phone: '+91 22 8765 4321' },
    photos: ['https://images.unsplash.com/photo-1572116469696-31de0f17cc34?w=1200'],
    coverPhoto: 'https://images.unsplash.com/photo-1572116469696-31de0f17cc34?w=1600',
    amenities: ['wifi','sports','parking'], priceLevel: 2, capacity: 120,
    hours: baseHours, menu: menuSample.slice(0, 5),
    rating: 4.1, reviewCount: 58,
  });

  // Promotions
  const now = new Date();
  const plus = (d) => { const x = new Date(now); x.setDate(x.getDate() + d); return x; };
  await Promotion.create([
    { vendor: vendor._id, venue: venue1._id, title: 'Weekday Happy Hour', type: 'happy-hour',
      description: 'Buy-1-Get-1 on all cocktails and draught beer, Mon–Thu 5–8pm.',
      discountType: 'bogo', startsAt: plus(-7), endsAt: plus(30),
      daysOfWeek: ['mon','tue','wed','thu'], timeWindow: { start: '17:00', end: '20:00' },
      status: 'active', impressions: 2340, clicks: 412, redemptions: 87, revenue: 24500 },
    { vendor: vendor._id, venue: venue1._id, title: 'Ladies Night Thursday', type: 'ladies-night',
      description: 'Complimentary sangria + 20% off for women on Thursdays.',
      discountType: 'percent', discountValue: 20,
      startsAt: plus(-30), endsAt: plus(60), daysOfWeek: ['thu'], status: 'active',
      impressions: 1200, clicks: 310, redemptions: 44, revenue: 9800 },
    { vendor: vendor._id, venue: venue2._id, title: 'Match Day Combo', type: 'combo',
      description: 'Pitcher + wings combo @ ₹799 during any live sports fixture.',
      discountType: 'flat', discountValue: 150, code: 'MATCH150',
      startsAt: plus(-3), endsAt: plus(14), status: 'active',
      impressions: 560, clicks: 102, redemptions: 22, revenue: 17600 },
  ]);

  // Bookings — 10 across venues
  const names = ['Priya Sharma','Rahul Patel','Aisha Khan','Vikram Rao','Neha Gupta','Arjun Mehta','Sana Ali','Ravi Kumar','Meera Iyer','Karan Singh'];
  const statuses = ['pending','confirmed','confirmed','completed','completed','completed','checked-in','cancelled','confirmed','pending'];
  const bookingDocs = [];
  for (let i = 0; i < 10; i++) {
    bookingDocs.push({
      vendor: vendor._id,
      venue: i % 2 === 0 ? venue1._id : venue2._id,
      guestName: names[i], guestEmail: names[i].toLowerCase().replace(' ','.') + '@mail.com',
      guestPhone: '+91 9' + String(100000000 + i * 12345).slice(0, 9),
      partySize: 2 + (i % 5),
      date: plus(i - 3),
      time: ['18:30','19:00','20:00','21:30'][i % 4],
      status: statuses[i],
      amount: statuses[i] === 'completed' ? 800 + i * 150 : 0,
      source: 'app',
    });
  }
  await Booking.insertMany(bookingDocs);

  // Reviews
  const reviews = [
    { rating: 5, authorName: 'Priya S.', title: 'Best happy hour in town', body: 'Great cocktails, friendly staff, and the rooftop is gorgeous at sunset.' },
    { rating: 4, authorName: 'Rahul P.', body: 'Solid place, drinks are strong. Food can be slow on weekends.' },
    { rating: 5, authorName: 'Aisha K.', title: 'Amazing vibe', body: 'Loved the live band on Saturday. Will be back.' },
    { rating: 3, authorName: 'Vikram R.', body: 'Decent. A bit pricey but the ambiance makes up for it.' },
    { rating: 5, authorName: 'Neha G.', body: 'My go-to for catching up with friends. The whiskey sour is a must-try.' },
  ];
  await VendorReview.insertMany(reviews.map((r, i) => ({
    ...r, vendor: vendor._id, venue: i % 2 === 0 ? venue1._id : venue2._id,
  })));

  // Inventory
  await Inventory.insertMany([
    { vendor: vendor._id, venue: venue1._id, name: 'Kingfisher 500ml', category: 'beer', quantity: 48, lowStockThreshold: 24, costPrice: 120, sellPrice: 180 },
    { vendor: vendor._id, venue: venue1._id, name: 'Old Monk 750ml',   category: 'spirit', quantity: 6,  lowStockThreshold: 8,  costPrice: 420, sellPrice: 0 },
    { vendor: vendor._id, venue: venue1._id, name: 'Tonic Water',       category: 'mixer',  quantity: 40, lowStockThreshold: 15, costPrice: 30,  sellPrice: 80 },
    { vendor: vendor._id, venue: venue2._id, name: 'Bira White',        category: 'beer',   quantity: 3,  lowStockThreshold: 12, costPrice: 110, sellPrice: 180 },
  ]);

  console.log('\n✅ Seed complete');
  console.log('   Login: demo@vendor.com / Vendor@123');
  console.log('   Venues:', venue1.name, '|', venue2.name);

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(async (e) => {
  console.error('Seed failed:', e);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
