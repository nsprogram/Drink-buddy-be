const express = require('express');
const router = express.Router();
const SessionController = require('../controllers/sessionController');
const { protect } = require('../middleware/auth');

router.use(protect);

// New session lifecycle endpoints
router.post('/start', SessionController.startSession);
router.get('/active', SessionController.getActiveSession);
router.post('/:sessionId/add-drink', SessionController.addDrink);
router.post('/:sessionId/end', SessionController.endSession);
router.post('/:sessionId/finalize', SessionController.finalizeSession);
router.put('/:sessionId/edit', SessionController.editSession);

// Legacy + history endpoints
router.post('/save', SessionController.saveSession);
router.get('/history', SessionController.getSessionHistory);
router.delete('/:sessionId', SessionController.deleteSession);

module.exports = router;
