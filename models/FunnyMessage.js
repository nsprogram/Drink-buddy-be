const mongoose = require('mongoose');

const funnyMessageSchema = new mongoose.Schema({
  message: {
    type: String,
    required: true,
    maxlength: 200,
  },
  emoji: {
    type: String,
    default: '😄',
    maxlength: 10,
  },
  displayTime: {
    type: Number,
    default: 30, // seconds
    min: 5,
    max: 120,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  category: {
    type: String,
    enum: ['motivational', 'funny', 'warning', 'tip', 'general'],
    default: 'general',
  },
  priority: {
    type: Number,
    default: 1,
    min: 1,
    max: 10,
  },
}, {
  timestamps: true,
});

funnyMessageSchema.index({ isActive: 1, priority: -1 });

module.exports = mongoose.model('FunnyMessage', funnyMessageSchema);
