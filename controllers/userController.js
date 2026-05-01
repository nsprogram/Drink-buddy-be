const User = require('../models/User');
const { sendFriendRequestNotification, sendFriendAcceptedNotification } = require('../utils/notifications');
const path = require('path');
const fs = require('fs');

class UserController {
  // Get current user's profile
  static async getProfile(req, res) {
    try {
      const user = await User.findById(req.user._id)
        .populate('friends.user', 'firstName lastName fullName profileImage avatarEmoji avatarColor avatarId bio location isOnline lastSeen')
        .select('-password -refreshTokens -emailVerificationToken -passwordResetToken');

      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      res.json({ success: true, data: { user } });
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({ success: false, message: 'Failed to get profile' });
    }
  }

  // Update user profile
  static async updateProfile(req, res) {
    try {
      const {
        firstName, lastName, bio, location, age, dateOfBirth,
        avatarId, avatarEmoji, avatarColor, avatarName, profileImage, interestTags,
      } = req.body;
      const updates = {};

      if (firstName !== undefined) updates.firstName = String(firstName).trim();
      if (lastName !== undefined) updates.lastName = String(lastName).trim();
      if (bio !== undefined) updates.bio = String(bio).trim().substring(0, 500);
      if (location !== undefined) updates.location = String(location).trim().substring(0, 100);
      if (age !== undefined) updates.age = age;
      if (dateOfBirth !== undefined) updates.dateOfBirth = new Date(dateOfBirth);

      // Avatar fields — client sends null to clear, a value to set
      if (avatarId !== undefined) updates.avatarId = avatarId || null;
      if (avatarEmoji !== undefined) updates.avatarEmoji = avatarEmoji || null;
      if (avatarColor !== undefined) updates.avatarColor = avatarColor || null;
      if (avatarName !== undefined) updates.avatarName = avatarName || null;

      // Allow clearing profileImage explicitly (when switching to emoji avatar)
      if (profileImage === null || profileImage === '') updates.profileImage = null;

      // Interest tags (array of strings, max 8)
      if (Array.isArray(interestTags)) {
        updates.interestTags = interestTags
          .map(t => String(t).trim())
          .filter(Boolean)
          .slice(0, 8);
      }

      if (updates.firstName || updates.lastName) {
        const current = await User.findById(req.user._id);
        updates.fullName = `${updates.firstName || current.firstName} ${updates.lastName || current.lastName}`;
      }

      const user = await User.findByIdAndUpdate(
        req.user._id,
        { $set: updates },
        { new: true, runValidators: true }
      ).select('-password -refreshTokens -emailVerificationToken -passwordResetToken');

      res.json({ success: true, message: 'Profile updated successfully', data: { user } });
    } catch (error) {
      console.error('Update profile error:', error);
      if (error.name === 'ValidationError') {
        const errors = Object.values(error.errors).map(err => ({ field: err.path, message: err.message }));
        return res.status(400).json({ success: false, message: 'Validation failed', errors });
      }
      res.status(500).json({ success: false, message: 'Failed to update profile' });
    }
  }

  // Get friends list
  static async getFriends(req, res) {
    try {
      const user = await User.findById(req.user._id)
        .populate('friends.user', 'firstName lastName fullName profileImage avatarEmoji avatarColor avatarId bio location isOnline lastSeen');

      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      // Filter only accepted friends by default, or by status query
      const { status } = req.query;
      let friends = user.friends;
      if (status) {
        friends = friends.filter(f => f.status === status);
      }

      res.json({ success: true, data: { friends, totalFriends: friends.length } });
    } catch (error) {
      console.error('Get friends error:', error);
      res.status(500).json({ success: false, message: 'Failed to get friends' });
    }
  }

  // Send friend request
  static async sendFriendRequest(req, res) {
    try {
      const { userId } = req.body;
      const currentUserId = req.user._id;

      if (userId === currentUserId.toString()) {
        return res.status(400).json({ success: false, message: 'You cannot send a friend request to yourself' });
      }

      const targetUser = await User.findById(userId);
      if (!targetUser) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      const currentUser = await User.findById(currentUserId);

      // Check if already friends or request pending
      const existingFriendship = currentUser.friends.find(f => f.user.toString() === userId);
      if (existingFriendship) {
        return res.status(400).json({ success: false, message: `Friend request already ${existingFriendship.status}` });
      }

      // Add pending friendship to both users
      currentUser.friends.push({ user: userId, status: 'pending', addedAt: new Date() });
      targetUser.friends.push({ user: currentUserId, status: 'pending', addedAt: new Date() });

      await currentUser.save();
      await targetUser.save();

      // Send notification to target user
      sendFriendRequestNotification(userId, currentUser).catch(() => {});

      res.json({ success: true, message: 'Friend request sent successfully' });
    } catch (error) {
      console.error('Send friend request error:', error);
      res.status(500).json({ success: false, message: 'Failed to send friend request' });
    }
  }

