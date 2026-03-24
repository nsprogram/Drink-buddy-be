const Notification = require('../models/Notification');

/**
 * Create a notification for a user
 */
async function createNotification(userId, type, title, body, data = {}) {
  try {
    return await Notification.create({ user: userId, type, title, body, data });
  } catch (err) {
    console.error('Failed to create notification:', err.message);
    return null;
  }
}

/**
 * Send welcome notification to new user
 */
async function sendWelcomeNotification(userId, firstName) {
  return createNotification(
    userId,
    'welcome',
    'Welcome to Wine Wizard! 🎉',
    `Hey ${firstName}! Welcome aboard. Start exploring bars, track your sessions, and connect with friends. Cheers!`,
    { action: 'explore' }
  );
}

/**
 * Send friend request notification
 */
async function sendFriendRequestNotification(toUserId, fromUser) {
  return createNotification(
    toUserId,
    'friend_request',
    'New friend request',
    `${fromUser.firstName} ${fromUser.lastName} wants to connect with you`,
    { fromUserId: fromUser._id }
  );
}

/**
 * Send friend accepted notification
 */
async function sendFriendAcceptedNotification(toUserId, fromUser) {
  return createNotification(
    toUserId,
    'friend_accepted',
    'Friend request accepted',
    `${fromUser.firstName} ${fromUser.lastName} accepted your friend request`,
    { fromUserId: fromUser._id }
  );
}

/**
 * Send message notification
 */
async function sendMessageNotification(toUserId, fromUser, preview) {
  return createNotification(
    toUserId,
    'message',
    'New message',
    `${fromUser.firstName}: "${preview.substring(0, 100)}"`,
    { fromUserId: fromUser._id }
  );
}

/**
 * Send achievement notification
 */
async function sendAchievementNotification(userId, achievementName) {
  return createNotification(
    userId,
    'achievement',
    'New achievement unlocked!',
    `You earned the "${achievementName}" badge`,
    { achievement: achievementName }
  );
}

module.exports = {
  createNotification,
  sendWelcomeNotification,
  sendFriendRequestNotification,
  sendFriendAcceptedNotification,
  sendMessageNotification,
  sendAchievementNotification,
};
