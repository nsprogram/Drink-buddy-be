const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true, maxlength: 60 },
  description: { type: String, default: '', maxlength: 250 },
  image:       { type: String, default: null },
  imagePublicId: { type: String, default: null },
  members: [
    {
      user:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      role:    { type: String, enum: ['admin', 'member'], default: 'member' },
      joinedAt:{ type: Date, default: Date.now },
    }
  ],
  createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  lastMessage: { type: String, default: null },
  lastMessageAt: { type: Date, default: null },
}, { timestamps: true });

groupSchema.index({ 'members.user': 1, updatedAt: -1 });

module.exports = mongoose.model('Group', groupSchema);
