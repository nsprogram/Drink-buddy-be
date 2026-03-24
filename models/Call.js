const mongoose = require('mongoose');

const callSchema = new mongoose.Schema({
  caller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['voice', 'video'], required: true },
  status: {
    type: String,
    enum: ['ringing', 'accepted', 'declined', 'missed', 'ended', 'busy'],
    default: 'ringing',
  },
  startedAt: { type: Date },
  endedAt: { type: Date },
  duration: { type: Number, default: 0 }, // seconds
}, { timestamps: true });

callSchema.index({ caller: 1, createdAt: -1 });
callSchema.index({ receiver: 1, createdAt: -1 });

module.exports = mongoose.model('Call', callSchema);
