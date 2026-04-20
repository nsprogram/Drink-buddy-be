const router = require('express').Router();
const c = require('../../controllers/vendor/inventoryController');
const { vendorAuth } = require('../../middleware/vendorAuth');

router.use(vendorAuth);
router.get('/', c.list);
router.post('/', c.create);
router.put('/:id', c.update);
router.delete('/:id', c.remove);
router.post('/:id/restock', c.restock);

module.exports = router;
