const mongoose = require('mongoose');

const funnyMessageSchema = new mongoose.Schema({
  message: {
    type: String,
    required: true,
    maxlength: 300,
  },
  emoji: {
    type: String,
    default: '🍺',
    maxlength: 10,
  },
  displayTime: {
    type: Number,
    default: 30, // seconds
    min: 3,
    max: 120,
  },
  triggerAfterDrinks: {
    type: Number,
    default: 1,
    min: 1,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  category: {
    type: String,
    // Keep legacy values + new spec values so existing data stays valid
    enum: ['motivational', 'funny', 'warning', 'health', 'party', 'tip', 'general'],
    default: 'funny',
  },
  priority: {
    type: Number,
    default: 1,
    min: 1,
    max: 10,
  },
  minDrinks: {
    type: Number,
    default: null,
  },
  maxDrinks: {
    type: Number,
    default: null,
  },
}, {
  timestamps: true,
});

funnyMessageSchema.index({ isActive: 1, priority: -1 });

module.exports = mongoose.model('FunnyMessage', funnyMessageSchema);
