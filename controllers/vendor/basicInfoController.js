const Vendor = require('../../models/Vendor');

/**
 * Submit / resubmit basic info (Stage 1 of two-stage approval)
 * POST /api/vendor/basic-info
 */
exports.submitBasicInfo = async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.vendor._id);
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }

    if (vendor.basicInfoStatus === 'basic_pending') {
      return res.status(400).json({ success: false, message: 'Basic info already pending review' });
    }
    if (vendor.basicInfoStatus === 'basic_approved') {
      return res.status(400).json({ success: false, message: 'Basic info already approved' });
    }

    const { name, businessName, phone, address } = req.body || {};

    if (!businessName || !phone) {
      return res.status(400).json({ success: false, message: 'businessName and phone are required' });
    }

    if (name) vendor.ownerName = name;
    if (businessName) vendor.businessName = businessName;
    if (phone) vendor.phone = phone;
    // email is readonly/ignored per spec

    if (address && typeof address === 'object') {
      vendor.address = vendor.address || {};
      if (address.line1 !== undefined) vendor.address.line1 = address.line1;
      if (address.city !== undefined) vendor.address.city = address.city;
      if (address.state !== undefined) vendor.address.state = address.state;
      if (address.pincode !== undefined) vendor.address.postalCode = address.pincode;
      if (address.country !== undefined) vendor.address.country = address.country;
    }

    vendor.basicInfoStatus = 'basic_pending';
    vendor.basicInfoSubmittedAt = new Date();
    vendor.basicInfoRejectionReason = undefined;

    await vendor.save();

    res.json({
      success: true,
      message: 'Basic info submitted for review',
      data: {
        basicInfoStatus: vendor.basicInfoStatus,
        basicInfoSubmittedAt: vendor.basicInfoSubmittedAt,
      }
    });
  } catch (error) {
    console.error('Submit basic info error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get basic info status
 * GET /api/vendor/basic-info/status
 */
exports.getBasicInfoStatus = async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.vendor._id)
      .select('basicInfoStatus basicInfoRejectionReason basicInfoSubmittedAt basicInfoReviewedAt');
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }

    res.json({
      success: true,
      data: {
        basicInfoStatus: vendor.basicInfoStatus || 'not_submitted',
        basicInfoRejectionReason: vendor.basicInfoRejectionReason || null,
        basicInfoSubmittedAt: vendor.basicInfoSubmittedAt || null,
        basicInfoReviewedAt: vendor.basicInfoReviewedAt || null,
      }
    });
  } catch (error) {
    console.error('Get basic info status error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
