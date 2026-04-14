const DrinkingSession = require('../models/DrinkingSession');
const User = require('../models/User');

// Minimum seconds between drinks
const DRINK_GAP_SECONDS = 120;

class SessionController {

  // ── Start a new session ──
  static async startSession(req, res) {
    try {
      const userId = req.user._id;
      const { alcoholType, alcoholName, drinkLimit } = req.body;

      // Prevent multiple active sessions
      const existing = await DrinkingSession.findOne({ user: userId, status: 'active' });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'You already have an active session',
          data: { session: existing },
        });
      }

      const session = new DrinkingSession({
        user: userId,
        startTime: new Date(),
        status: 'active',
        drinkCount: 0,
        drinkLog: [],
        alcoholType: alcoholType || 'Unknown',
        alcoholName: alcoholName || '',
        drinkLimit: Math.max(0, parseInt(drinkLimit) || 0),
      });

      await session.save();
      res.status(201).json({ success: true, message: 'Session started', data: { session } });
    } catch (error) {
      console.error('Start session error:', error);
      res.status(500).json({ success: false, message: 'Failed to start session' });
    }
  }

  // ── Get active session ──
  static async getActiveSession(req, res) {
    try {
      const userId = req.user._id;
      const session = await DrinkingSession.findOne({ user: userId, status: 'active' });
      if (!session) {
        return res.status(404).json({ success: false, message: 'No active session' });
      }
      res.json({ success: true, data: { session } });
    } catch (error) {
      console.error('Get active session error:', error);
      res.status(500).json({ success: false, message: 'Failed to get session' });
    }
  }

  // ── Add a drink (increment-only, time-gap enforced) ──
  static async addDrink(req, res) {
    try {
      const userId = req.user._id;
      const { sessionId } = req.params;

      const session = await DrinkingSession.findOne({ _id: sessionId, user: userId, status: 'active' });
      if (!session) {
        return res.status(404).json({ success: false, message: 'Active session not found' });
      }

      // Enforce 2-minute gap between drinks
      const now = new Date();
      if (session.lastDrinkAt) {
        const elapsed = (now - session.lastDrinkAt) / 1000;
        if (elapsed < DRINK_GAP_SECONDS) {
          const remaining = Math.ceil(DRINK_GAP_SECONDS - elapsed);
          return res.status(429).json({
            success: false,
            message: 'Please wait before adding another drink.',
            data: { remainingSeconds: remaining, nextAllowedAt: new Date(session.lastDrinkAt.getTime() + DRINK_GAP_SECONDS * 1000) },
          });
        }
      }

      // Increment drink count (append-only — no decrease allowed)
      const newCount = session.drinkCount + 1;
      session.drinkCount = newCount;
      session.lastDrinkAt = now;
      session.drinkLog.push({ count: newCount, addedAt: now });
      await session.save();

      // Determine zone
      const zone = SessionController._getZone(newCount, session.drinkLimit);

      res.json({
        success: true,
        message: 'Drink added',
        data: {
          session,
          drinkCount: newCount,
          zone,
          lastDrinkAt: now,
        },
      });
    } catch (error) {
      console.error('Add drink error:', error);
      res.status(500).json({ success: false, message: 'Failed to add drink' });
    }
  }

  // ── End session ──
  static async endSession(req, res) {
    try {
      const userId = req.user._id;
      const { sessionId } = req.params;

      const session = await DrinkingSession.findOne({ _id: sessionId, user: userId, status: 'active' });
      if (!session) {
        return res.status(404).json({ success: false, message: 'Active session not found' });
      }

      const now = new Date();
      session.status = 'ended';
      session.endTime = now;
      session.duration = Math.round((now - session.startTime) / 60000);
      await session.save();

      res.json({ success: true, message: 'Session ended', data: { session } });
    } catch (error) {
      console.error('End session error:', error);
      res.status(500).json({ success: false, message: 'Failed to end session' });
    }
  }

  // ── Finalize session (save rating + notes after ending) ──
  static async finalizeSession(req, res) {
    try {
      const userId = req.user._id;
      const { sessionId } = req.params;
      const { rating, experience, notes, theme, location, participants } = req.body;

      const session = await DrinkingSession.findOne({ _id: sessionId, user: userId, status: 'ended' });
      if (!session) {
        return res.status(404).json({ success: false, message: 'Ended session not found' });
      }

      if (rating) session.rating = rating;
      if (experience) session.experience = experience;
      if (notes !== undefined) session.notes = notes.trim().substring(0, 500);
      if (theme !== undefined) session.theme = theme.trim();
      if (location !== undefined) session.location = location.trim();
      if (Array.isArray(participants)) session.participants = participants.map(p => String(p).trim()).filter(Boolean);

      await session.save();

      // Update user stats
      await User.findByIdAndUpdate(userId, {
        $inc: { 'drinkingStats.totalSessions': 1, 'drinkingStats.totalDrinks': session.drinkCount },
        $set: { 'drinkingStats.lastSession': session.endTime, 'drinkingStats.favoriteAlcohol': session.alcoholType },
      }, { runValidators: false });

      res.json({ success: true, message: 'Session saved', data: { session } });
    } catch (error) {
      console.error('Finalize session error:', error);
      res.status(500).json({ success: false, message: 'Failed to finalize session' });
    }
  }

  // ── Edit completed session (ONLY editable fields) ──
  static async editSession(req, res) {
    try {
      const userId = req.user._id;
      const { sessionId } = req.params;
      const { theme, location, participants } = req.body;

      const session = await DrinkingSession.findOne({ _id: sessionId, user: userId, status: 'ended' });
      if (!session) {
        return res.status(404).json({ success: false, message: 'Session not found' });
      }

      // STRICTLY only allow these fields — reject anything else
      const updates = {};
      if (theme !== undefined) updates.theme = theme.trim();
      if (location !== undefined) updates.location = location.trim();
      if (Array.isArray(participants)) updates.participants = participants.map(p => String(p).trim()).filter(Boolean);

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ success: false, message: 'No editable fields provided. Only theme, location, and participants can be edited.' });
      }

      await DrinkingSession.findByIdAndUpdate(sessionId, { $set: updates });
      const updated = await DrinkingSession.findById(sessionId);

      res.json({ success: true, message: 'Session updated', data: { session: updated } });
    } catch (error) {
      console.error('Edit session error:', error);
      res.status(500).json({ success: false, message: 'Failed to edit session' });
    }
  }

  // ── Legacy save (backwards compat for old clients) ──
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
        status: 'ended',
        drinkCount,
        alcoholType: alcoholType || 'Unknown',
        alcoholName: alcoholName || '',
        duration: parseInt(duration) || 0,
        notes,
        rating,
        experience,
      });

      await session.save();

      await User.findByIdAndUpdate(userId, {
        $inc: { 'drinkingStats.totalSessions': 1, 'drinkingStats.totalDrinks': drinkCount },
        $set: { 'drinkingStats.lastSession': endTime, 'drinkingStats.favoriteAlcohol': alcoholType || 'Unknown' },
      }, { runValidators: false });

      res.status(201).json({ success: true, message: 'Session saved successfully', data: session });
    } catch (error) {
      console.error('ERROR saving session:', error);
      res.status(500).json({ success: false, message: 'Failed to save session' });
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
        pagination: { current: parseInt(page), pages: Math.ceil(total / limit), total },
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

      await User.findByIdAndUpdate(userId, {
        $inc: { 'drinkingStats.totalSessions': -1, 'drinkingStats.totalDrinks': -session.drinkCount },
      });

      res.json({ success: true, message: 'Session deleted successfully' });
    } catch (error) {
      console.error('Error deleting session:', error);
      res.status(500).json({ success: false, message: 'Failed to delete session' });
    }
  }

  // ── Helper: compute zone based on count and limit ──
  static _getZone(count, limit) {
    if (limit && limit > 0) {
      const pct = count / limit;
      if (pct <= 0.5) return 'green';
      if (pct <= 0.8) return 'yellow';
      return 'red';
    }
    // Default thresholds
    if (count <= 3) return 'green';
    if (count <= 6) return 'yellow';
    return 'red';
  }
}

module.exports = SessionController;