  // Respond to friend request (accept/decline)
  static async respondToFriendRequest(req, res) {
    try {
      const { userId, action } = req.body; // action: 'accept' | 'decline'
      const currentUserId = req.user._id;

      if (!['accept', 'decline'].includes(action)) {
        return res.status(400).json({ success: false, message: 'Action must be "accept" or "decline"' });
      }

      const currentUser = await User.findById(currentUserId);
      const requesterUser = await User.findById(userId);

      if (!requesterUser) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      const friendEntry = currentUser.friends.find(f => f.user.toString() === userId && f.status === 'pending');
      if (!friendEntry) {
        return res.status(404).json({ success: false, message: 'Friend request not found' });
      }

      if (action === 'accept') {
        friendEntry.status = 'accepted';
        const requesterFriendEntry = requesterUser.friends.find(f => f.user.toString() === currentUserId.toString());
        if (requesterFriendEntry) requesterFriendEntry.status = 'accepted';
        await requesterUser.save();
        await currentUser.save();
        // Notify the requester that their request was accepted
        sendFriendAcceptedNotification(userId, currentUser).catch(() => {});
        res.json({ success: true, message: 'Friend request accepted' });
      } else {
        currentUser.friends = currentUser.friends.filter(f => f.user.toString() !== userId);
        requesterUser.friends = requesterUser.friends.filter(f => f.user.toString() !== currentUserId.toString());
        await requesterUser.save();
        await currentUser.save();
        res.json({ success: true, message: 'Friend request declined' });
      }
    } catch (error) {
      console.error('Respond to friend request error:', error);
      res.status(500).json({ success: false, message: 'Failed to respond to friend request' });
    }
  }

  // Remove friend
  static async removeFriend(req, res) {
    try {
      const { userId } = req.params;
      const currentUserId = req.user._id;

      await User.findByIdAndUpdate(currentUserId, {
        $pull: { friends: { user: userId } }
      });

      await User.findByIdAndUpdate(userId, {
        $pull: { friends: { user: currentUserId } }
      });

      res.json({ success: true, message: 'Friend removed successfully' });
    } catch (error) {
      console.error('Remove friend error:', error);
      res.status(500).json({ success: false, message: 'Failed to remove friend' });
    }
  }

