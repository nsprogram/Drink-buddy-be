const router = require('express').Router();
const c = require('../../controllers/vendor/notificationsController');
const { vendorAuth } = require('../../middleware/vendorAuth');

router.use(vendorAuth);
router.get('/', c.list);
router.post('/:id/read', c.markRead);
router.post('/read-all', c.markAllRead);
router.delete('/:id', c.remove);

module.exports = router;
