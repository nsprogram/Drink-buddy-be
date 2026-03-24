const mongoose = require('mongoose');

const drinkingSessionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    startTime: {
        type: Date,
        required: true
    },
    endTime: {
        type: Date,
        required: true
    },
    drinkCount: {
        type: Number,
        required: true,
        min: 0
    },
    alcoholType: {
        type: String,
        default: 'Unknown'
    },
    alcoholName: {
        type: String,
        default: ''
    },
    duration: {
        type: String,
    },
    rating: {
        type: Number,
        min: 1,
        max: 5
    },
    experience: {
        type: String,
        enum: ['Great', 'Good', 'Okay', 'Bad', 'Terrible'],
        default: 'Good'
    },
    notes: {
        type: String,
        maxlength: 500
    }
}, {
    timestamps: true
});

drinkingSessionSchema.index({ user: 1, startTime: -1 });

module.exports = mongoose.model('DrinkingSession', drinkingSessionSchema);
