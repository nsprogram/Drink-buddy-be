const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 50 },
  creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  size: { type: String, enum: ['small', 'medium', 'large'], required: true },
  isPrivate: { type: Boolean, default: false },
  members: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    role: { type: String, enum: ['host', 'member'], default: 'member' },
    joinedAt: { type: Date, default: Date.now }
  }],
  isActive: { type: Boolean, default: true },
  maxMembers: { type: Number, default: 6 },
}, { timestamps: true });

roomSchema.index({ creator: 1 });
roomSchema.index({ isActive: 1 });
roomSchema.index({ 'members.user': 1 });

module.exports = mongoose.model('Room', roomSchema);
