const router = require('express').Router();
const c = require('../../controllers/vendor/teamController');
const { vendorAuth } = require('../../middleware/vendorAuth');

router.use(vendorAuth);
router.get('/', c.list);
router.post('/invite', c.invite);
router.put('/:memberId', c.updateRole);
router.delete('/:memberId', c.remove);

module.exports = router;
