const mongoose = require('mongoose');

const drinkEntrySchema = new mongoose.Schema({
  count: { type: Number, required: true, min: 1 },
  addedAt: { type: Date, required: true, default: Date.now },
}, { _id: false });

const drinkingSessionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  // Session lifecycle
  status: {
    type: String,
    enum: ['active', 'ended'],
    default: 'active',
  },
  startTime: {
    type: Date,
    required: true,
  },
  endTime: {
    type: Date,
    default: null,
  },
  // Drink tracking — append-only log
  drinkCount: {
    type: Number,
    required: true,
    min: 0,
    default: 0,
  },
  drinkLog: {
    type: [drinkEntrySchema],
    default: [],
  },
  lastDrinkAt: {
    type: Date,
    default: null,
  },
  // Drink limit (user-customizable per session)
  drinkLimit: {
    type: Number,
    default: 0, // 0 = no limit
    min: 0,
  },
  // Drink info
  alcoholType: {
    type: String,
    default: 'Unknown',
  },
  alcoholName: {
    type: String,
    default: '',
  },
  // Duration in minutes
  duration: {
    type: Number,
    default: 0,
  },
  // Post-session rating
  rating: {
    type: Number,
    min: 1,
    max: 5,
  },
  experience: {
    type: String,
    enum: ['Great', 'Good', 'Okay', 'Bad', 'Terrible'],
    default: 'Good',
  },
  notes: {
    type: String,
    maxlength: 500,
  },
  // Editable-after-session fields
  theme: {
    type: String,
    default: '',
  },
  location: {
    type: String,
    default: '',
  },
  participants: [{
    type: String, // names or user references
  }],
}, {
  timestamps: true,
});

drinkingSessionSchema.index({ user: 1, startTime: -1 });
drinkingSessionSchema.index({ user: 1, status: 1 });

module.exports = mongoose.model('DrinkingSession', drinkingSessionSchema);
