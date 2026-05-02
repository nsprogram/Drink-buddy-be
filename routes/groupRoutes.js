const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const GroupController = require('../controllers/groupController');

router.use(protect);

router.post('/', GroupController.create);
router.get('/', GroupController.list);
router.get('/:id', GroupController.get);
router.put('/:id', GroupController.update);
router.delete('/:id', GroupController.remove);
router.get('/:id/messages', GroupController.listMessages);
router.post('/:id/messages', GroupController.sendMessage);

module.exports = router;
