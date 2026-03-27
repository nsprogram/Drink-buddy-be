const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const Message = require('./models/Message');
const Call = require('./models/Call');

// Track connected users: userId -> Set of socketIds
const connectedUsers = new Map();

function getSocketUrl(userId) {
  const sockets = connectedUsers.get(userId.toString());
  return sockets ? [...sockets] : [];
}

function setupSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: true,
      credentials: true,
      methods: ['GET', 'POST'],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // ── Auth middleware ──
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) return next(new Error('Authentication required'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');
      if (!user || !user.isActive || user.isBlocked) {
        return next(new Error('Invalid user'));
      }
      socket.user = user;
      socket.userId = user._id.toString();
      next();
    } catch (err) {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.userId;
    console.log(`[Socket] User connected: ${userId} (socket: ${socket.id})`);

    // ── Track connection ──
    if (!connectedUsers.has(userId)) {
      connectedUsers.set(userId, new Set());
    }
    connectedUsers.get(userId).add(socket.id);

    // Update online status
    User.findByIdAndUpdate(userId, { isOnline: true, lastSeen: new Date() }).catch(() => {});

    // Broadcast online status to friends
    broadcastOnlineStatus(io, userId, true);

    // ── Join personal room ──
    socket.join(`user:${userId}`);

    // ══════════════════════════
    //  CHAT EVENTS
    // ══════════════════════════

    // Send message via socket
    socket.on('chat:send', async (data, callback) => {
      try {
        const { recipientId, content, type = 'text', imageUri, voiceUri, voiceDuration, videoUri, videoDuration } = data;

        const recipient = await User.findById(recipientId);
        if (!recipient) return callback?.({ error: 'Recipient not found' });

        const messageData = {
          sender: userId,
          recipient: recipientId,
          content: content?.trim() || '',
          type,
        };

        if (type === 'image' && imageUri) messageData.imageUri = imageUri;
        if (type === 'voice' && voiceUri) {
          messageData.voiceUri = voiceUri;
          messageData.voiceDuration = voiceDuration || 0;
        }
        if (type === 'video' && videoUri) {
          messageData.videoUri = videoUri;
          messageData.videoDuration = videoDuration || 0;
        }

        const message = new Message(messageData);
        await message.save();
        await message.populate('sender', 'firstName lastName profileImage');
        await message.populate('recipient', 'firstName lastName profileImage');

        // Send to recipient
        io.to(`user:${recipientId}`).emit('chat:receive', message);

        // Confirm to sender
        callback?.({ success: true, message });
      } catch (err) {
        console.error('[Socket] chat:send error:', err);
        callback?.({ error: 'Failed to send message' });
      }
    });

    // Typing indicator
    socket.on('chat:typing', ({ recipientId, isTyping }) => {
      io.to(`user:${recipientId}`).emit('chat:typing', {
        userId,
        isTyping,
      });
    });

    // Mark messages as read
    socket.on('chat:read', async ({ friendId }) => {
      try {
        await Message.updateMany(
          { sender: friendId, recipient: userId, isRead: { $ne: true } },
          { $set: { isRead: true, readAt: new Date() } }
        );
        // Notify the friend that messages were read
        io.to(`user:${friendId}`).emit('chat:read', { readBy: userId });
      } catch {}
    });

    // Message edited
    socket.on('chat:edit', async ({ messageId, content }, callback) => {
      try {
        const msg = await Message.findById(messageId);
        if (!msg || msg.sender.toString() !== userId) return callback?.({ error: 'Not allowed' });

        if (!msg.originalContent) msg.originalContent = msg.content;
        msg.content = content.trim();
        msg.isEdited = true;
        msg.editedAt = new Date();
        await msg.save();

        // Notify recipient
        const recipientId = msg.recipient.toString();
        io.to(`user:${recipientId}`).emit('chat:edited', { messageId, content: msg.content });

        callback?.({ success: true });
      } catch {
        callback?.({ error: 'Failed to edit' });
      }
    });

    // Message deleted
    socket.on('chat:delete', async ({ messageId }, callback) => {
      try {
        const msg = await Message.findById(messageId);
        if (!msg || msg.sender.toString() !== userId) return callback?.({ error: 'Not allowed' });

        const recipientId = msg.recipient.toString();
        await Message.findByIdAndDelete(messageId);

        io.to(`user:${recipientId}`).emit('chat:deleted', { messageId });
        callback?.({ success: true });
      } catch {
        callback?.({ error: 'Failed to delete' });
      }
    });

    // ══════════════════════════
    //  CALL EVENTS
    // ══════════════════════════

    // Initiate a call
    socket.on('call:initiate', async ({ receiverId, type }, callback) => {
      try {
        const receiver = await User.findById(receiverId);
        if (!receiver) return callback?.({ error: 'User not found' });

        // Clean up stale calls older than 2 minutes stuck in 'ringing'
        const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000);
        await Call.updateMany(
          { status: 'ringing', createdAt: { $lt: twoMinAgo } },
          { $set: { status: 'missed' } }
        );

        // Check if receiver is ACTUALLY in an active accepted call (not just ringing)
        const activeCall = await Call.findOne({
          $or: [{ caller: receiverId }, { receiver: receiverId }],
          status: 'accepted', // Only block if truly in a connected call
        });
        if (activeCall) return callback?.({ error: 'User is busy', status: 'busy' });

        const call = new Call({ caller: userId, receiver: receiverId, type });
        await call.save();
        await call.populate('caller', 'firstName lastName profileImage');
        await call.populate('receiver', 'firstName lastName profileImage');

        // Notify receiver
        io.to(`user:${receiverId}`).emit('call:incoming', {
          callId: call._id.toString(),
          caller: {
            _id: socket.user._id,
            firstName: socket.user.firstName,
            lastName: socket.user.lastName,
            profileImage: socket.user.profileImage,
          },
          type,
        });

        callback?.({ success: true, callId: call._id.toString() });

        // Auto-miss after 30 seconds
        setTimeout(async () => {
          try {
            const c = await Call.findById(call._id);
            if (c && c.status === 'ringing') {
              c.status = 'missed';
              await c.save();
              io.to(`user:${userId}`).emit('call:missed', { callId: call._id.toString() });
              io.to(`user:${receiverId}`).emit('call:missed', { callId: call._id.toString() });
            }
          } catch {}
        }, 30000);
      } catch (err) {
        console.error('[Socket] call:initiate error:', err);
        callback?.({ error: 'Failed to initiate call' });
      }
    });

    // Accept call
    socket.on('call:accept', async ({ callId }, callback) => {
      try {
        const call = await Call.findById(callId);
        if (!call || call.receiver.toString() !== userId) return callback?.({ error: 'Invalid call' });

        call.status = 'accepted';
        call.startedAt = new Date();
        await call.save();

        const callerId = call.caller.toString();
        io.to(`user:${callerId}`).emit('call:accepted', { callId });

        callback?.({ success: true });
      } catch {
        callback?.({ error: 'Failed to accept call' });
      }
    });

    // Decline call
    socket.on('call:decline', async ({ callId }, callback) => {
      try {
        const call = await Call.findById(callId);
        if (!call) return callback?.({ error: 'Call not found' });

        call.status = 'declined';
        await call.save();

        const otherUserId = call.caller.toString() === userId
          ? call.receiver.toString()
          : call.caller.toString();

        io.to(`user:${otherUserId}`).emit('call:declined', { callId });
        callback?.({ success: true });
      } catch {
        callback?.({ error: 'Failed to decline call' });
      }
    });

    // End call
    socket.on('call:end', async ({ callId }, callback) => {
      try {
        const call = await Call.findById(callId);
        if (!call) return callback?.({ error: 'Call not found' });

        call.status = 'ended';
        call.endedAt = new Date();
        if (call.startedAt) {
          call.duration = Math.round((call.endedAt - call.startedAt) / 1000);
        }
        await call.save();

        const otherUserId = call.caller.toString() === userId
          ? call.receiver.toString()
          : call.caller.toString();

        io.to(`user:${otherUserId}`).emit('call:ended', {
          callId,
          duration: call.duration,
        });

        callback?.({ success: true, duration: call.duration });
      } catch {
        callback?.({ error: 'Failed to end call' });
      }
    });

    // WebRTC signaling: offer
    socket.on('call:offer', ({ callId, receiverId, offer }) => {
      io.to(`user:${receiverId}`).emit('call:offer', { callId, offer, callerId: userId });
    });

    // WebRTC signaling: answer
    socket.on('call:answer', ({ callId, callerId, answer }) => {
      io.to(`user:${callerId}`).emit('call:answer', { callId, answer });
    });

    // WebRTC signaling: ICE candidate
    socket.on('call:ice-candidate', ({ callId, targetUserId, candidate }) => {
      io.to(`user:${targetUserId}`).emit('call:ice-candidate', { callId, candidate });
    });

    // Toggle mute/camera
    socket.on('call:toggle-media', ({ callId, targetUserId, mediaType, enabled }) => {
      io.to(`user:${targetUserId}`).emit('call:toggle-media', { callId, mediaType, enabled, userId });
    });

    // ══════════════════════════
    //  DISCONNECT
    // ══════════════════════════
    socket.on('disconnect', async () => {
      console.log(`[Socket] User disconnected: ${userId} (socket: ${socket.id})`);

      const userSockets = connectedUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          connectedUsers.delete(userId);

          // Mark offline after a short delay (in case of reconnect)
          setTimeout(async () => {
            if (!connectedUsers.has(userId)) {
              await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen: new Date() }).catch(() => {});
              broadcastOnlineStatus(io, userId, false);
            }
          }, 5000);
        }
      }

      // End any active calls
      try {
        const activeCalls = await Call.find({
          $or: [{ caller: userId }, { receiver: userId }],
          status: { $in: ['ringing', 'accepted'] },
        });
        for (const call of activeCalls) {
          call.status = call.status === 'ringing' ? 'missed' : 'ended';
          call.endedAt = new Date();
          if (call.startedAt) call.duration = Math.round((call.endedAt - call.startedAt) / 1000);
          await call.save();

          const otherUserId = call.caller.toString() === userId
            ? call.receiver.toString()
            : call.caller.toString();

          io.to(`user:${otherUserId}`).emit('call:ended', {
            callId: call._id.toString(),
            duration: call.duration,
            reason: 'disconnected',
          });
        }
      } catch {}
    });
  });

  return io;
}

async function broadcastOnlineStatus(io, userId, isOnline) {
  try {
    const user = await User.findById(userId).populate('friends.user', '_id');
    if (!user) return;

    const friendIds = user.friends
      .filter(f => f.status === 'accepted')
      .map(f => f.user?._id?.toString())
      .filter(Boolean);

    for (const friendId of friendIds) {
      io.to(`user:${friendId}`).emit('user:online-status', { userId, isOnline });
    }
  } catch {}
}

module.exports = { setupSocket, connectedUsers };
