const express = require('express');
const router = express.Router();
const ChatBotController = require('../controllers/chatbotController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.post('/ask', ChatBotController.askBot);

module.exports = router;
