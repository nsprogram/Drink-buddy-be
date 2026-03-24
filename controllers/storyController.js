const User = require('../models/User');
const { cloudinary } = require('../config/cloudinary');

class StoryController {
  static async createStory(req, res) {
    try {
      const { caption } = req.body;
      const userId = req.user._id;

      if (!req.file) {
        return res.status(400).json({ success: false, message: 'Media file is required' });
      }

      const isVideo = req.file.mimetype.startsWith('video/');
      const resourceType = isVideo ? 'video' : 'image';

      // Upload to Cloudinary
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: 'drinkbuddy/stories',
        resource_type: resourceType,
        transformation: isVideo
          ? [{ width: 720, quality: 'auto' }]
          : [{ width: 1080, quality: 'auto' }]
      });

      const story = {
        mediaUrl: result.secure_url,
        mediaType: isVideo ? 'video' : 'image',
        publicId: result.public_id,
        caption: caption || '',
        viewers: [],
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      };

      const user = await User.findByIdAndUpdate(
        userId,
        { $push: { stories: story } },
        { new: true }
      ).select('stories firstName lastName profileImage');

      const newStory = user.stories[user.stories.length - 1];

      res.status(201).json({
        success: true,
        message: 'Story created successfully',
        data: { story: newStory, user: { id: user._id, firstName: user.firstName, lastName: user.lastName, profileImage: user.profileImage } }
      });
    } catch (error) {
      console.error('Create story error:', error);
      res.status(500).json({ success: false, message: 'Failed to create story' });
    }
  }

  static async getUserStories(req, res) {
    try {
      const { userId } = req.params;
      const now = new Date();

      const user = await User.findById(userId)
        .select('firstName lastName profileImage stories');

      if (!user) return res.status(404).json({ success: false, message: 'User not found' });

      // Filter only active (non-expired) stories
      const activeStories = user.stories.filter(s => s.expiresAt > now);

      res.json({
        success: true,
        data: {
          user: { id: user._id, firstName: user.firstName, lastName: user.lastName, profileImage: user.profileImage },
          stories: activeStories
        }
      });
    } catch (error) {
      console.error('Get user stories error:', error);
      res.status(500).json({ success: false, message: 'Failed to get stories' });
    }
  }

  static async getFriendsStories(req, res) {
    try {
      const currentUserId = req.user._id;
      const now = new Date();

      const currentUser = await User.findById(currentUserId).select('friends');
      const friendIds = currentUser.friends
        .filter(f => f.status === 'accepted')
        .map(f => f.user);

      // Include own stories
      friendIds.push(currentUserId);

      const users = await User.find({
        _id: { $in: friendIds },
        'stories.expiresAt': { $gt: now }
      }).select('firstName lastName profileImage stories');

      const storiesData = users
        .map(user => ({
          user: { id: user._id, firstName: user.firstName, lastName: user.lastName, profileImage: user.profileImage },
          stories: user.stories.filter(s => s.expiresAt > now)
        }))
        .filter(item => item.stories.length > 0);

      res.json({ success: true, data: storiesData });
    } catch (error) {
      console.error('Get friends stories error:', error);
      res.status(500).json({ success: false, message: 'Failed to get friends stories' });
    }
  }

  static async viewStory(req, res) {
    try {
      const { userId, storyId } = req.params;
      const viewerId = req.user._id;

      await User.updateOne(
        { _id: userId, 'stories._id': storyId },
        { $addToSet: { 'stories.$.viewers': viewerId } }
      );

      res.json({ success: true, message: 'Story viewed' });
    } catch (error) {
      console.error('View story error:', error);
      res.status(500).json({ success: false, message: 'Failed to mark story as viewed' });
    }
  }

  static async deleteStory(req, res) {
    try {
      const { storyId } = req.params;
      const userId = req.user._id;

      const user = await User.findById(userId).select('stories');
      const story = user.stories.id(storyId);

      if (!story) return res.status(404).json({ success: false, message: 'Story not found' });

      // Delete from Cloudinary
      if (story.publicId) {
        try {
          await cloudinary.uploader.destroy(story.publicId, {
            resource_type: story.mediaType === 'video' ? 'video' : 'image'
          });
        } catch (e) { console.error('Failed to delete story from Cloudinary:', e); }
      }

      await User.findByIdAndUpdate(userId, { $pull: { stories: { _id: storyId } } });

      res.json({ success: true, message: 'Story deleted successfully' });
    } catch (error) {
      console.error('Delete story error:', error);
      res.status(500).json({ success: false, message: 'Failed to delete story' });
    }
  }

  static async cleanupExpiredStories(req, res) {
    try {
      const now = new Date();

      // Get all users with expired stories to delete from Cloudinary
      const usersWithExpiredStories = await User.find({ 'stories.expiresAt': { $lt: now } })
        .select('stories');

      for (const user of usersWithExpiredStories) {
        const expiredStories = user.stories.filter(s => s.expiresAt < now);
        for (const story of expiredStories) {
          if (story.publicId) {
            try {
              await cloudinary.uploader.destroy(story.publicId, {
                resource_type: story.mediaType === 'video' ? 'video' : 'image'
              });
            } catch (e) { console.error(e); }
          }
        }
      }

      // Remove expired stories from DB
      await User.updateMany(
        { 'stories.expiresAt': { $lt: now } },
        { $pull: { stories: { expiresAt: { $lt: now } } } }
      );

      res.json({ success: true, message: 'Expired stories cleaned up successfully' });
    } catch (error) {
      console.error('Cleanup stories error:', error);
      res.status(500).json({ success: false, message: 'Failed to cleanup expired stories' });
    }
  }
}

module.exports = StoryController;