  // Search users
  static async searchUsers(req, res) {
    try {
      const { q, limit = 20, page = 1 } = req.query;

      if (!q || q.trim().length < 2) {
        return res.status(400).json({ success: false, message: 'Search query must be at least 2 characters' });
      }

      const skip = (page - 1) * limit;
      const escaped = q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escaped, 'i');

      const users = await User.find({
        _id: { $ne: req.user._id },
        isActive: true,
        isBlocked: false,
        $or: [
          { firstName: searchRegex },
          { lastName: searchRegex },
          { fullName: searchRegex },
          { email: searchRegex }
        ]
      })
        .select('firstName lastName fullName profileImage avatarEmoji avatarColor avatarId bio location isOnline')
        .skip(skip)
        .limit(parseInt(limit));

      const total = await User.countDocuments({
        _id: { $ne: req.user._id },
        isActive: true,
        $or: [
          { firstName: searchRegex },
          { lastName: searchRegex },
          { fullName: searchRegex }
        ]
      });

      res.json({
        success: true,
        data: { users, total, page: parseInt(page), pages: Math.ceil(total / limit) }
      });
    } catch (error) {
      console.error('Search users error:', error);
      res.status(500).json({ success: false, message: 'Failed to search users' });
    }
  }

  // Block a user
  static async blockUser(req, res) {
    try {
      const { userId } = req.params;
      const currentUserId = req.user._id;

      await User.findByIdAndUpdate(currentUserId, {
        $addToSet: { blockedUsers: userId },
        $pull: { friends: { user: userId } }
      });

      await User.findByIdAndUpdate(userId, {
        $pull: { friends: { user: currentUserId } }
      });

      res.json({ success: true, message: 'User blocked successfully' });
    } catch (error) {
      console.error('Block user error:', error);
      res.status(500).json({ success: false, message: 'Failed to block user' });
    }
  }

  // Upload profile image
  static async uploadProfileImage(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No image file provided' });
      }

      const imageUrl = `/uploads/profiles/${req.file.filename}`;

      // Delete old profile image if exists
      const oldUser = await User.findById(req.user._id);
      if (oldUser && oldUser.profileImage) {
        const oldPath = path.join(__dirname, '..', oldUser.profileImage);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }

      const user = await User.findByIdAndUpdate(
        req.user._id,
        { $set: { profileImage: imageUrl } },
        { new: true }
      ).select('-password -refreshTokens -emailVerificationToken -passwordResetToken');

      res.json({ success: true, message: 'Profile image updated', data: { user, imageUrl } });
    } catch (error) {
      console.error('Upload profile image error:', error);
      res.status(500).json({ success: false, message: 'Failed to upload profile image' });
    }
  }

  // Unblock a user
  static async unblockUser(req, res) {
    try {
      const { userId } = req.params;
      await User.findByIdAndUpdate(req.user._id, {
        $pull: { blockedUsers: userId }
      });
      res.json({ success: true, message: 'User unblocked' });
    } catch (error) {
      console.error('Unblock error:', error);
      res.status(500).json({ success: false, message: 'Failed to unblock user' });
    }
  }

  // Get blocked users list
  static async getBlockedUsers(req, res) {
    try {
      const user = await User.findById(req.user._id)
        .populate('blockedUsers', 'firstName lastName profileImage');
      res.json({ success: true, data: { blockedUsers: user.blockedUsers || [] } });
    } catch (error) {
      console.error('Get blocked users error:', error);
      res.status(500).json({ success: false, message: 'Failed to get blocked users' });
    }
  }

  // Get privacy settings
  static async getPrivacySettings(req, res) {
    try {
      const user = await User.findById(req.user._id).select('privacySettings');
      res.json({
        success: true,
        data: {
          readReceipts: user.privacySettings?.readReceipts ?? true,
          locationSharing: user.privacySettings?.locationSharing ?? false,
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to get privacy settings' });
    }
  }

  // Update privacy settings
  static async updatePrivacySettings(req, res) {
    try {
      const { readReceipts, locationSharing } = req.body;
      const update = {};
      if (readReceipts !== undefined) update['privacySettings.readReceipts'] = readReceipts;
      if (locationSharing !== undefined) update['privacySettings.locationSharing'] = locationSharing;

      await User.findByIdAndUpdate(req.user._id, { $set: update });
      res.json({ success: true, message: 'Privacy settings updated' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to update privacy settings' });
    }
  }

  // Change password (authenticated)
  static async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ success: false, message: 'Both current and new password required' });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
      }
      const user = await User.findById(req.user._id).select('+password');
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });

      const isMatch = await user.comparePassword(currentPassword);
      if (!isMatch) {
        return res.status(401).json({ success: false, message: 'Current password is incorrect' });
      }
      user.password = newPassword;
      await user.save();
      res.json({ success: true, message: 'Password changed successfully' });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({ success: false, message: 'Failed to change password' });
    }
  }

  // Get active sessions
  static async getActiveSessions(req, res) {
    try {
      const user = await User.findById(req.user._id).select('refreshTokens');
      const sessions = (user.refreshTokens || []).map((rt, i) => ({
        id: rt._id || String(i),
        device: rt.device || 'Unknown Device',
        createdAt: rt.createdAt,
        isCurrent: false, // Could compare with current token
      }));
      res.json({ success: true, data: { sessions } });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to get sessions' });
    }
  }

  // Remove a specific session
  static async removeSession(req, res) {
    try {
      const { tokenId } = req.params;
      await User.findByIdAndUpdate(req.user._id, {
        $pull: { refreshTokens: { _id: tokenId } }
      });
      res.json({ success: true, message: 'Session removed' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to remove session' });
    }
  }

  // Export user data
  static async exportMyData(req, res) {
    try {
      const user = await User.findById(req.user._id)
        .select('-password -refreshTokens -emailVerificationToken -passwordResetToken -loginOTP')
        .populate('friends.user', 'firstName lastName email')
        .populate('blockedUsers', 'firstName lastName');

      const data = {
        profile: {
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          bio: user.bio,
          location: user.location,
          createdAt: user.createdAt,
        },
        stats: user.drinkingStats,
        friends: (user.friends || []).filter(f => f.status === 'accepted').map(f => ({
          name: `${f.user?.firstName || ''} ${f.user?.lastName || ''}`.trim(),
          addedAt: f.addedAt,
        })),
        preferences: user.preferences,
        privacySettings: user.privacySettings,
        blockedUsers: (user.blockedUsers || []).map(b => `${b.firstName} ${b.lastName}`),
        exportedAt: new Date().toISOString(),
      };
      res.json({ success: true, data });
    } catch (error) {
      console.error('Export data error:', error);
      res.status(500).json({ success: false, message: 'Failed to export data' });
    }
  }

  // Delete account permanently
  static async deleteAccount(req, res) {
    try {
      const { password } = req.body;
      if (!password) {
        return res.status(400).json({ success: false, message: 'Password required to delete account' });
      }
      const user = await User.findById(req.user._id).select('+password');
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });

      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({ success: false, message: 'Incorrect password' });
      }

      // Remove from all friends lists
      await User.updateMany(
        { 'friends.user': req.user._id },
        { $pull: { friends: { user: req.user._id } } }
      );
      // Delete the user
      await User.findByIdAndDelete(req.user._id);
      res.json({ success: true, message: 'Account deleted permanently' });
    } catch (error) {
      console.error('Delete account error:', error);
      res.status(500).json({ success: false, message: 'Failed to delete account' });
    }
  }

  // Get user by ID (public profile)
  static async getUserById(req, res) {
    try {
      const { userId } = req.params;

      const user = await User.findById(userId)
        .select('firstName lastName fullName profileImage coverImage bio location isOnline lastSeen drinkingStats createdAt');

      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      res.json({ success: true, data: { user } });
    } catch (error) {
      console.error('Get user by ID error:', error);
      res.status(500).json({ success: false, message: 'Failed to get user' });
    }
  }
}

module.exports = UserController;
