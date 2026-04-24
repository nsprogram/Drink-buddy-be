const Vendor = require('../../models/Vendor');

/**
 * Submit KYC documents (Stage 2)
 * POST /api/vendor/kyc/submit
 * Body: { documents?: [...] } — documents optional; existing upload-document endpoint
 * already attaches files to the vendor's documents array.
 */
exports.submitKyc = async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.vendor._id);
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }

    if (vendor.basicInfoStatus !== 'basic_approved') {
      return res.status(400).json({
        success: false,
        message: 'Basic info must be approved before submitting KYC'
      });
    }

    if (vendor.kycStatus === 'kyc_pending') {
      return res.status(400).json({ success: false, message: 'KYC already pending review' });
    }
    if (vendor.kycStatus === 'kyc_approved') {
      return res.status(400).json({ success: false, message: 'KYC already approved' });
    }

    const { documents } = req.body || {};
    if (Array.isArray(documents) && documents.length > 0) {
      documents.forEach(d => {
        if (d && d.type && d.url) {
          const existingIdx = vendor.documents.findIndex(x => x.type === d.type);
          const docData = {
            type: d.type,
            url: d.url,
            status: 'pending',
            uploadedAt: new Date(),
          };
          if (existingIdx >= 0) vendor.documents[existingIdx] = docData;
          else vendor.documents.push(docData);
        }
      });
    }

    vendor.kycStatus = 'kyc_pending';
    vendor.kycSubmittedAt = new Date();
    vendor.kycRejectionReason = undefined;

    await vendor.save();

    res.json({
      success: true,
      message: 'KYC submitted for review',
      data: {
        kycStatus: vendor.kycStatus,
        kycSubmittedAt: vendor.kycSubmittedAt,
        documents: vendor.documents,
      }
    });
  } catch (error) {
    console.error('Submit KYC error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get KYC status
 * GET /api/vendor/kyc/status
 */
exports.getKycStatus = async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.vendor._id)
      .select('kycStatus kycRejectionReason kycSubmittedAt kycReviewedAt documents');
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }

    res.json({
      success: true,
      data: {
        kycStatus: vendor.kycStatus || 'not_submitted',
        kycRejectionReason: vendor.kycRejectionReason || null,
        kycSubmittedAt: vendor.kycSubmittedAt || null,
        kycReviewedAt: vendor.kycReviewedAt || null,
        documents: vendor.documents || [],
      }
    });
  } catch (error) {
    console.error('Get KYC status error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
