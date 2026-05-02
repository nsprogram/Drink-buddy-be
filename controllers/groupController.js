const Group = require('../models/Group');
const Message = require('../models/Message');
const User = require('../models/User');

const POPULATE_USER = 'firstName lastName fullName profileImage avatarEmoji avatarColor avatarId isOnline';

class GroupController {
  // Create a group
  static async create(req, res) {
    try {
      const { name, description, memberIds = [], image } = req.body;
      const me = req.user._id;
      if (!name || !name.trim()) {
        return res.status(400).json({ success: false, message: 'Name is required' });
      }
      const uniqueIds = Array.from(new Set([...memberIds.map(String), String(me)]));
      const members = uniqueIds.map(id => ({
        user: id,
        role: String(id) === String(me) ? 'admin' : 'member',
      }));
      const group = await Group.create({
        name: name.trim(),
        description: description?.trim() || '',
        image: image || null,
        members,
        createdBy: me,
      });
      const populated = await Group.findById(group._id).populate('members.user', POPULATE_USER);
      // Notify members via socket
      const io = req.app.get('io');
      if (io) {
        members.forEach(m => {
          if (String(m.user) !== String(me)) {
            io.to(`user:${m.user}`).emit('group:created', { group: populated });
          }
        });
      }
      res.status(201).json({ success: true, data: { group: populated } });
    } catch (err) {
      console.error('[Group] create:', err);
      res.status(500).json({ success: false, message: 'Failed to create group' });
    }
  }

  // List groups the user belongs to
  static async list(req, res) {
    try {
      const me = req.user._id;
      const groups = await Group.find({ 'members.user': me })
        .populate('members.user', POPULATE_USER)
        .sort({ lastMessageAt: -1, updatedAt: -1 })
        .lean();
      res.json({ success: true, data: { groups } });
    } catch (err) {
      console.error('[Group] list:', err);
      res.status(500).json({ success: false, message: 'Failed to load groups' });
    }
  }

  // Get a single group
  static async get(req, res) {
    try {
      const { id } = req.params;
      const group = await Group.findById(id).populate('members.user', POPULATE_USER);
      if (!group) return res.status(404).json({ success: false, message: 'Group not found' });
      const isMember = group.members.some(m => String(m.user._id || m.user) === String(req.user._id));
      if (!isMember) return res.status(403).json({ success: false, message: 'Not a member' });
      res.json({ success: true, data: { group } });
    } catch (err) {
      console.error('[Group] get:', err);
      res.status(500).json({ success: false, message: 'Failed to load group' });
    }
  }

  // Update group (name, image, description, members)
  static async update(req, res) {
    try {
      const { id } = req.params;
      const { name, description, image, addMembers, removeMembers } = req.body;
      const group = await Group.findById(id);
      if (!group) return res.status(404).json({ success: false, message: 'Group not found' });
      const me = req.user._id;
      const isAdmin = group.members.some(m => String(m.user) === String(me) && m.role === 'admin');
      if (!isAdmin) return res.status(403).json({ success: false, message: 'Admin only' });

      if (name !== undefined) group.name = String(name).trim().slice(0, 60);
      if (description !== undefined) group.description = String(description).trim().slice(0, 250);
      if (image !== undefined) group.image = image;
      if (Array.isArray(addMembers)) {
        for (const uid of addMembers) {
          if (!group.members.some(m => String(m.user) === String(uid))) {
            group.members.push({ user: uid, role: 'member' });
          }
        }
      }
      if (Array.isArray(removeMembers)) {
        group.members = group.members.filter(m => !removeMembers.map(String).includes(String(m.user)));
      }
      await group.save();
      const populated = await Group.findById(id).populate('members.user', POPULATE_USER);
      res.json({ success: true, data: { group: populated } });
    } catch (err) {
      console.error('[Group] update:', err);
      res.status(500).json({ success: false, message: 'Failed to update group' });
    }
  }

  // Delete group (creator/admin only)
  static async remove(req, res) {
    try {
      const { id } = req.params;
      const group = await Group.findById(id);
      if (!group) return res.status(404).json({ success: false, message: 'Group not found' });
      if (String(group.createdBy) !== String(req.user._id)) {
        return res.status(403).json({ success: false, message: 'Only the creator can delete' });
      }
      await Message.deleteMany({ group: id });
      await Group.findByIdAndDelete(id);
      res.json({ success: true, message: 'Group deleted' });
    } catch (err) {
      console.error('[Group] remove:', err);
      res.status(500).json({ success: false, message: 'Failed to delete group' });
    }
  }

  // List messages in a group
  static async listMessages(req, res) {
    try {
      const { id } = req.params;
      const group = await Group.findById(id);
      if (!group) return res.status(404).json({ success: false, message: 'Group not found' });
      const isMember = group.members.some(m => String(m.user) === String(req.user._id));
      if (!isMember) return res.status(403).json({ success: false, message: 'Not a member' });

      const messages = await Message.find({ group: id, deleted: { $ne: true } })
        .sort({ createdAt: 1 })
        .limit(500)
        .populate('sender', POPULATE_USER)
        .lean();
      res.json({ success: true, data: { messages } });
    } catch (err) {
      console.error('[Group] listMessages:', err);
      res.status(500).json({ success: false, message: 'Failed to load messages' });
    }
  }

  // Send a message to a group
  static async sendMessage(req, res) {
    try {
      const { id } = req.params;
      const { content, type = 'text', imageUri, videoUri, voiceUri, voiceDuration, replyData } = req.body;
      const group = await Group.findById(id);
      if (!group) return res.status(404).json({ success: false, message: 'Group not found' });
      const me = req.user._id;
      const isMember = group.members.some(m => String(m.user) === String(me));
      if (!isMember) return res.status(403).json({ success: false, message: 'Not a member' });

      const data = {
        sender: me,
        recipient: null,
        group: id,
        content: content || '',
        type,
        readBy: [me],
      };
      if (type === 'image' && imageUri) data.imageUri = imageUri;
      if (type === 'video' && videoUri) data.videoUri = videoUri;
      if (type === 'voice' && voiceUri) {
        data.voiceUri = voiceUri;
        data.voiceDuration = voiceDuration || 0;
      }
      if (replyData) {
        data.replyTo = replyData.messageId || null;
        data.replyText = replyData.replyText || null;
        data.replySender = replyData.replySender || null;
      }

      let message = await Message.create(data);
      message = await Message.findById(message._id).populate('sender', POPULATE_USER);

      // Update group last-message preview
      group.lastMessage = type === 'text' ? (content || '').slice(0, 80)
        : type === 'image' ? '📷 Photo'
        : type === 'video' ? '🎬 Video'
        : type === 'voice' ? '🎤 Voice' : '';
      group.lastMessageAt = new Date();
      await group.save();

      // Broadcast to all members
      const io = req.app.get('io');
      if (io) {
        group.members.forEach(m => {
          if (String(m.user) !== String(me)) {
            io.to(`user:${m.user}`).emit('group:message', { groupId: id, message });
          }
        });
      }

      res.status(201).json({ success: true, data: { message } });
    } catch (err) {
      console.error('[Group] sendMessage:', err);
      res.status(500).json({ success: false, message: 'Failed to send' });
    }
  }
}

module.exports = GroupController;
