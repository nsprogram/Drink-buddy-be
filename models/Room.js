const mongoose = require('mongoose');

// Generate 6-char alphanumeric code
const generateJoinCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
};

const drinkSelectionSchema = new mongoose.Schema({
  drinkType: { type: String, enum: ['beer', 'wine', 'whiskey', 'vodka', 'rum', 'tequila', 'gin', 'cocktail', 'mocktail', 'other'], default: 'other' },
  brandName: { type: String, default: '', maxlength: 100 },
  quantity: { type: Number, default: 1 },
  isReady: { type: Boolean, default: false },
}, { _id: false });

const roomSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 50 },
  creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  size: { type: String, enum: ['small', 'medium', 'large'], required: true },
  isPrivate: { type: Boolean, default: false },
  joinCode: { type: String, unique: true, sparse: true },

  members: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    role: { type: String, enum: ['host', 'member'], default: 'member' },
    joinedAt: { type: Date, default: Date.now },
    drinkSelection: drinkSelectionSchema,
  }],

  // Join requests for public rooms
  joinRequests: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    message: { type: String, default: '', maxlength: 200 },
    status: { type: String, enum: ['pending', 'accepted', 'denied'], default: 'pending' },
    requestedAt: { type: Date, default: Date.now },
  }],

  // Session state
  sessionStatus: { type: String, enum: ['lobby', 'active', 'ended'], default: 'lobby' },
  sessionStartedAt: { type: Date },
  sessionEndedAt: { type: Date },

  // Room chat messages
  chatMessages: [{
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    message: { type: String, maxlength: 500 },
    type: { type: String, enum: ['text', 'system', 'cheers', 'reaction'], default: 'text' },
    sentAt: { type: Date, default: Date.now },
  }],

  // Safety warnings
  safetyWarnings: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    type: { type: String, enum: ['slow_down', 'hydrate', 'limit_reached'] },
    sentAt: { type: Date, default: Date.now },
  }],

  isActive: { type: Boolean, default: true },
  maxMembers: { type: Number, default: 6 },
  description: { type: String, default: '', maxlength: 200 },
  category: { type: String, enum: ['party', 'chill', 'tasting', 'dating', 'other'], default: 'other' },
  coverImage: { type: String, default: '' },
  isVoiceRoom: { type: Boolean, default: false },
}, { timestamps: true });

// Auto-generate join code before save
roomSchema.pre('save', async function (next) {
  if (this.isNew && !this.joinCode) {
    let code, exists;
    let attempts = 0;
    do {
      code = generateJoinCode();
      exists = await mongoose.model('Room').findOne({ joinCode: code });
      attempts++;
    } while (exists && attempts < 10);
    this.joinCode = code;
  }
  next();
});

roomSchema.index({ creator: 1 });
roomSchema.index({ isActive: 1 });
roomSchema.index({ 'members.user': 1 });
roomSchema.index({ sessionStatus: 1 });

module.exports = mongoose.model('Room', roomSchema);
