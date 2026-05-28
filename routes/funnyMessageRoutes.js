const express = require('express');
const router = express.Router();
const FunnyMessageController = require('../controllers/funnyMessageController');
const { protect, adminOnly } = require('../middleware/auth');

// Public routes (for app users) - NO admin required
// /random is fully public (no auth) so the mobile app can fetch without token gating
router.get('/active', FunnyMessageController.getActiveMessages);
router.get('/random', FunnyMessageController.getRandomMessage);

// Admin routes - require admin privileges
router.get('/admin/all', protect, adminOnly, FunnyMessageController.getAllMessages);
router.post('/admin/create', protect, adminOnly, FunnyMessageController.createMessage);
router.put('/admin/:messageId', protect, adminOnly, FunnyMessageController.updateMessage);
router.delete('/admin/:messageId', protect, adminOnly, FunnyMessageController.deleteMessage);
router.patch('/admin/:messageId/toggle', protect, adminOnly, FunnyMessageController.toggleMessageStatus);

module.exports = router;
