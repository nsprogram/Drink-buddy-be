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
    if (!tokens.length) {
      console.log('[push] no registered tokens for user', userId);
      return { ok: true, skipped: 'no tokens' };
    }
    console.log('[push] sending to', tokens.length, 'token(s) for user', userId, '→', title);

    const messages = tokens.map(to => ({
      to,
      title,
      body,
      data,
      sound,
      priority,
      // Critical for background/closed-app delivery on Android — wakes the device.
      _displayInForeground: true,
      ...(badge !== undefined ? { badge } : {}),
      ...(channelId ? { channelId } : {}),
      ...(ttl !== undefined ? { ttl } : {}),
    }));

    const result = await sendBatch(messages);
    if (result.ok && result.response?.data) {
      const tickets = result.response.data;
      const errs = tickets.filter(t => t.status === 'error');
      if (errs.length) {
        console.warn('[push] errored tickets:', JSON.stringify(errs).slice(0, 400));
        // Auto-prune invalid tokens — Expo returns DeviceNotRegistered for stale ones
        const dead = errs
          .map((t, i) => ({ ticket: t, token: tokens[i] }))
          .filter(x => x.ticket.details?.error === 'DeviceNotRegistered')
          .map(x => x.token);
        if (dead.length) {
          await User.updateOne(
            { _id: userId },
            { $pull: { pushTokens: { token: { $in: dead } } } }
          ).catch(() => {});
          console.log('[push] pruned', dead.length, 'dead tokens');
        }
      }
    }
    return result;
  } catch (err) {
    console.warn('[push] sendPushToUser error:', err.message);
    return { ok: false, error: err.message };
  }
}

module.exports = { sendPushToUser, sendBatch };
