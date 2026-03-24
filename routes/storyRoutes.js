const express = require('express');
const multer = require('multer');
const router = express.Router();
const StoryController = require('../controllers/storyController');
const { protect } = require('../middleware/auth');

const upload = multer({
  dest: require('os').tmpdir(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) cb(null, true);
    else cb(new Error('Only image and video files are allowed'), false);
  }
});

router.post('/create', protect, upload.single('media'), StoryController.createStory);
router.get('/friends', protect, StoryController.getFriendsStories);
router.get('/user/:userId', protect, StoryController.getUserStories);
router.post('/view/:userId/:storyId', protect, StoryController.viewStory);
router.delete('/:storyId', protect, StoryController.deleteStory);
router.post('/cleanup', protect, StoryController.cleanupExpiredStories);

module.exports = router;
