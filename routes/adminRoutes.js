const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const DrinkingSession = require('../models/DrinkingSession');
const Message = require('../models/Message');
const Notification = require('../models/Notification');
const Favorite = require('../models/Favorite');
const Room = require('../models/Room');

// Admin middleware
const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  next();
};

// ═══ DASHBOARD OVERVIEW ═══
router.get('/dashboard', protect, adminOnly, async (req, res) => {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // User stats
    const [totalUsers, activeUsers, blockedUsers, onlineUsers, newUsersToday, newUsersWeek, newUsersMonth] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isActive: true }),
      User.countDocuments({ isBlocked: true }),
      User.countDocuments({ isOnline: true }),
      User.countDocuments({ createdAt: { $gte: today } }),
      User.countDocuments({ createdAt: { $gte: thisWeek } }),
      User.countDocuments({ createdAt: { $gte: thisMonth } }),
    ]);

    // Session stats
    const [totalSessions, sessionsToday, sessionsWeek, totalDrinks] = await Promise.all([
      DrinkingSession.countDocuments(),
      DrinkingSession.countDocuments({ createdAt: { $gte: today } }),
      DrinkingSession.countDocuments({ createdAt: { $gte: thisWeek } }),
      DrinkingSession.aggregate([{ $group: { _id: null, total: { $sum: '$drinkCount' } } }]),
    ]);

    // Message stats
    const [totalMessages, messagesToday] = await Promise.all([
      Message.countDocuments(),
      Message.countDocuments({ createdAt: { $gte: today } }),
    ]);

    // Other stats
    const [totalFavorites, totalRooms, activeRooms, totalNotifications] = await Promise.all([
      Favorite.countDocuments(),
      Room.countDocuments(),
      Room.countDocuments({ isActive: true }),
      Notification.countDocuments(),
    ]);

    // Drink type distribution
    const drinkTypes = await DrinkingSession.aggregate([
      { $group: { _id: '$alcoholType', count: { $sum: 1 }, totalDrinks: { $sum: '$drinkCount' } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    // Rating distribution
    const ratings = await DrinkingSession.aggregate([
      { $match: { rating: { $exists: true, $gt: 0 } } },
      { $group: { _id: '$rating', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    // User growth (last 30 days)
    const userGrowth = await User.aggregate([
      { $match: { createdAt: { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    // Session activity (last 30 days)
    const sessionActivity = await DrinkingSession.aggregate([
      { $match: { createdAt: { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 }, drinks: { $sum: '$drinkCount' } } },
      { $sort: { _id: 1 } },
    ]);

    // Top users by sessions
    const topUsers = await DrinkingSession.aggregate([
      { $group: { _id: '$user', sessionCount: { $sum: 1 }, totalDrinks: { $sum: '$drinkCount' }, avgRating: { $avg: '$rating' } } },
      { $sort: { sessionCount: -1 } },
      { $limit: 10 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: '$user' },
      { $project: { sessionCount: 1, totalDrinks: 1, avgRating: 1, 'user.firstName': 1, 'user.lastName': 1, 'user.email': 1, 'user.profileImage': 1 } },
    ]);

    // Average session stats
    const avgStats = await DrinkingSession.aggregate([
      { $group: { _id: null, avgDrinks: { $avg: '$drinkCount' }, avgDuration: { $avg: { $toDouble: '$duration' } }, avgRating: { $avg: '$rating' } } },
    ]);

    res.json({
      success: true,
      data: {
        users: { total: totalUsers, active: activeUsers, blocked: blockedUsers, online: onlineUsers, newToday: newUsersToday, newWeek: newUsersWeek, newMonth: newUsersMonth },
        sessions: { total: totalSessions, today: sessionsToday, week: sessionsWeek, totalDrinks: totalDrinks[0]?.total || 0 },
        messages: { total: totalMessages, today: messagesToday },
        other: { favorites: totalFavorites, rooms: totalRooms, activeRooms, notifications: totalNotifications },
        charts: { drinkTypes, ratings, userGrowth, sessionActivity },
        topUsers,
        averages: avgStats[0] || { avgDrinks: 0, avgDuration: 0, avgRating: 0 },
      }
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({ success: false, message: 'Failed to load dashboard data' });
  }
});

// ═══ USER MANAGEMENT ═══
router.get('/users', protect, adminOnly, async (req, res) => {
  try {
    const { page = 1, limit = 20, search, status, sort = '-createdAt' } = req.query;
    const query = {};
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }
    if (status === 'blocked') query.isBlocked = true;
    if (status === 'active') query.isActive = true;
    if (status === 'online') query.isOnline = true;

    const [users, total] = await Promise.all([
      User.find(query).select('-password -refreshTokens -emailVerificationToken -passwordResetToken')
        .sort(sort).skip((page - 1) * limit).limit(Number(limit)),
      User.countDocuments(query),
    ]);

    res.json({ success: true, data: { users, total, page: Number(page), pages: Math.ceil(total / limit) } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load users' });
  }
});

// Block/Unblock user
router.put('/users/:userId/block', protect, adminOnly, async (req, res) => {
  try {
    const { reason } = req.body;
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    user.isBlocked = !user.isBlocked;
    user.blockedReason = user.isBlocked ? (reason || 'Blocked by admin') : '';
    await user.save();
    res.json({ success: true, message: `User ${user.isBlocked ? 'blocked' : 'unblocked'}`, data: { isBlocked: user.isBlocked } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update user' });
  }
});

// Delete user
router.delete('/users/:userId', protect, adminOnly, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.role === 'admin') return res.status(403).json({ success: false, message: 'Cannot delete admin' });

    await Promise.all([
      DrinkingSession.deleteMany({ user: user._id }),
      Message.deleteMany({ $or: [{ sender: user._id }, { recipient: user._id }] }),
      Notification.deleteMany({ user: user._id }),
      Favorite.deleteMany({ user: user._id }),
      User.findByIdAndDelete(user._id),
    ]);

    res.json({ success: true, message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete user' });
  }
});

// Make user admin
router.put('/users/:userId/role', protect, adminOnly, async (req, res) => {
  try {
    const { role } = req.body;
    if (!['user', 'admin'].includes(role)) return res.status(400).json({ success: false, message: 'Invalid role' });
    const user = await User.findByIdAndUpdate(req.params.userId, { role }, { new: true }).select('firstName lastName email role');
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update role' });
  }
});

// ═══ SESSION MANAGEMENT ═══
router.get('/sessions', protect, adminOnly, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const [sessions, total] = await Promise.all([
      DrinkingSession.find().populate('user', 'firstName lastName email profileImage')
        .sort('-createdAt').skip((page - 1) * limit).limit(Number(limit)),
      DrinkingSession.countDocuments(),
    ]);
    res.json({ success: true, data: { sessions, total, page: Number(page), pages: Math.ceil(total / limit) } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load sessions' });
  }
});

// ═══ SYSTEM ═══
router.get('/system', protect, adminOnly, async (req, res) => {
  try {
    const dbState = mongoose.connection.readyState;
    const dbStates = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
    res.json({
      success: true,
      data: {
        server: { uptime: process.uptime(), memory: process.memoryUsage(), nodeVersion: process.version, platform: process.platform },
        database: { status: dbStates[dbState], host: mongoose.connection.host, name: mongoose.connection.name },
        environment: process.env.NODE_ENV || 'development',
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load system info' });
  }
});

module.exports = router;
