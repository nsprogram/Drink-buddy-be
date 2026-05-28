const FunnyMessage = require('../models/FunnyMessage');

class FunnyMessageController {
  // Get all active funny messages (for app users)
  static async getActiveMessages(req, res) {
    try {
      const messages = await FunnyMessage.find({ isActive: true })
        .sort({ priority: -1, createdAt: -1 })
        .select('-__v');
      
      res.json({ success: true, data: messages });
    } catch (error) {
      console.error('Get active messages error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch messages' });
    }
  }

  // Get random active message (for displaying in session), filtered by drinkCount and weighted by priority
  static async getRandomMessage(req, res) {
    try {
      const drinkCount = parseInt(req.query.drinkCount);
      const filter = { isActive: true };

      if (!isNaN(drinkCount)) {
        // Include messages where minDrinks/maxDrinks is null OR the drinkCount falls in range
        filter.$and = [
          { $or: [{ minDrinks: null }, { minDrinks: { $exists: false } }, { minDrinks: { $lte: drinkCount } }] },
          { $or: [{ maxDrinks: null }, { maxDrinks: { $exists: false } }, { maxDrinks: { $gte: drinkCount } }] },
        ];
      }

      const candidates = await FunnyMessage.find(filter).select('-__v').lean();
      if (!candidates.length) {
        return res.json({ success: true, data: null });
      }

      // Weighted random pick by priority (higher priority = higher chance)
      const totalWeight = candidates.reduce((sum, m) => sum + Math.max(1, m.priority || 1), 0);
      let r = Math.random() * totalWeight;
      let chosen = candidates[0];
      for (const m of candidates) {
        r -= Math.max(1, m.priority || 1);
        if (r <= 0) { chosen = m; break; }
      }

      res.json({ success: true, data: chosen });
    } catch (error) {
      console.error('Get random message error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch message' });
    }
  }

  // Admin: Get all messages (active and inactive)
  static async getAllMessages(req, res) {
    try {
      const { page = 1, limit = 20, category, isActive } = req.query;
      const skip = (page - 1) * limit;

      const filter = {};
      if (category) filter.category = category;
      if (isActive !== undefined) filter.isActive = isActive === 'true';

      const messages = await FunnyMessage.find(filter)
        .sort({ priority: -1, createdAt: -1 })
        .skip(parseInt(skip))
        .limit(parseInt(limit))
        .select('-__v');

      const total = await FunnyMessage.countDocuments(filter);

      res.json({
        success: true,
        data: messages,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total,
        },
      });
    } catch (error) {
      console.error('Get all messages error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch messages' });
    }
  }

  // Admin: Create new message
  static async createMessage(req, res) {
    try {
      const { message, emoji, displayTime, category, priority, isActive, triggerAfterDrinks, minDrinks, maxDrinks } = req.body;

      if (!message || !message.trim()) {
        return res.status(400).json({ success: false, message: 'Message text is required' });
      }

      const newMessage = new FunnyMessage({
        message: message.trim(),
        emoji: emoji || '🍺',
        displayTime: displayTime || 30,
        triggerAfterDrinks: triggerAfterDrinks || 1,
        category: category || 'funny',
        priority: priority || 1,
        isActive: isActive !== undefined ? isActive : true,
        minDrinks: minDrinks === undefined || minDrinks === '' ? null : minDrinks,
        maxDrinks: maxDrinks === undefined || maxDrinks === '' ? null : maxDrinks,
      });

      await newMessage.save();
      res.status(201).json({ success: true, message: 'Message created', data: newMessage });
    } catch (error) {
      console.error('Create message error:', error);
      res.status(500).json({ success: false, message: 'Failed to create message' });
    }
  }

  // Admin: Update message
  static async updateMessage(req, res) {
    try {
      const { messageId } = req.params;
      const { message, emoji, displayTime, category, priority, isActive, triggerAfterDrinks, minDrinks, maxDrinks } = req.body;

      const funnyMessage = await FunnyMessage.findById(messageId);
      if (!funnyMessage) {
        return res.status(404).json({ success: false, message: 'Message not found' });
      }

      if (message !== undefined) funnyMessage.message = message.trim();
      if (emoji !== undefined) funnyMessage.emoji = emoji;
      if (displayTime !== undefined) funnyMessage.displayTime = displayTime;
      if (category !== undefined) funnyMessage.category = category;
      if (priority !== undefined) funnyMessage.priority = priority;
      if (isActive !== undefined) funnyMessage.isActive = isActive;
      if (triggerAfterDrinks !== undefined) funnyMessage.triggerAfterDrinks = triggerAfterDrinks;
      if (minDrinks !== undefined) funnyMessage.minDrinks = minDrinks === '' ? null : minDrinks;
      if (maxDrinks !== undefined) funnyMessage.maxDrinks = maxDrinks === '' ? null : maxDrinks;

      await funnyMessage.save();
      res.json({ success: true, message: 'Message updated', data: funnyMessage });
    } catch (error) {
      console.error('Update message error:', error);
      res.status(500).json({ success: false, message: 'Failed to update message' });
    }
  }

  // Admin: Delete message
  static async deleteMessage(req, res) {
    try {
      const { messageId } = req.params;

      const message = await FunnyMessage.findByIdAndDelete(messageId);
      if (!message) {
        return res.status(404).json({ success: false, message: 'Message not found' });
      }

      res.json({ success: true, message: 'Message deleted' });
    } catch (error) {
      console.error('Delete message error:', error);
      res.status(500).json({ success: false, message: 'Failed to delete message' });
    }
  }

  // Admin: Toggle message active status
  static async toggleMessageStatus(req, res) {
    try {
      const { messageId } = req.params;

      const message = await FunnyMessage.findById(messageId);
      if (!message) {
        return res.status(404).json({ success: false, message: 'Message not found' });
      }

      message.isActive = !message.isActive;
      await message.save();

      res.json({ success: true, message: 'Status toggled', data: message });
    } catch (error) {
      console.error('Toggle status error:', error);
      res.status(500).json({ success: false, message: 'Failed to toggle status' });
    }
  }
}

module.exports = FunnyMessageController;
