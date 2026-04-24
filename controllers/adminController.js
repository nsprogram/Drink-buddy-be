const User = require('../models/User');
const Message = require('../models/Message');
const DrinkingSession = require('../models/DrinkingSession');
const Room = require('../models/Room');
const Call = require('../models/Call');
const Notification = require('../models/Notification');
const Favorite = require('../models/Favorite');

// ── Helper: build date filter ──
function dateFilter(range) {
  if (!range) return {};
  const now = new Date();
  const map = {
    today: new Date(now.setHours(0, 0, 0, 0)),
    week: new Date(Date.now() - 7 * 86400000),
    month: new Date(Date.now() - 30 * 86400000),
    year: new Date(Date.now() - 365 * 86400000),
  };
  return map[range] ? { $gte: map[range] } : {};
}

// ═══════════════════════════════════════
//  DASHBOARD ANALYTICS
// ═══════════════════════════════════════
exports.getDashboard = async (req, res) => {
  try {
    const now = new Date();
    const today = new Date(now); today.setHours(0, 0, 0, 0);
    const weekAgo = new Date(Date.now() - 7 * 86400000);
    const monthAgo = new Date(Date.now() - 30 * 86400000);

    const [
      totalUsers, newUsersToday, newUsersWeek, activeUsersToday,
      totalSessions, activeSessions, sessionsToday,
      totalMessages, messagesToday,
      totalRooms, activeRooms,
      totalCalls, callsToday,
      onlineUsers, blockedUsers, unverifiedUsers,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ createdAt: { $gte: today } }),
      User.countDocuments({ createdAt: { $gte: weekAgo } }),
      User.countDocuments({ lastLogin: { $gte: today } }),
      DrinkingSession.countDocuments(),
      DrinkingSession.countDocuments({ status: 'active' }),
      DrinkingSession.countDocuments({ createdAt: { $gte: today } }),
      Message.countDocuments(),
      Message.countDocuments({ createdAt: { $gte: today } }),
      Room.countDocuments(),
      Room.countDocuments({ isActive: true, sessionStatus: 'active' }),
      Call.countDocuments(),
      Call.countDocuments({ createdAt: { $gte: today } }),
      User.countDocuments({ isOnline: true }),
      User.countDocuments({ isBlocked: true }),
      User.countDocuments({ isEmailVerified: false }),
    ]);

    // Registration trend (last 7 days)
    const registrationTrend = await User.aggregate([
      { $match: { createdAt: { $gte: weekAgo } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    // Session trend (last 7 days)
    const sessionTrend = await DrinkingSession.aggregate([
      { $match: { createdAt: { $gte: weekAgo } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    // Top drink types
    const topDrinks = await DrinkingSession.aggregate([
      { $match: { alcoholType: { $ne: 'Unknown' } } },
      { $group: { _id: '$alcoholType', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]);

    // Average session stats
    const avgStats = await DrinkingSession.aggregate([
      { $match: { status: 'ended' } },
      { $group: {
        _id: null,
        avgDrinks: { $avg: '$drinkCount' },
        avgDuration: { $avg: '$duration' },
        avgRating: { $avg: '$rating' },
      }},
    ]);

    res.json({
      success: true,
      data: {
        users: { total: totalUsers, newToday: newUsersToday, newWeek: newUsersWeek, activeToday: activeUsersToday, online: onlineUsers, blocked: blockedUsers, unverified: unverifiedUsers },
        sessions: { total: totalSessions, active: activeSessions, today: sessionsToday, avg: avgStats[0] || {} },
        messages: { total: totalMessages, today: messagesToday },
        rooms: { total: totalRooms, active: activeRooms },
        calls: { total: totalCalls, today: callsToday },
        trends: { registrations: registrationTrend, sessions: sessionTrend },
        topDrinks,
      },
    });
  } catch (err) {
    console.error('Admin dashboard error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ═══════════════════════════════════════
//  USER MANAGEMENT
// ═══════════════════════════════════════
exports.getUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, status, sort = '-createdAt', role } = req.query;
    const filter = {};

    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ firstName: regex }, { lastName: regex }, { fullName: regex }, { email: regex }];
    }
    if (status === 'blocked') filter.isBlocked = true;
    if (status === 'active') { filter.isActive = true; filter.isBlocked = false; }
    if (status === 'unverified') filter.isEmailVerified = false;
    if (status === 'online') filter.isOnline = true;
    if (role) filter.role = role;

    const total = await User.countDocuments(filter);
    const users = await User.find(filter)
      .select('firstName lastName fullName email profileImage avatarEmoji avatarColor role isActive isBlocked isOnline isEmailVerified lastLogin createdAt drinkingStats interestTags')
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({ success: true, data: { users, total, page: Number(page), pages: Math.ceil(total / limit) } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getUserDetail = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password -emailVerificationToken -emailVerificationExpires -passwordResetToken -passwordResetExpires -refreshTokens')
      .populate('friends.user', 'firstName lastName email profileImage avatarEmoji');

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const [sessionCount, messageCount, callCount, roomCount] = await Promise.all([
      DrinkingSession.countDocuments({ user: user._id }),
      Message.countDocuments({ $or: [{ sender: user._id }, { recipient: user._id }] }),
      Call.countDocuments({ $or: [{ caller: user._id }, { receiver: user._id }] }),
      Room.countDocuments({ 'members.user': user._id }),
    ]);

    const recentSessions = await DrinkingSession.find({ user: user._id }).sort('-startTime').limit(5).lean();

    res.json({ success: true, data: { user, stats: { sessionCount, messageCount, callCount, roomCount }, recentSessions } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { isBlocked, blockedReason, isActive, role } = req.body;
    const update = {};
    if (typeof isBlocked === 'boolean') { update.isBlocked = isBlocked; update.blockedReason = isBlocked ? (blockedReason || 'Blocked by admin') : ''; }
    if (typeof isActive === 'boolean') update.isActive = isActive;
    if (role && ['user', 'admin'].includes(role)) update.role = role;

    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true })
      .select('firstName lastName email role isBlocked isActive');

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const userId = req.params.id;
    await Promise.all([
      Message.deleteMany({ $or: [{ sender: userId }, { recipient: userId }] }),
      DrinkingSession.deleteMany({ user: userId }),
      Notification.deleteMany({ user: userId }),
      Favorite.deleteMany({ user: userId }),
      Call.deleteMany({ $or: [{ caller: userId }, { receiver: userId }] }),
    ]);
    await User.findByIdAndDelete(userId);
    res.json({ success: true, message: 'User and all related data deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ═══════════════════════════════════════
//  SESSION MANAGEMENT
// ═══════════════════════════════════════
exports.getSessions = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, sort = '-startTime' } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const total = await DrinkingSession.countDocuments(filter);
    const sessions = await DrinkingSession.find(filter)
      .populate('user', 'firstName lastName email avatarEmoji')
      .sort(sort).skip((page - 1) * limit).limit(Number(limit));

    res.json({ success: true, data: { sessions, total, page: Number(page), pages: Math.ceil(total / limit) } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getSessionDetail = async (req, res) => {
  try {
    const session = await DrinkingSession.findById(req.params.id).populate('user', 'firstName lastName email avatarEmoji avatarColor profileImage');
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    res.json({ success: true, data: session });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteSession = async (req, res) => {
  try {
    await DrinkingSession.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Session deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ═══════════════════════════════════════
//  ROOM MANAGEMENT
// ═══════════════════════════════════════
exports.getRooms = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, sort = '-createdAt' } = req.query;
    const filter = {};
    if (status === 'active') { filter.isActive = true; filter.sessionStatus = 'active'; }
    if (status === 'lobby') { filter.isActive = true; filter.sessionStatus = 'lobby'; }
    if (status === 'ended') filter.sessionStatus = 'ended';

    const total = await Room.countDocuments(filter);
    const rooms = await Room.find(filter)
      .populate('creator', 'firstName lastName email')
      .populate('members.user', 'firstName lastName avatarEmoji')
      .sort(sort).skip((page - 1) * limit).limit(Number(limit));

    res.json({ success: true, data: { rooms, total, page: Number(page), pages: Math.ceil(total / limit) } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getRoomDetail = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id)
      .populate('creator', 'firstName lastName email avatarEmoji avatarColor profileImage')
      .populate('members.user', 'firstName lastName email avatarEmoji avatarColor profileImage isOnline')
      .populate('joinRequests.user', 'firstName lastName email avatarEmoji')
      .populate('chatMessages.sender', 'firstName lastName avatarEmoji');
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    res.json({ success: true, data: room });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteRoom = async (req, res) => {
  try {
    await Room.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Room deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ═══════════════════════════════════════
//  CHAT / MESSAGES OVERVIEW
// ═══════════════════════════════════════
exports.getMessages = async (req, res) => {
  try {
    const { page = 1, limit = 50, type, sort = '-createdAt' } = req.query;
    const filter = {};
    if (type) filter.type = type;

    const total = await Message.countDocuments(filter);
    const messages = await Message.find(filter)
      .populate('sender', 'firstName lastName email')
      .populate('recipient', 'firstName lastName email')
      .sort(sort).skip((page - 1) * limit).limit(Number(limit));

    res.json({ success: true, data: { messages, total, page: Number(page), pages: Math.ceil(total / limit) } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteMessage = async (req, res) => {
  try {
    await Message.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Message deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ═══════════════════════════════════════
//  NOTIFICATIONS (SYSTEM-WIDE)
// ═══════════════════════════════════════
exports.sendSystemNotification = async (req, res) => {
  try {
    const { title, body, targetAll, userIds } = req.body;
    if (!title || !body) return res.status(400).json({ success: false, message: 'Title and body required' });

    let targets = [];
    if (targetAll) {
      targets = await User.find({ isActive: true }).select('_id');
    } else if (userIds && userIds.length) {
      targets = userIds.map(id => ({ _id: id }));
    } else {
      return res.status(400).json({ success: false, message: 'Specify targetAll or userIds' });
    }

    const notifications = targets.map(u => ({
      user: u._id, type: 'system', title, body, data: { fromAdmin: true },
    }));

    await Notification.insertMany(notifications);

    // Emit via socket if available
    const io = req.app.get('io');
    if (io) {
      targets.forEach(u => io.to(u._id.toString()).emit('notification', { type: 'system', title, body }));
    }

    res.json({ success: true, message: `Sent to ${targets.length} users` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ═══════════════════════════════════════
//  CHATBOT TRAINING DATA
// ═══════════════════════════════════════
exports.getChatbotQueries = async (req, res) => {
  try {
    // Model is registered inside chatbotController — make sure it's loaded, then reuse
    require('./chatbotController');
    const mongoose = require('mongoose');
    const UnmatchedQuery = mongoose.model('UnmatchedQuery');
    const { page = 1, limit = 30, source } = req.query;
    const filter = {};
    if (source) filter.source = source;

    const total = await UnmatchedQuery.countDocuments(filter);
    const queries = await UnmatchedQuery.find(filter)
      .populate('user', 'firstName lastName email')
      .sort('-createdAt').skip((page - 1) * limit).limit(Number(limit));

    res.json({ success: true, data: { queries, total, page: Number(page), pages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error('getChatbotQueries error:', err);
    // Fall back to empty list so admin UI doesn't crash
    res.json({ success: true, data: { queries: [], total: 0, page: 1, pages: 0 } });
  }
};

// ═══════════════════════════════════════
//  CALL HISTORY
// ═══════════════════════════════════════
exports.getCalls = async (req, res) => {
  try {
    const { page = 1, limit = 30, type, status, sort = '-createdAt' } = req.query;
    const filter = {};
    if (type) filter.type = type;
    if (status) filter.status = status;

    const total = await Call.countDocuments(filter);
    const calls = await Call.find(filter)
      .populate('caller', 'firstName lastName email')
      .populate('receiver', 'firstName lastName email')
      .sort(sort).skip((page - 1) * limit).limit(Number(limit));

    res.json({ success: true, data: { calls, total, page: Number(page), pages: Math.ceil(total / limit) } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ═══════════════════════════════════════
//  REPORTS
// ═══════════════════════════════════════
exports.getReports = async (req, res) => {
  try {
    const { range = 'month' } = req.query;
    const dateFloor = dateFilter(range);

    const filter = dateFloor.$gte ? { createdAt: dateFloor } : {};

    const [users, sessions, messages, calls, rooms] = await Promise.all([
      User.countDocuments(filter),
      DrinkingSession.countDocuments(filter),
      Message.countDocuments(filter),
      Call.countDocuments(filter),
      Room.countDocuments(filter),
    ]);

    // Top users by sessions
    const topUsers = await DrinkingSession.aggregate([
      ...(dateFloor.$gte ? [{ $match: { createdAt: dateFloor } }] : []),
      { $group: { _id: '$user', sessionCount: { $sum: 1 }, totalDrinks: { $sum: '$drinkCount' } } },
      { $sort: { sessionCount: -1 } },
      { $limit: 10 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: '$user' },
      { $project: { 'user.firstName': 1, 'user.lastName': 1, 'user.email': 1, sessionCount: 1, totalDrinks: 1 } },
    ]);

    // Messages by type
    const messagesByType = await Message.aggregate([
      ...(dateFloor.$gte ? [{ $match: { createdAt: dateFloor } }] : []),
      { $group: { _id: '$type', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    res.json({
      success: true,
      data: { range, totals: { users, sessions, messages, calls, rooms }, topUsers, messagesByType },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
