const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const teamMemberSchema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true, trim: true },
  name: String,
  role: { type: String, enum: ['owner', 'manager', 'staff'], default: 'staff' },
  invitedAt: { type: Date, default: Date.now },
  acceptedAt: Date,
  status: { type: String, enum: ['invited', 'active', 'suspended'], default: 'invited' }
}, { _id: true });

const vendorSchema = new mongoose.Schema({
  email:    { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  password: { type: String, required: true, select: false },
  businessName: { type: String, required: true, trim: true },
  ownerName:    { type: String, trim: true },
  phone:        { type: String, trim: true },
  logo:         String,
  role:         { type: String, enum: ['vendor', 'vendor-manager', 'vendor-staff'], default: 'vendor' },
  isActive:     { type: Boolean, default: true },
  isBlocked:    { type: Boolean, default: false },
  isEmailVerified: { type: Boolean, default: false },

  subscription: {
    tier: { type: String, enum: ['free', 'starter', 'pro', 'enterprise'], default: 'free' },
    status: { type: String, enum: ['active', 'past_due', 'cancelled', 'trialing'], default: 'active' },
    venueLimit: { type: Number, default: 1 },
    startedAt: { type: Date, default: Date.now },
    expiresAt: Date,
  },
  billing: {
    stripeCustomerId: String,
    cardLast4: String,
    billingEmail: String,
  },
  notificationPrefs: {
    bookings:   { type: Boolean, default: true },
    reviews:    { type: Boolean, default: true },
    promotions: { type: Boolean, default: true },
    payments:   { type: Boolean, default: true },
    email:      { type: Boolean, default: true },
    push:       { type: Boolean, default: true },
  },
  team: [teamMemberSchema],
  lastLoginAt: Date,
}, { timestamps: true });

vendorSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

vendorSchema.methods.comparePassword = function(pw) {
  return bcrypt.compare(pw, this.password);
};

module.exports = mongoose.model('Vendor', vendorSchema);
