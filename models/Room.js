const mongoose = require('mongoose');

// Generate 6-char alphanumeric code
const generateJoinCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No O/0/1/I for clarity
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
};

const roomSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 50 },
  creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  size: { type: String, enum: ['small', 'medium', 'large'], required: true },
  isPrivate: { type: Boolean, default: false },
  joinCode: { type: String, unique: true, sparse: true },
  members: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    role: { type: String, enum: ['host', 'member'], default: 'member' },
    joinedAt: { type: Date, default: Date.now }
  }],
  isActive: { type: Boolean, default: true },
  maxMembers: { type: Number, default: 6 },
  description: { type: String, default: '', maxlength: 200 },
  category: { type: String, enum: ['party', 'chill', 'tasting', 'dating', 'other'], default: 'other' },
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
roomSchema.index({ joinCode: 1 });

module.exports = mongoose.model('Room', roomSchema);
