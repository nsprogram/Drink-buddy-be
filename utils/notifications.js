const Notification = require('../models/Notification');

// ── Shared Socket.io instance ──
// Set once at startup from server.js: `setIo(io)`
let _io = null;
function setIo(ioInstance) { _io = ioInstance; }

/**
 * Create a notification for a user AND emit it live via socket.io.
 * Returns the created notification document, or null on failure.
 */
async function createNotification(userId, type, title, body, data = {}) {
  try {
    const notif = await Notification.create({ user: userId, type, title, body, data });

    // Emit live to the user's personal socket room so the UI updates without refresh
    if (_io && notif) {
      try {
        _io.to(`user:${userId.toString()}`).emit('notification', notif.toObject ? notif.toObject() : notif);
      } catch (emitErr) {
        console.warn('[Notif] socket emit failed:', emitErr.message);
      }
    }
    return notif;
  } catch (err) {
    console.error('Failed to create notification:', err.message);
    return null;
  }
}

/**
 * Welcome notification sent to a new user on successful email verification.
 */
async function sendWelcomeNotification(userId, firstName) {
  return createNotification(
    userId,
    'welcome',
    'Welcome to Drink Buddy! 🍻',
    `Hey ${firstName}! Your account is ready. Track sessions, join rooms, and connect with friends. Cheers!`,
    { action: 'explore' }
  );
}

async function sendFriendRequestNotification(toUserId, fromUser) {
  return createNotification(
    toUserId,
    'friend_request',
    'New friend request',
    `${fromUser.firstName} ${fromUser.lastName} wants to connect with you`,
    { fromUserId: fromUser._id }
  );
}

async function sendFriendAcceptedNotification(toUserId, fromUser) {
  return createNotification(
    toUserId,
    'friend_accepted',
    'Friend request accepted',
    `${fromUser.firstName} ${fromUser.lastName} accepted your friend request`,
    { fromUserId: fromUser._id }
  );
}

async function sendMessageNotification(toUserId, fromUser, preview) {
  return createNotification(
    toUserId,
    'message',
    'New message',
    `${fromUser.firstName}: "${(preview || '').substring(0, 100)}"`,
    { fromUserId: fromUser._id }
  );
}

async function sendAchievementNotification(userId, achievementName) {
  return createNotification(
    userId,
    'achievement',
    'New achievement unlocked!',
    `You earned the "${achievementName}" badge`,
    { achievement: achievementName }
  );
}

async function sendSessionCompleteNotification(userId, roomName, duration, drinkCount) {
  const mins = duration || 0;
  const durationText = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
  return createNotification(
    userId,
    'session_complete',
    'Session Complete! 🎉',
    `Your session in "${roomName}" has ended. Duration: ${durationText}, Drinks: ${drinkCount || 0}`,
    { action: 'view_session_history', roomName }
  );
}

module.exports = {
  setIo,
  createNotification,
  sendWelcomeNotification,
  sendFriendRequestNotification,
  sendFriendAcceptedNotification,
  sendMessageNotification,
  sendAchievementNotification,
  sendSessionCompleteNotification,
};
