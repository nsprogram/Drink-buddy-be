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
  // Authentication
  email:    { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  password: { type: String, required: true, select: false },
  
  // Business Information (PRD Section 9.1)
  businessName: { type: String, required: true, trim: true, index: true },
  legalName:    { type: String, trim: true }, // PRD: Legal business name
  vendorType: { 
    type: String, 
    enum: ['bar', 'hotel', 'restaurant', 'lounge', 'club', 'pub', 'cafe', 'event_venue', 'other'],
    default: 'bar'
  }, // PRD: Vendor type enum
  ownerName:    { type: String, trim: true },
  phone:        { type: String, trim: true },
  
  // Media
  logo:         String,
  logoUrl:      String, // PRD: logoUrl
  coverUrl:     String, // PRD: coverUrl
  gallery:      [String], // PRD: gallery array
  
  // Address with Geo (PRD Section 9.1)
  address: {
    line1: String,
    line2: String,
    city: String,
    state: String,
    country: String,
    postalCode: String,
    geo: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [0, 0] } // [longitude, latitude]
    }
  },
  
  // Business Details
  description: { type: String, maxlength: 2000 },
  
  // Documents for Verification (PRD Section 9.1)
  documents: [{
    type: { 
      type: String, 
      enum: ['business_registration', 'owner_id', 'venue_license', 'tax_document', 'proof_of_address', 'insurance', 'venue_image_1', 'venue_image_2', 'venue_image_3', 'venue_image_4', 'venue_image_5', 'other'],
      required: true
    },
    url: { type: String, required: true },
    status: { 
      type: String, 
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    rejectionReason: String,
    uploadedAt: { type: Date, default: Date.now }
  }],
  
  // Operating Hours (PRD Section 9.1)
  hours: [{
    day: { 
      type: String, 
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
      required: true
    },
    open: String,  // "09:00"
    close: String, // "23:00"
    isClosed: { type: Boolean, default: false }
  }],
  
  // Status & Verification (PRD Section 8)
  status: {
    type: String,
    enum: ['draft', 'submitted', 'under_review', 'approved', 'rejected', 'suspended', 'inactive'],
    default: 'draft',
    index: true
  },
  rejectionReason: String, // PRD: Rejection reason

  // Two-stage approval (Stage 1: basic info, Stage 2: KYC)
  basicInfoStatus: {
    type: String,
    enum: ['not_submitted', 'basic_pending', 'basic_approved', 'basic_rejected'],
    default: 'not_submitted',
    index: true
  },
  basicInfoRejectionReason: String,
  basicInfoSubmittedAt: Date,
  basicInfoReviewedAt: Date,
  kycStatus: {
    type: String,
    enum: ['not_submitted', 'kyc_pending', 'kyc_approved', 'kyc_rejected'],
    default: 'not_submitted',
    index: true
  },
  kycRejectionReason: String,
  kycSubmittedAt: Date,
  kycReviewedAt: Date,

  // Flags
  role:         { type: String, enum: ['vendor', 'vendor-manager', 'vendor-staff'], default: 'vendor' },
  isActive:     { type: Boolean, default: true },
  isBlocked:    { type: Boolean, default: false },
  isEmailVerified: { type: Boolean, default: false },
  isVerified:      { type: Boolean, default: false }, // PRD: isVerified flag
  emailVerifiedAt: Date,
  
  // Analytics & Engagement (PRD Section 9.1)
  ratingAvg: { type: Number, default: 0, min: 0, max: 5 },
  totalViews: { type: Number, default: 0 },
  totalFavorites: { type: Number, default: 0 },

  // OTP for Email Verification
  emailOtp:        { type: String, select: false },
  emailOtpExpires: { type: Date,   select: false },
  otpLastSentAt:   { type: Date,   select: false },

  // OTP for Password Reset
  resetOtp:         { type: String, select: false },
  resetOtpExpires:  { type: Date,   select: false },
  resetOtpLastSentAt: { type: Date, select: false },

  // Subscription
  subscription: {
    tier: { type: String, enum: ['free', 'starter', 'pro', 'enterprise'], default: 'free' },
    status: { type: String, enum: ['active', 'past_due', 'cancelled', 'trialing'], default: 'active' },
    venueLimit: { type: Number, default: 1 },
    startedAt: { type: Date, default: Date.now },
    expiresAt: Date,
  },
  
  // Billing
  billing: {
    stripeCustomerId: String,
    cardLast4: String,
    billingEmail: String,
  },
  
  // Notification Preferences
  notificationPrefs: {
    bookings:   { type: Boolean, default: true },
    reviews:    { type: Boolean, default: true },
    promotions: { type: Boolean, default: true },
    payments:   { type: Boolean, default: true },
    email:      { type: Boolean, default: true },
    push:       { type: Boolean, default: true },
  },
  
  // Team Management
  team: [teamMemberSchema],

  // In-app notifications (embedded)
  notifications: [{
    type: { type: String, default: 'info' },
    title: String,
    message: String,
    link: String,
    meta: mongoose.Schema.Types.Mixed,
    read: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  }],

  // Audit log for profile/compliance changes
  auditLog: [{
    action: String,
    field: String,
    before: mongoose.Schema.Types.Mixed,
    after: mongoose.Schema.Types.Mixed,
    actorEmail: String,
    at: { type: Date, default: Date.now },
  }],

  // Terms/compliance acceptance
  termsAccepted: {
    accepted: { type: Boolean, default: false },
    acceptedAt: Date,
    version: String,
    ipAddress: String,
  },

  // Metadata
  lastLoginAt: Date,
  deletedAt: Date, // PRD: Soft delete support
}, { timestamps: true });

vendorSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

vendorSchema.methods.comparePassword = function(pw) {
  return bcrypt.compare(pw, this.password);
};

// Soft delete method (PRD Section 15)
vendorSchema.methods.softDelete = function() {
  this.deletedAt = new Date();
  this.isActive = false;
  this.status = 'inactive';
  return this.save();
};

// Indexes for performance (PRD Section 9.1)
vendorSchema.index({ 'address.geo': '2dsphere' });
vendorSchema.index({ businessName: 'text', description: 'text' });
vendorSchema.index({ status: 1, isActive: 1 });

module.exports = mongoose.model('Vendor', vendorSchema);
