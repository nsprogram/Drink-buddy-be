const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  fullName: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    minlength: [8, 'Password must be at least 8 characters'],
    select: false
  },
  googleId: {
    type: String,
    sparse: true
  },
  dateOfBirth: {
    type: Date
  },
  age: {
    type: Number,
    min: [18, 'You must be at least 18 years old']
  },
  profileImage: {
    type: String,
    default: null
  },
  profileImagePublicId: {
    type: String,
    default: null
  },
  coverImage: {
    type: String,
    default: null
  },
  coverImagePublicId: {
    type: String,
    default: null
  },
  bio: {
    type: String,
    maxlength: [500, 'Bio cannot exceed 500 characters'],
    default: ''
  },
  location: {
    type: String,
    default: ''
  },
  // ── Emoji avatar (alternative to profileImage) ──
  avatarId: {
    type: String,
    default: null,
    maxlength: 32,
  },
  avatarEmoji: {
    type: String,
    default: null,
    maxlength: 8,
  },
  avatarColor: {
    type: String,
    default: null,
    maxlength: 16,
  },
  avatarName: {
    type: String,
    default: null,
    maxlength: 32,
  },
  // ── User-selected interest tags (shown on profile) ──
  interestTags: {
    type: [String],
    default: [],
    validate: [arr => arr.length <= 8, 'Max 8 interest tags'],
  },

  // ── Per-user feature permissions (admin-controlled) ──
  // All default to TRUE so existing users keep full access.
  permissions: {
    sessions:      { type: Boolean, default: true }, // Create own drinking sessions
    rooms:         { type: Boolean, default: true }, // Create rooms + invite friends
    bars:          { type: Boolean, default: true }, // Explore nearby bars/pubs
    vendors:       { type: Boolean, default: true }, // View vendor profiles, products, offers
    healthReport:  { type: Boolean, default: true }, // Health reports + tips
    chatbot:       { type: Boolean, default: true }, // DrinkBot AI help
    achievements:  { type: Boolean, default: true }, // Achievements/badges
    chat:          { type: Boolean, default: true }, // Realtime chat (DM + groups + calls)
  },
  // Permission tier label — quick way to mark a user (e.g. 'Type A', 'A-Back', 'Premium')
  permissionTier: {
    type: String,
    default: 'Type A',
    maxlength: 32,
  },
  // Free-form note for admins explaining why permissions were modified
  permissionNote: {
    type: String,
    default: '',
    maxlength: 500,
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: {
    type: String,
    select: false
  },
  emailVerificationExpires: {
    type: Date,
    select: false
  },
  passwordResetToken: {
    type: String,
    select: false
  },
  passwordResetExpires: {
    type: Date,
    select: false
  },
  passwordResetAttempts: {
    type: Number,
    default: 0,
    select: false
  },
  loginOTP: {
    code: { type: String },
    expires: { type: Date },
    attempts: { type: Number, default: 0 }
  },
  refreshTokens: [{
    token: { type: String },
    device: { type: String },
    createdAt: { type: Date, default: Date.now }
  }],
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date
  },
  lastLogin: {
    type: Date
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isBlocked: {
    type: Boolean,
    default: false
  },
  blockedReason: {
    type: String
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  friends: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined'],
      default: 'pending'
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  blockedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  isOnline: {
    type: Boolean,
    default: false
  },
  lastSeen: {
    type: Date
  },
  drinkingStats: {
    totalSessions: { type: Number, default: 0 },
    totalDrinks: { type: Number, default: 0 },
    favoriteAlcohol: { type: String, default: '' },
    lastSession: { type: Date },
    averageRating: { type: Number, default: 0 }
  },
  preferences: {
    drinkTypes: [{ type: String }],
    socialLevel: { type: String, default: 'Social' },
    notifications: {
      friendRequests: { type: Boolean, default: true },
      messages: { type: Boolean, default: true },
      sessions: { type: Boolean, default: true }
    }
  },
  privacySettings: {
    readReceipts: { type: Boolean, default: true },
    locationSharing: { type: Boolean, default: false },
  },
  stories: [{
    mediaUrl: { type: String },
    mediaType: { type: String, enum: ['image', 'video'] },
    publicId: { type: String },
    caption: { type: String },
    viewers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date }
  }]
}, {
  timestamps: true
});

// Virtual for isLocked
userSchema.virtual('isLocked').get(function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Pre-save: hash password
userSchema.pre('save', async function (next) {
  // Set fullName
  if (this.isModified('firstName') || this.isModified('lastName')) {
    this.fullName = `${this.firstName} ${this.lastName}`;
  }

  if (!this.isModified('password') || !this.password) return next();

  try {
    const rounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    this.password = await bcrypt.hash(this.password, rounds);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

// Increment login attempts
userSchema.methods.incLoginAttempts = async function () {
  const maxAttempts = parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5;
  const lockTime = parseInt(process.env.ACCOUNT_LOCK_TIME) || 7200000;

  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $set: { loginAttempts: 1 },
      $unset: { lockUntil: 1 }
    });
  }

  const updates = { $inc: { loginAttempts: 1 } };
  if (this.loginAttempts + 1 >= maxAttempts && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + lockTime };
  }

  return this.updateOne(updates);
};

// Reset login attempts
userSchema.methods.resetLoginAttempts = function () {
  return this.updateOne({
    $set: { loginAttempts: 0 },
    $unset: { lockUntil: 1 }
  });
};

// Indexes
userSchema.index({ 'friends.user': 1 });
userSchema.index({ firstName: 'text', lastName: 'text', bio: 'text' });

module.exports = mongoose.model('User', userSchema);
