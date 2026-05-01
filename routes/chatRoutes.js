const express = require('express');
const multer = require('multer');
const router = express.Router();
const ChatController = require('../controllers/chatController');
const { protect } = require('../middleware/auth');
const { uploadChat } = require('../config/cloudinary');

const voiceUpload = multer({
  dest: require('os').tmpdir(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) cb(null, true);
    else cb(new Error('Only audio files are allowed'), false);
  }
});

router.use(protect);

// Messages
router.get('/messages/:friendId', ChatController.getMessages);
router.post('/send', ChatController.sendMessage);
router.post('/send-voice', voiceUpload.single('voice'), ChatController.sendMessage);
router.put('/messages/:messageId/edit', ChatController.editMessage);
router.post('/messages/:messageId/react', ChatController.addReaction);
router.post('/messages/:messageId/pin', ChatController.pinMessage);
router.delete('/messages/:friendId/clear', ChatController.clearChat);
router.delete('/messages/:messageId', ChatController.deleteMessage);

// File uploads
const mediaUpload = multer({
  dest: require('os').tmpdir(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) cb(null, true);
    else cb(new Error('Only image/video files allowed'), false);
  }
});
router.post('/upload-image', uploadChat.single('chatImage'), ChatController.uploadChatImage);
router.post('/upload-video', mediaUpload.single('chatVideo'), ChatController.uploadChatVideo);
router.post('/upload-voice', voiceUpload.single('voice'), ChatController.uploadVoiceMessage);

// Online status
router.post('/status', ChatController.updateOnlineStatus);

// Conversations
router.get('/conversations', ChatController.getConversations);
router.put('/mark-read/:friendId', ChatController.markAsRead);

// Real-time streaming (SSE)
router.get('/stream/:friendId', ChatController.streamMessages);

module.exports = router;
