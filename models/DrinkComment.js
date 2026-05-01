const mongoose = require('mongoose');

/**
 * DrinkComment — reviews/comments on individual drinks (TheCocktailDB id,
 * SampleAPI id, or any external string id). drinkId is a free-form string
 * because drinks aren't stored in our DB.
 */
const drinkCommentSchema = new mongoose.Schema({
  drinkId:    { type: String, required: true, index: true },
  drinkName:  String,
  drinkImage: String,

  user:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  authorName:  { type: String, required: true },
  authorAvatar: String,
  authorEmoji: { type: String, default: '🥂' },
  authorColor: { type: String, default: '#FF9F43' },

  rating:  { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, required: true, trim: true, maxlength: 1000 },

  likes: { type: Number, default: 0 },
  likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  flagged: { type: Boolean, default: false },
  visible: { type: Boolean, default: true },
}, { timestamps: true });

drinkCommentSchema.index({ drinkId: 1, createdAt: -1 });

module.exports = mongoose.model('DrinkComment', drinkCommentSchema);
