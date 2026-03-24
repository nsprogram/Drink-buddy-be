const express = require('express');
const router = express.Router();
const SessionController = require('../controllers/sessionController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.post('/save', SessionController.saveSession);
router.get('/history', SessionController.getSessionHistory);
router.delete('/:sessionId', SessionController.deleteSession);

module.exports = router;
