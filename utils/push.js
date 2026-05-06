/**
 * Lightweight Expo Push helper — no extra deps required.
 * Talks directly to https://exp.host/--/api/v2/push/send (Expo's free push API).
 *
 * Usage:
 *   const { sendPushToUser } = require('../utils/push');
 *   await sendPushToUser(userId, { title: 'New message', body: 'Hey!', data: {...} });
 */

const User = require('../models/User');

const EXPO_ENDPOINT = 'https://exp.host/--/api/v2/push/send';

function isExpoToken(t) { return typeof t === 'string' && /^Expo(nent)?PushToken\[/.test(t); }

async function sendBatch(messages) {
  if (!messages.length) return { ok: true, sent: 0 };
  try {
    const res = await fetch(EXPO_ENDPOINT, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.warn('[push] Expo push API error:', res.status, json);
      return { ok: false, error: json };
    }
    return { ok: true, sent: messages.length, response: json };
  } catch (err) {
    console.warn('[push] Failed to send:', err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Send a push notification to a user's registered devices (best-effort).
 * Silently no-ops if the user has no tokens.
 */
async function sendPushToUser(userId, { title, body, data = {}, sound = 'default', badge, channelId, ttl, priority = 'high' }) {
  try {
    const user = await User.findById(userId).select('pushTokens').lean();
    const tokens = (user?.pushTokens || []).map(t => t.token).filter(isExpoToken);
    if (!tokens.length) return { ok: true, skipped: 'no tokens' };

    const messages = tokens.map(to => ({
      to,
      title,
      body,
      data,
      sound,
      priority,
      ...(badge !== undefined ? { badge } : {}),
      ...(channelId ? { channelId } : {}),
      ...(ttl !== undefined ? { ttl } : {}),
    }));

    return await sendBatch(messages);
  } catch (err) {
    console.warn('[push] sendPushToUser error:', err.message);
    return { ok: false, error: err.message };
  }
}

module.exports = { sendPushToUser, sendBatch };
