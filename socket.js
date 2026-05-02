const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const Message = require('./models/Message');
const Call = require('./models/Call');

// Track connected users: userId -> Set of socketIds
const connectedUsers = new Map();

// Periodic cleanup of stale entries (every 5 minutes)
setInterval(() => {
  for (const [userId, sockets] of connectedUsers) {
    if (!sockets || sockets.size === 0) {
      connectedUsers.delete(userId);
    }
  }
}, 5 * 60 * 1000);

function getSocketUrl(userId) {
  const sockets = connectedUsers.get(userId.toString());
  return sockets ? [...sockets] : [];
}

function setupSocket(server) {
  const allowedOrigins = process.env.NODE_ENV === 'development'
    ? true
    : [process.env.FRONTEND_URL, 'exp://localhost:8081'].filter(Boolean);

  const io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
      methods: ['GET', 'POST'],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // ── Auth middleware ──
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
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

    // ── Check if a user is online ──
    socket.on('user:check-online', async ({ userId: checkId }, callback) => {
      try {
        const u = await User.findById(checkId, 'isOnline');
        callback?.({ isOnline: u?.isOnline || false });
      } catch { callback?.({ isOnline: false }); }
    });

    // ── Check for pending ringing calls when user comes online ──
    (async () => {
      try {
        const pendingCall = await Call.findOne({
          receiver: userId,
          status: 'ringing',
          createdAt: { $gt: new Date(Date.now() - 60 * 1000) }, // within last 60s
        }).populate('caller', 'firstName lastName profileImage');

        if (pendingCall) {
          console.log(`[Socket] Delivering pending call to ${userId} from ${pendingCall.caller?.firstName}`);
          socket.emit('call:incoming', {
            callId: pendingCall._id.toString(),
            caller: {
              _id: pendingCall.caller._id,
              firstName: pendingCall.caller.firstName,
              lastName: pendingCall.caller.lastName,
              profileImage: pendingCall.caller.profileImage,
            },
            type: pendingCall.type,
          });
        }
      } catch (err) {
        console.error('[Socket] Pending call check error:', err.message);
      }
    })();

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

    // Typing indicator (DM)
    socket.on('chat:typing', ({ recipientId, isTyping }) => {
      io.to(`user:${recipientId}`).emit('chat:typing', {
        userId,
        isTyping,
      });
    });

    // Typing indicator (Group) — broadcast to other group members
    socket.on('group:typing', async ({ groupId, isTyping, name }) => {
      try {
        const Group = require('./models/Group');
        const g = await Group.findById(groupId).select('members.user');
        if (!g) return;
        g.members.forEach(m => {
          const memberId = String(m.user);
          if (memberId === String(userId)) return;
          io.to(`user:${memberId}`).emit('group:typing', { groupId, userId, isTyping, name });
        });
      } catch (e) {
        console.warn('[Socket] group:typing failed:', e.message);
      }
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
      } catch (err) {
        console.warn('[Socket] chat:read error:', err.message);
      }
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
      } catch (err) {
        console.warn('[Socket] chat:edit error:', err.message);
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
      } catch (err) {
        console.warn('[Socket] chat:delete error:', err.message);
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

        // Auto-miss after 45 seconds (matches client-side timeout)
        setTimeout(async () => {
          try {
            const c = await Call.findById(call._id);
            if (c && c.status === 'ringing') {
              c.status = 'missed';
              await c.save();
              io.to(`user:${userId}`).emit('call:missed', { callId: call._id.toString() });
              io.to(`user:${receiverId}`).emit('call:missed', { callId: call._id.toString() });
            }
          } catch (err) {
            console.warn('[Socket] Auto-miss timeout error:', err.message);
          }
        }, 45000);
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
      } catch (err) {
        console.warn('[Socket] call:accept error:', err.message);
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
      } catch (err) {
        console.warn('[Socket] call:decline error:', err.message);
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
      } catch (err) {
        console.warn('[Socket] call:end error:', err.message);
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
    //  ROOM EVENTS
    // ══════════════════════════

    // Join a socket.io room for real-time room updates
    socket.on('room:join', ({ roomId }) => {
      socket.join(`room:${roomId}`);
      console.log(`[Socket] ${userId} joined room channel: ${roomId}`);
      // Notify others
      socket.to(`room:${roomId}`).emit('room:user-joined', {
        userId, roomId,
        user: { _id: socket.user._id, firstName: socket.user.firstName, lastName: socket.user.lastName, profileImage: socket.user.profileImage },
      });
    });

    socket.on('room:leave', ({ roomId }) => {
      socket.leave(`room:${roomId}`);
      socket.to(`room:${roomId}`).emit('room:user-left', { userId, roomId });
    });

    // Room chat message (real-time broadcast)
    socket.on('room:chat', ({ roomId, message, type }) => {
      if (!message || typeof message !== 'string') return;
      const sanitized = message.trim()
        .replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/javascript:/gi, '').replace(/on\w+=/gi, '');
      if (!sanitized) return;
      io.to(`room:${roomId}`).emit('room:chat-message', {
        sender: { _id: socket.user._id, firstName: socket.user.firstName, lastName: socket.user.lastName, profileImage: socket.user.profileImage },
        message: sanitized, type: type || 'text',
        sentAt: new Date(),
      });
    });

    // Room cheers/reaction broadcast
    socket.on('room:cheers', ({ roomId, emoji }) => {
      io.to(`room:${roomId}`).emit('room:cheers', {
        userId,
        user: { _id: socket.user._id, firstName: socket.user.firstName },
        emoji,
      });
    });

    // Drink selection update broadcast
    socket.on('room:drink-update', ({ roomId, drinkSelection }) => {
      io.to(`room:${roomId}`).emit('room:drink-updated', {
        userId, drinkSelection,
        user: { _id: socket.user._id, firstName: socket.user.firstName },
      });
    });

    // Session started/ended broadcast
    socket.on('room:session-update', ({ roomId, status }) => {
      io.to(`room:${roomId}`).emit('room:session-changed', { roomId, status, updatedBy: userId });
    });

    // Safety warning broadcast
    socket.on('room:safety-warning', ({ roomId, targetUserId, type }) => {
      io.to(`user:${targetUserId}`).emit('room:safety-alert', {
        roomId, type,
        from: { _id: socket.user._id, firstName: socket.user.firstName },
      });
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
      } catch (err) {
        console.warn('[Socket] Disconnect call cleanup error:', err.message);
      }
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
  } catch (err) {
    console.warn('[Socket] broadcastOnlineStatus error:', err.message);
  }
}

module.exports = { setupSocket, connectedUsers };
