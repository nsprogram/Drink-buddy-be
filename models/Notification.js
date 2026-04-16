const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: {
    type: String,
    enum: ['welcome', 'friend_request', 'friend_accepted', 'message', 'like', 'achievement', 'bar_trending', 'session_reminder', 'session_complete', 'story', 'system'],
    required: true,
  },
  title: { type: String, required: true, maxlength: 200 },
  body: { type: String, required: true, maxlength: 500 },
  data: { type: mongoose.Schema.Types.Mixed, default: {} },
  read: { type: Boolean, default: false },
  readAt: { type: Date },
}, { timestamps: true });

notificationSchema.index({ user: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
