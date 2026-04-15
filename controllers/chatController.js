const Message = require('../models/Message');
const User = require('../models/User');
const { cloudinary } = require('../config/cloudinary');

class ChatController {
  static async getMessages(req, res) {
    try {
      const { friendId } = req.params;
      const currentUserId = req.user._id;

      const friend = await User.findById(friendId);
      if (!friend) return res.status(404).json({ success: false, message: 'User not found' });

      const messages = await Message.find({
        $or: [
          { sender: currentUserId, recipient: friendId },
          { sender: friendId, recipient: currentUserId }
        ]
      })
        .populate('sender', 'firstName lastName profileImage')
        .populate('recipient', 'firstName lastName profileImage')
        .sort({ createdAt: 1 })
        .limit(100);

      res.json({ success: true, data: messages });
    } catch (error) {
      console.error('Get messages error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch messages' });
    }
  }

  static async sendMessage(req, res) {
    try {
      const { recipientId, content, type = 'text', imageUri, videoUri, videoDuration, replyData, voiceUri, voiceDuration } = req.body;
      const senderId = req.user._id;

      const recipient = await User.findById(recipientId);
      if (!recipient) return res.status(404).json({ success: false, message: 'Recipient not found' });

      if (type === 'text' && !content?.trim()) {
        return res.status(400).json({ success: false, message: 'Message content is required' });
      }
      if (type === 'image' && !imageUri) {
        return res.status(400).json({ success: false, message: 'Image URI is required for image messages' });
      }
      if (type === 'voice' && !voiceUri && !req.file) {
        return res.status(400).json({ success: false, message: 'Voice URI is required for voice messages' });
      }
      if (type === 'video' && !videoUri) {
        return res.status(400).json({ success: false, message: 'Video URI is required for video messages' });
      }

      const messageData = { sender: senderId, recipient: recipientId, content: content?.trim() || '', type };

      if (type === 'image' && imageUri) {
        messageData.imageUri = imageUri;
      } else if (type === 'video' && videoUri) {
        messageData.videoUri = videoUri;
        messageData.videoDuration = parseInt(videoDuration) || 0;
      } else if (type === 'voice') {
        // Two paths:
        //  (a) Multipart upload: req.file present → upload to Cloudinary here
        //  (b) JSON body: voiceUri already uploaded (via /chat/upload-voice) → use directly
        if (req.file) {
          const result = await cloudinary.uploader.upload(req.file.path, {
            folder: 'drinkbuddy/chat/voice', resource_type: 'video'
          });
          messageData.voiceUri = result.secure_url;
        } else if (voiceUri) {
          messageData.voiceUri = voiceUri;
        }
        messageData.voiceDuration = parseInt(voiceDuration) || 0;
      }

      if (replyData) {
        messageData.replyTo = replyData.replyTo;
        messageData.replyText = replyData.replyText;
        messageData.replySender = replyData.replySender;
      }

      const message = new Message(messageData);
      await message.save();
      await message.populate('sender', 'firstName lastName profileImage');
      await message.populate('recipient', 'firstName lastName profileImage');

      // Emit to recipient via Socket.IO for real-time delivery
      const io = req.app.get('io');
      if (io) {
        io.to(`user:${recipientId}`).emit('chat:receive', message);
        console.log(`[Chat] REST msg sent to socket user:${recipientId}`);
      }

      res.status(201).json({ success: true, message: 'Message sent successfully', data: message });
    } catch (error) {
      console.error('Send message error:', error);
      res.status(500).json({ success: false, message: 'Failed to send message' });
    }
  }

  static async editMessage(req, res) {
    try {
      const { messageId } = req.params;
      const { content } = req.body;
      const currentUserId = req.user._id;

      const message = await Message.findById(messageId);
      if (!message) return res.status(404).json({ success: false, message: 'Message not found' });
      if (message.sender.toString() !== currentUserId.toString()) {
        return res.status(403).json({ success: false, message: 'You can only edit your own messages' });
      }

      const diffInMinutes = (new Date() - new Date(message.createdAt)) / (1000 * 60);
      if (diffInMinutes > 10) {
        return res.status(400).json({ success: false, message: 'Messages can only be edited within 10 minutes' });
      }

      if (!message.originalContent) message.originalContent = message.content;
      message.content = content.trim();
      message.isEdited = true;
      message.editedAt = new Date();
      await message.save();

      // Notify recipient via socket
      const recipientId = message.recipient?.toString();
      const io = req.app.get('io');
      if (io && recipientId) {
        io.to(`user:${recipientId}`).emit('chat:edited', { messageId, content: message.content });
      }

      res.json({ success: true, message: 'Message edited successfully', data: message });
    } catch (error) {
      console.error('Edit message error:', error);
      res.status(500).json({ success: false, message: 'Failed to edit message' });
    }
  }

  static async addReaction(req, res) {
    try {
      const { messageId } = req.params;
      const { emoji } = req.body;
      const currentUserId = req.user._id;

      const message = await Message.findById(messageId);
      if (!message) return res.status(404).json({ success: false, message: 'Message not found' });

      const reactions = message.reactions || new Map();
      const emojiReactions = reactions.get(emoji) || [];
      const userIndex = emojiReactions.findIndex(id => id.toString() === currentUserId.toString());

      if (userIndex > -1) {
        emojiReactions.splice(userIndex, 1);
        if (emojiReactions.length === 0) reactions.delete(emoji);
        else reactions.set(emoji, emojiReactions);
      } else {
        emojiReactions.push(currentUserId);
        reactions.set(emoji, emojiReactions);
      }

      message.reactions = reactions;
      await message.save();

      res.json({ success: true, message: 'Reaction updated successfully', data: message });
    } catch (error) {
      console.error('Add reaction error:', error);
      res.status(500).json({ success: false, message: 'Failed to add reaction' });
    }
  }

  static async deleteMessage(req, res) {
    try {
      const { messageId } = req.params;
      const currentUserId = req.user._id;

      const message = await Message.findById(messageId);
      if (!message) return res.status(404).json({ success: false, message: 'Message not found' });
      if (message.sender.toString() !== currentUserId.toString()) {
        return res.status(403).json({ success: false, message: 'You can only delete your own messages' });
      }

      if (message.type === 'image' && message.imageUri) {
        try {
          const urlParts = message.imageUri.split('/');
          const publicId = urlParts[urlParts.length - 1].split('.')[0];
          await cloudinary.uploader.destroy(`chat_images/${publicId}`);
        } catch (e) { console.error('Failed to delete image from Cloudinary:', e); }
      }

      const recipientId = message.recipient?.toString();
      await Message.findByIdAndDelete(messageId);

      // Notify recipient via socket
      const io = req.app.get('io');
      if (io && recipientId) {
        io.to(`user:${recipientId}`).emit('chat:deleted', { messageId });
      }

      res.json({ success: true, message: 'Message deleted successfully' });
    } catch (error) {
      console.error('Delete message error:', error);
      res.status(500).json({ success: false, message: 'Failed to delete message' });
    }
  }

  static async getConversations(req, res) {
    try {
      const currentUserId = req.user._id;

      const conversations = await Message.aggregate([
        { $match: { $or: [{ sender: currentUserId }, { recipient: currentUserId }] } },
        { $sort: { createdAt: -1 } },
        {
          $group: {
            _id: { $cond: [{ $eq: ['$sender', currentUserId] }, '$recipient', '$sender'] },
            lastMessage: { $first: '$$ROOT' },
            unreadCount: { $sum: { $cond: [{ $and: [{ $eq: ['$recipient', currentUserId] }, { $eq: ['$isRead', false] }] }, 1, 0] } }
          }
        },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
        { $unwind: '$user' },
        {
          $project: {
            user: { _id: '$user._id', firstName: '$user.firstName', lastName: '$user.lastName', profileImage: '$user.profileImage', isOnline: '$user.isOnline' },
            lastMessage: '$lastMessage',
            unreadCount: '$unreadCount'
          }
        },
        { $sort: { 'lastMessage.createdAt': -1 } }
      ]);

      res.json({ success: true, data: conversations });
    } catch (error) {
      console.error('Get conversations error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch conversations' });
    }
  }

  static async markAsRead(req, res) {
    try {
      const { friendId } = req.params;
      const currentUserId = req.user._id;

      await Message.updateMany(
        { sender: friendId, recipient: currentUserId, isRead: { $ne: true } },
        { $set: { isRead: true, readAt: new Date() } }
      );

      res.json({ success: true, message: 'Messages marked as read' });
    } catch (error) {
      console.error('Mark as read error:', error);
      res.status(500).json({ success: false, message: 'Failed to mark messages as read' });
    }
  }

  static async streamMessages(req, res) {
    const { friendId } = req.params;
    const currentUserId = req.user._id;

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    res.write(`data: ${JSON.stringify({ type: 'connected', message: 'Connected to message stream' })}\n\n`);

    // Polling fallback every 2 seconds (change stream requires replica set)
    let lastChecked = new Date();
    const pollInterval = setInterval(async () => {
      try {
        const newMessages = await Message.find({
          createdAt: { $gt: lastChecked },
          $or: [
            { sender: currentUserId, recipient: friendId },
            { sender: friendId, recipient: currentUserId }
          ]
        })
          .populate('sender', 'firstName lastName profileImage')
          .populate('recipient', 'firstName lastName profileImage')
          .sort({ createdAt: 1 });

        if (newMessages.length > 0) {
          lastChecked = new Date();
          newMessages.forEach(msg => {
            res.write(`data: ${JSON.stringify({ type: 'message', data: msg })}\n\n`);
          });
        }
      } catch (e) { console.error('SSE polling error:', e); }
    }, 2000);

    req.on('close', () => clearInterval(pollInterval));
    req.on('end', () => clearInterval(pollInterval));
  }

  static async uploadChatImage(req, res) {
    try {
      if (!req.file) return res.status(400).json({ success: false, message: 'No image file provided' });

      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: 'chat_images',
        transformation: [{ width: 800, height: 600, crop: 'limit' }, { quality: 'auto' }, { format: 'auto' }]
      });

      res.json({ success: true, message: 'Image uploaded successfully', data: { imageUri: result.secure_url, publicId: result.public_id } });
    } catch (error) {
      console.error('Upload chat image error:', error);
      res.status(500).json({ success: false, message: 'Failed to upload image' });
    }
  }

  static async uploadVoiceMessage(req, res) {
    try {
      if (!req.file) return res.status(400).json({ success: false, message: 'No voice file provided' });

      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: 'drinkbuddy/chat/voice', resource_type: 'video'
      });

      const voiceUri = result.secure_url;
      const recipientId = req.body.recipientId;
      const voiceDuration = parseInt(req.body.voiceDuration) || Math.round(result.duration || 0);

      // If recipientId provided, also create a message in DB
      if (recipientId) {
        const message = new Message({
          sender: req.user._id,
          recipient: recipientId,
          type: 'voice',
          voiceUri,
          voiceDuration,
          content: '',
        });
        await message.save();
        await message.populate('sender', 'firstName lastName profileImage');
        await message.populate('recipient', 'firstName lastName profileImage');

        // Emit via socket
        const io = req.app.get('io');
        if (io) {
          io.to(`user:${recipientId}`).emit('message:new', message);
        }

        return res.json({ success: true, message: 'Voice message sent', data: message });
      }

      res.json({ success: true, message: 'Voice uploaded', data: { voiceUri, publicId: result.public_id, duration: voiceDuration } });
    } catch (error) {
      console.error('Upload voice message error:', error);
      res.status(500).json({ success: false, message: 'Failed to upload voice message' });
    }
  }

  static async uploadChatVideo(req, res) {
    try {
      if (!req.file) return res.status(400).json({ success: false, message: 'No video file provided' });

      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: 'drinkbuddy/chat/videos',
        resource_type: 'video',
        transformation: [{ quality: 'auto' }],
      });

      res.json({ success: true, message: 'Video uploaded', data: { videoUri: result.secure_url, publicId: result.public_id, duration: result.duration || 0 } });
    } catch (error) {
      console.error('Upload chat video error:', error);
      res.status(500).json({ success: false, message: 'Failed to upload video' });
    }
  }

  static async updateOnlineStatus(req, res) {
    try {
      const { isOnline } = req.body;
      await User.findByIdAndUpdate(req.user._id, { isOnline, lastSeen: new Date() });
      res.json({ success: true, message: 'Online status updated' });
    } catch (error) {
      console.error('Update online status error:', error);
      res.status(500).json({ success: false, message: 'Failed to update online status' });
    }
  }
  // Clear all messages between two users
  static async clearChat(req, res) {
    try {
      const { friendId } = req.params;
      const currentUserId = req.user._id;

      const result = await Message.deleteMany({
        $or: [
          { sender: currentUserId, recipient: friendId },
          { sender: friendId, recipient: currentUserId },
        ],
      });

      res.json({
        success: true,
        message: 'Chat history cleared',
        data: { deletedCount: result.deletedCount },
      });
    } catch (error) {
      console.error('Clear chat error:', error);
      res.status(500).json({ success: false, message: 'Failed to clear chat' });
    }
  }
}

module.exports = ChatController;
