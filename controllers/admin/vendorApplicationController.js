const Vendor = require('../../models/Vendor');
const { sendEmail } = require('../../utils/emailService');

/**
 * List all vendor applications
 * GET /api/admin/vendor-applications
 * PRD Section 11: Admin Review API
 */
exports.listApplications = async (req, res) => {
  try {
    const { status, page = 1, limit = 20, search } = req.query;
    
    // Build query
    const query = {};
    
    if (status) {
      query.status = status;
    }
    
    if (search) {
      query.$or = [
        { businessName: { $regex: search, $options: 'i' } },
        { legalName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Pagination
    const skip = (page - 1) * limit;
    
    const [applications, total] = await Promise.all([
      Vendor.find(query)
        .select('businessName legalName vendorType email phone status documents createdAt rejectionReason')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Vendor.countDocuments(query)
    ]);
    
    res.json({ 
      success: true, 
      data: { 
        applications,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('List applications error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

/**
 * Get single application details
 * GET /api/admin/vendor-applications/:id
 * PRD Section 5: Stage 2 - Verification
 */
exports.getApplication = async (req, res) => {
  try {
    const { id } = req.params;
    
    const vendor = await Vendor.findById(id);
    
    if (!vendor) {
      return res.status(404).json({ 
        success: false, 
        message: 'Vendor application not found' 
      });
    }
    
    res.json({ 
      success: true, 
      data: { vendor }
    });
  } catch (error) {
    console.error('Get application error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

/**
 * Approve vendor application
 * PUT /api/admin/vendor-applications/:id/approve
 * PRD Section 5: Stage 3 - Approval
 */
exports.approveApplication = async (req, res) => {
  try {
    const { id } = req.params;
    
    const vendor = await Vendor.findById(id);
    
    if (!vendor) {
      return res.status(404).json({ 
        success: false, 
        message: 'Vendor not found' 
      });
    }
    
    // Validate current status
    if (!['submitted', 'under_review'].includes(vendor.status)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Can only approve submitted or under review applications' 
      });
    }
    
    // Update status (PRD Section 8)
    vendor.status = 'approved';
    vendor.isVerified = true;
    vendor.isActive = true;
    vendor.rejectionReason = null;
    
    // Approve all documents
    vendor.documents.forEach(doc => {
      doc.status = 'approved';
    });
    
    await vendor.save();
    
    // Send approval email
    try {
      await sendEmail({
        to: vendor.email,
        subject: 'Application Approved - Welcome to DrinkBuddy!',
        html: `
          <h2>Congratulations! Your Application is Approved</h2>
          <p>Dear ${vendor.ownerName || vendor.businessName},</p>
          <p>We're excited to inform you that your vendor application has been approved!</p>
          <p>You can now access your dashboard and start managing your business on DrinkBuddy.</p>
          <p><a href="${process.env.VENDOR_DASHBOARD_URL || 'http://localhost:5173'}/login">Login to Dashboard</a></p>
          <p>Welcome to the DrinkBuddy family!</p>
        `
      });
    } catch (emailError) {
      console.error('Failed to send approval email:', emailError);
    }
    
    res.json({ 
      success: true, 
      message: 'Vendor application approved successfully',
      data: { vendor }
    });
  } catch (error) {
    console.error('Approve application error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

/**
 * Reject vendor application
 * PUT /api/admin/vendor-applications/:id/reject
 * PRD Section 5: Stage 3 - Rejection
 */
exports.rejectApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    if (!reason) {
      return res.status(400).json({ 
        success: false, 
        message: 'Rejection reason is required' 
      });
    }
    
    const vendor = await Vendor.findById(id);
    
    if (!vendor) {
      return res.status(404).json({ 
        success: false, 
        message: 'Vendor not found' 
      });
    }
    
    // Validate current status
    if (!['submitted', 'under_review'].includes(vendor.status)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Can only reject submitted or under review applications' 
      });
    }
    
    // Update status (PRD Section 8)
    vendor.status = 'rejected';
    vendor.rejectionReason = reason;
    vendor.isVerified = false;
    
    await vendor.save();
    
    // Send rejection email
    try {
      await sendEmail({
        to: vendor.email,
        subject: 'Application Update - DrinkBuddy Vendor',
        html: `
          <h2>Application Review Update</h2>
          <p>Dear ${vendor.ownerName || vendor.businessName},</p>
          <p>Thank you for your interest in becoming a DrinkBuddy vendor.</p>
          <p>After reviewing your application, we need you to address the following:</p>
          <p><strong>Reason:</strong> ${reason}</p>
          <p>Please update your application and resubmit for review.</p>
          <p><a href="${process.env.VENDOR_DASHBOARD_URL || 'http://localhost:5173'}/application">Update Application</a></p>
        `
      });
    } catch (emailError) {
      console.error('Failed to send rejection email:', emailError);
    }
    
    res.json({ 
      success: true, 
      message: 'Vendor application rejected',
      data: { vendor }
    });
  } catch (error) {
    console.error('Reject application error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

/**
 * Set application to under review
 * PUT /api/admin/vendor-applications/:id/under-review
 * PRD Section 5: Stage 2 - Verification
 */
exports.setUnderReview = async (req, res) => {
  try {
    const { id } = req.params;
    
    const vendor = await Vendor.findById(id);
    
    if (!vendor) {
      return res.status(404).json({ 
        success: false, 
        message: 'Vendor not found' 
      });
    }
    
    // Allow setting to under_review from submitted or draft status
    if (!['submitted', 'draft'].includes(vendor.status)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Can only set submitted or draft applications to under review' 
      });
    }
    
    vendor.status = 'under_review';
    await vendor.save();
    
    // Send notification email
    try {
      await sendEmail({
        to: vendor.email,
        subject: 'Application Under Review - DrinkBuddy Vendor',
        html: `
          <h2>Application Under Review</h2>
          <p>Dear ${vendor.ownerName || vendor.businessName},</p>
          <p>Good news! Your vendor application is now under review by our team.</p>
          <p>We'll notify you once the review is complete.</p>
          <p>Thank you for your patience!</p>
        `
      });
    } catch (emailError) {
      console.error('Failed to send under review email:', emailError);
    }
    
    res.json({ 
      success: true, 
      message: 'Application set to under review',
      data: { vendor }
    });
  } catch (error) {
    console.error('Set under review error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

/**
 * Suspend vendor account
 * PUT /api/admin/vendor-applications/:id/suspend
 * PRD Section 8: Vendor Account Status
 */
exports.suspendVendor = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    const vendor = await Vendor.findById(id);
    
    if (!vendor) {
      return res.status(404).json({ 
        success: false, 
        message: 'Vendor not found' 
      });
    }
    
    // Update status (PRD Section 8)
    vendor.status = 'suspended';
    vendor.isActive = false;
    vendor.rejectionReason = reason || 'Account suspended by admin';
    
    await vendor.save();
    
    // Send suspension email
    try {
      await sendEmail({
        to: vendor.email,
        subject: 'Account Suspended - DrinkBuddy Vendor',
        html: `
          <h2>Account Suspended</h2>
          <p>Dear ${vendor.ownerName || vendor.businessName},</p>
          <p>Your vendor account has been suspended.</p>
          ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
          <p>Please contact support for more information.</p>
        `
      });
    } catch (emailError) {
      console.error('Failed to send suspension email:', emailError);
    }
    
    res.json({ 
      success: true, 
      message: 'Vendor account suspended',
      data: { vendor }
    });
  } catch (error) {
    console.error('Suspend vendor error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

/**
 * Reactivate suspended vendor
 * PUT /api/admin/vendor-applications/:id/reactivate
 */
exports.reactivateVendor = async (req, res) => {
  try {
    const { id } = req.params;
    
    const vendor = await Vendor.findById(id);
    
    if (!vendor) {
      return res.status(404).json({ 
        success: false, 
        message: 'Vendor not found' 
      });
    }
    
    if (vendor.status !== 'suspended') {
      return res.status(400).json({ 
        success: false, 
        message: 'Can only reactivate suspended vendors' 
      });
    }
    
    vendor.status = 'approved';
    vendor.isActive = true;
    vendor.rejectionReason = null;
    
    await vendor.save();
    
    res.json({ 
      success: true, 
      message: 'Vendor account reactivated',
      data: { vendor }
    });
  } catch (error) {
    console.error('Reactivate vendor error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

/**
 * Approve basic info (Stage 1)
 * POST /api/admin/vendor-applications/:id/approve-basic
 */
exports.approveBasicInfo = async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

    vendor.basicInfoStatus = 'basic_approved';
    vendor.basicInfoReviewedAt = new Date();
    vendor.basicInfoRejectionReason = undefined;
    await vendor.save();

    try {
      await sendEmail({
        to: vendor.email,
        subject: 'Basic Info Approved - DrinkBuddy Vendor',
        html: `<h2>Basic Info Approved</h2><p>Dear ${vendor.ownerName || vendor.businessName},</p><p>Your basic business info has been approved. You can now access your dashboard in limited mode and begin KYC submission.</p>`
      });
    } catch (e) { console.error('Email failed:', e); }

    res.json({ success: true, message: 'Basic info approved', data: { vendor } });
  } catch (error) {
    console.error('Approve basic info error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Reject basic info (Stage 1)
 * POST /api/admin/vendor-applications/:id/reject-basic
 */
exports.rejectBasicInfo = async (req, res) => {
  try {
    const { reason } = req.body || {};
    if (!reason) return res.status(400).json({ success: false, message: 'Rejection reason is required' });

    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

    vendor.basicInfoStatus = 'basic_rejected';
    vendor.basicInfoRejectionReason = reason;
    vendor.basicInfoReviewedAt = new Date();
    await vendor.save();

    try {
      await sendEmail({
        to: vendor.email,
        subject: 'Basic Info Needs Attention - DrinkBuddy Vendor',
        html: `<h2>Basic Info Rejected</h2><p>Dear ${vendor.ownerName || vendor.businessName},</p><p><strong>Reason:</strong> ${reason}</p><p>Please update your basic info and resubmit.</p>`
      });
    } catch (e) { console.error('Email failed:', e); }

    res.json({ success: true, message: 'Basic info rejected', data: { vendor } });
  } catch (error) {
    console.error('Reject basic info error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Approve KYC (Stage 2)
 * POST /api/admin/vendor-applications/:id/approve-kyc
 */
exports.approveKyc = async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

    vendor.kycStatus = 'kyc_approved';
    vendor.kycReviewedAt = new Date();
    vendor.kycRejectionReason = undefined;
    // Legacy back-compat: flip main status/flags
    vendor.status = 'approved';
    vendor.isVerified = true;
    vendor.isActive = true;
    vendor.rejectionReason = null;
    vendor.documents.forEach(doc => { doc.status = 'approved'; });

    await vendor.save();

    try {
      await sendEmail({
        to: vendor.email,
        subject: 'KYC Approved - Welcome to DrinkBuddy!',
        html: `<h2>KYC Approved</h2><p>Dear ${vendor.ownerName || vendor.businessName},</p><p>Your KYC has been approved. Your vendor account is now fully active.</p>`
      });
    } catch (e) { console.error('Email failed:', e); }

    res.json({ success: true, message: 'KYC approved', data: { vendor } });
  } catch (error) {
    console.error('Approve KYC error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Reject KYC (Stage 2)
 * POST /api/admin/vendor-applications/:id/reject-kyc
 */
exports.rejectKyc = async (req, res) => {
  try {
    const { reason } = req.body || {};
    if (!reason) return res.status(400).json({ success: false, message: 'Rejection reason is required' });

    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

    vendor.kycStatus = 'kyc_rejected';
    vendor.kycRejectionReason = reason;
    vendor.kycReviewedAt = new Date();
    await vendor.save();

    try {
      await sendEmail({
        to: vendor.email,
        subject: 'KYC Needs Attention - DrinkBuddy Vendor',
        html: `<h2>KYC Rejected</h2><p>Dear ${vendor.ownerName || vendor.businessName},</p><p><strong>Reason:</strong> ${reason}</p><p>Please update your KYC documents and resubmit.</p>`
      });
    } catch (e) { console.error('Email failed:', e); }

    res.json({ success: true, message: 'KYC rejected', data: { vendor } });
  } catch (error) {
    console.error('Reject KYC error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get application statistics
 * GET /api/admin/vendor-applications/stats
 */
exports.getStats = async (req, res) => {
  try {
    const stats = await Vendor.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const statsObj = {
      draft: 0,
      submitted: 0,
      under_review: 0,
      approved: 0,
      rejected: 0,
      suspended: 0,
      inactive: 0,
      total: 0
    };
    
    stats.forEach(stat => {
      statsObj[stat._id] = stat.count;
      statsObj.total += stat.count;
    });
    
    res.json({ 
      success: true, 
      data: { stats: statsObj }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};
