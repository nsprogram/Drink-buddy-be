const User = require('../models/User');
const { deleteFromCloudinary, extractPublicId } = require('../config/cloudinary');

class ProfileController {
  // Upload profile or cover image
  static async uploadImage(req, res) {
    try {
      const updates = {};

      if (req.files && req.files.profileImage && req.files.profileImage[0]) {
        const file = req.files.profileImage[0];
        // Delete old profile image from Cloudinary
        if (req.user.profileImagePublicId) {
          try { await deleteFromCloudinary(req.user.profileImagePublicId); } catch (e) { console.error(e); }
        }
        updates.profileImage = file.path;
        updates.profileImagePublicId = file.filename;
      }

      if (req.files && req.files.coverImage && req.files.coverImage[0]) {
        const file = req.files.coverImage[0];
        if (req.user.coverImagePublicId) {
          try { await deleteFromCloudinary(req.user.coverImagePublicId); } catch (e) { console.error(e); }
        }
        updates.coverImage = file.path;
        updates.coverImagePublicId = file.filename;
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ success: false, message: 'No image file provided' });
      }

      const user = await User.findByIdAndUpdate(
        req.user._id,
        { $set: updates },
        { new: true }
      ).select('-password -refreshTokens');

      res.json({
        success: true,
        message: 'Image uploaded successfully',
        data: {
          profileImage: user.profileImage,
          coverImage: user.coverImage
        }
      });
    } catch (error) {
      console.error('Upload image error:', error);
      res.status(500).json({ success: false, message: 'Failed to upload image' });
    }
  }

  // Delete profile or cover image
  static async deleteImage(req, res) {
    try {
      const { type } = req.params; // 'profile' or 'cover'

      if (!['profile', 'cover'].includes(type)) {
        return res.status(400).json({ success: false, message: 'Image type must be "profile" or "cover"' });
      }

      const imageField = type === 'profile' ? 'profileImage' : 'coverImage';
      const publicIdField = type === 'profile' ? 'profileImagePublicId' : 'coverImagePublicId';
      const publicId = req.user[publicIdField];

      if (publicId) {
        try { await deleteFromCloudinary(publicId); } catch (e) { console.error(e); }
      }

      const user = await User.findByIdAndUpdate(
        req.user._id,
        { $set: { [imageField]: null, [publicIdField]: null } },
        { new: true }
      ).select('-password -refreshTokens');

      res.json({
        success: true,
        message: `${type} image deleted successfully`,
        data: { profileImage: user.profileImage, coverImage: user.coverImage }
      });
    } catch (error) {
      console.error('Delete image error:', error);
      res.status(500).json({ success: false, message: 'Failed to delete image' });
    }
  }

  // Update user preferences
  static async updatePreferences(req, res) {
    try {
      const { drinkTypes, socialLevel, notifications } = req.body;
      const updates = {};

      if (drinkTypes !== undefined) updates['preferences.drinkTypes'] = drinkTypes;
      if (socialLevel !== undefined) updates['preferences.socialLevel'] = socialLevel;
      if (notifications !== undefined) {
        if (notifications.friendRequests !== undefined) updates['preferences.notifications.friendRequests'] = notifications.friendRequests;
        if (notifications.messages !== undefined) updates['preferences.notifications.messages'] = notifications.messages;
        if (notifications.sessions !== undefined) updates['preferences.notifications.sessions'] = notifications.sessions;
      }

      const user = await User.findByIdAndUpdate(
        req.user._id,
        { $set: updates },
        { new: true }
      ).select('preferences');

      res.json({ success: true, message: 'Preferences updated successfully', data: { preferences: user.preferences } });
    } catch (error) {
      console.error('Update preferences error:', error);
      res.status(500).json({ success: false, message: 'Failed to update preferences' });
    }
  }

  // Update location
  static async updateLocation(req, res) {
    try {
      const { location } = req.body;
      if (!location) return res.status(400).json({ success: false, message: 'Location is required' });

      const user = await User.findByIdAndUpdate(
        req.user._id,
        { $set: { location } },
        { new: true }
      ).select('location');

      res.json({ success: true, message: 'Location updated successfully', data: { location: user.location } });
    } catch (error) {
      console.error('Update location error:', error);
      res.status(500).json({ success: false, message: 'Failed to update location' });
    }
  }

  // Get drinking statistics
  static async getStats(req, res) {
    try {
      const user = await User.findById(req.user._id).select('drinkingStats');
      res.json({ success: true, data: { drinkingStats: user.drinkingStats } });
    } catch (error) {
      console.error('Get stats error:', error);
      res.status(500).json({ success: false, message: 'Failed to get statistics' });
    }
  }

  // Update drinking statistics
  static async updateStats(req, res) {
    try {
      const { totalSessions, totalDrinks, favoriteAlcohol, averageRating } = req.body;
      const updates = {};

      if (totalSessions !== undefined) updates['drinkingStats.totalSessions'] = totalSessions;
      if (totalDrinks !== undefined) updates['drinkingStats.totalDrinks'] = totalDrinks;
      if (favoriteAlcohol !== undefined) updates['drinkingStats.favoriteAlcohol'] = favoriteAlcohol;
      if (averageRating !== undefined) updates['drinkingStats.averageRating'] = averageRating;

      const user = await User.findByIdAndUpdate(
        req.user._id,
        { $set: updates },
        { new: true }
      ).select('drinkingStats');

      res.json({ success: true, message: 'Statistics updated successfully', data: { drinkingStats: user.drinkingStats } });
    } catch (error) {
      console.error('Update stats error:', error);
      res.status(500).json({ success: false, message: 'Failed to update statistics' });
    }
  }

  // Deactivate account
  static async deactivateAccount(req, res) {
    try {
      await User.findByIdAndUpdate(req.user._id, {
        $set: { isActive: false, refreshTokens: [] }
      });

      res.json({ success: true, message: 'Account deactivated successfully' });
    } catch (error) {
      console.error('Deactivate account error:', error);
      res.status(500).json({ success: false, message: 'Failed to deactivate account' });
    }
  }
}

module.exports = ProfileController;
