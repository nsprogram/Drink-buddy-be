const DrinkingSession = require('../models/DrinkingSession');
const User = require('../models/User');

class SessionController {
  static async saveSession(req, res) {
    try {
      const { startTime, endTime, drinkCount, alcoholType, alcoholName, duration, notes, rating, experience } = req.body;
      const userId = req.user._id || req.user.id;

      if (!startTime || !endTime || drinkCount === undefined) {
        return res.status(400).json({ success: false, message: 'Missing required session fields: startTime, endTime, or drinkCount' });
      }

      const session = new DrinkingSession({
        user: userId,
        startTime,
        endTime,
        drinkCount,
        alcoholType: alcoholType || 'Unknown',
        alcoholName: alcoholName || '',
        duration,
        notes,
        rating,
        experience
      });

      await session.save();

      await User.findByIdAndUpdate(userId, {
        $inc: { 'drinkingStats.totalSessions': 1, 'drinkingStats.totalDrinks': drinkCount },
        $set: { 'drinkingStats.lastSession': endTime, 'drinkingStats.favoriteAlcohol': alcoholType || 'Unknown' }
      }, { new: true, runValidators: false });

      res.status(201).json({ success: true, message: 'Session saved successfully', data: session });
    } catch (error) {
      console.error('ERROR saving session:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to save session',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  static async getSessionHistory(req, res) {
    try {
      const userId = req.user._id || req.user.id;
      const { limit = 20, page = 1 } = req.query;
      const skip = (page - 1) * limit;

      const sessions = await DrinkingSession.find({ user: userId })
        .sort({ startTime: -1 })
        .skip(parseInt(skip))
        .limit(parseInt(limit));

      const total = await DrinkingSession.countDocuments({ user: userId });

      res.json({
        success: true,
        data: sessions,
        pagination: { current: parseInt(page), pages: Math.ceil(total / limit), total }
      });
    } catch (error) {
      console.error('Error fetching session history:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch session history' });
    }
  }

  static async deleteSession(req, res) {
    try {
      const { sessionId } = req.params;
      const userId = req.user._id || req.user.id;

      const session = await DrinkingSession.findOne({ _id: sessionId, user: userId });
      if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

      await DrinkingSession.findByIdAndDelete(sessionId);

      // Update stats
      await User.findByIdAndUpdate(userId, {
        $inc: { 'drinkingStats.totalSessions': -1, 'drinkingStats.totalDrinks': -session.drinkCount }
      });

      res.json({ success: true, message: 'Session deleted successfully' });
    } catch (error) {
      console.error('Error deleting session:', error);
      res.status(500).json({ success: false, message: 'Failed to delete session' });
    }
  }
}

module.exports = SessionController;
