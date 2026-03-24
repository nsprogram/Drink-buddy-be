const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: {
    type: String,
    required: function () { return this.type === 'text'; }
  },
  type: { type: String, enum: ['text', 'image', 'voice', 'video'], default: 'text' },
  imageUri: {
    type: String,
    required: function () { return this.type === 'image'; }
  },
  voiceUri: {
    type: String,
    required: function () { return this.type === 'voice'; }
  },
  voiceDuration: { type: Number, default: 0 },
  videoUri: {
    type: String,
    required: function () { return this.type === 'video'; }
  },
  videoDuration: { type: Number, default: 0 },
  videoThumbnail: { type: String, default: null },
  replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
  replyText: { type: String, default: null },
  replySender: { type: String, default: null },
  reactions: { type: Map, of: [mongoose.Schema.Types.ObjectId], default: new Map() },
  isEdited: { type: Boolean, default: false },
  editedAt: { type: Date, default: null },
  originalContent: { type: String, default: null },
  isRead: { type: Boolean, default: false },
  readAt: { type: Date },
  timestamp: { type: Date, default: Date.now }
}, { timestamps: true });

messageSchema.index({ sender: 1, recipient: 1, createdAt: -1 });
messageSchema.index({ recipient: 1, isRead: 1 });

module.exports = mongoose.model('Message', messageSchema);
