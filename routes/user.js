const express = require('express');
const router = express.Router();
const UserController = require('../controllers/userController');
const { protect } = require('../middleware/auth');
const { uploadProfile } = require('../middleware/upload');

// Profile
router.get('/profile', protect, UserController.getProfile);
router.put('/profile', protect, UserController.updateProfile);
router.post('/profile/image', protect, uploadProfile.single('profileImage'), UserController.uploadProfileImage);

// Friends (must be before /:userId to avoid being caught)
router.get('/friends', protect, UserController.getFriends);
router.post('/friends/request', protect, UserController.sendFriendRequest);
router.put('/friends/respond', protect, UserController.respondToFriendRequest);
router.delete('/friends/:userId', protect, UserController.removeFriend);

// Search
router.get('/search', protect, UserController.searchUsers);

// Block / Unblock
router.post('/block/:userId', protect, UserController.blockUser);
router.post('/unblock/:userId', protect, UserController.unblockUser);
router.get('/blocked/list', protect, UserController.getBlockedUsers);

// Privacy settings
router.get('/privacy/settings', protect, UserController.getPrivacySettings);
router.put('/privacy/settings', protect, UserController.updatePrivacySettings);

// Change password (authenticated)
router.put('/change-password', protect, UserController.changePassword);

// Active sessions
router.get('/sessions/active', protect, UserController.getActiveSessions);
router.delete('/sessions/:tokenId', protect, UserController.removeSession);

// Download my data
router.get('/data/export', protect, UserController.exportMyData);

// Delete account
router.delete('/account/delete', protect, UserController.deleteAccount);

// Get user by ID (must be last - catches any /:userId)
router.get('/:userId', protect, UserController.getUserById);

module.exports = router;
