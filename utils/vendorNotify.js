const Vendor = require('../models/Vendor');

/**
 * Push a notification onto a vendor's embedded notifications array.
 * Non-blocking for callers — errors are logged but never thrown.
 * @param {ObjectId|String} vendorId
 * @param {{ type?: string, title: string, message?: string, link?: string, meta?: object }} n
 */
async function pushVendorNotification(vendorId, n) {
  try {
    if (!vendorId || !n || !n.title) return;
    await Vendor.updateOne(
      { _id: vendorId },
      { $push: { notifications: { $each: [{ ...n, read: false, createdAt: new Date() }], $position: 0, $slice: 200 } } }
    );
  } catch (e) {
    console.error('[vendorNotify] failed:', e.message);
  }
}

module.exports = { pushVendorNotification };
