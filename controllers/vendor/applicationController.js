const Vendor = require('../../models/Vendor');
const { sendEmail } = require('../../utils/emailService');

/**
 * Submit vendor application for review
 * POST /api/vendor/apply
 * PRD Section 5: Vendor Onboarding Flow
 */
exports.submitApplication = async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.vendor._id);
    
    if (!vendor) {
      return res.status(404).json({ 
        success: false, 
        message: 'Vendor not found' 
      });
    }
    
    // Validate application is in draft status
    if (vendor.status !== 'draft') {
      return res.status(400).json({ 
        success: false, 
        message: 'Application already submitted' 
      });
    }
    
    // Validate required fields (PRD Section 7.1)
    const requiredFields = ['businessName', 'legalName', 'vendorType', 'email', 'phone'];
    const missingFields = requiredFields.filter(field => !vendor[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `Missing required fields: ${missingFields.join(', ')}` 
      });
    }
    
    // Validate required documents (PRD Section 7.2)
    const requiredDocTypes = ['business_registration', 'owner_id', 'venue_license', 'tax_document'];
    const uploadedDocTypes = vendor.documents.map(d => d.type);
    const missingDocs = requiredDocTypes.filter(type => !uploadedDocTypes.includes(type));
    
    if (missingDocs.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `Missing required documents: ${missingDocs.join(', ')}` 
      });
    }
    
    // Update status to submitted
    vendor.status = 'submitted';
    await vendor.save();
    
    // Send notification email to vendor
    try {
      await sendEmail({
        to: vendor.email,
        subject: 'Application Submitted - DrinkBuddy Vendor',
        html: `
          <h2>Application Submitted Successfully!</h2>
          <p>Dear ${vendor.ownerName || vendor.businessName},</p>
          <p>Your vendor application has been submitted and is now under review.</p>
          <p>We will notify you once the review is complete.</p>
          <p>Thank you for choosing DrinkBuddy!</p>
        `
      });
    } catch (emailError) {
      console.error('Failed to send application email:', emailError);
    }
    
    res.json({ 
      success: true, 
      message: 'Application submitted successfully. You will be notified once reviewed.',
      data: { 
        vendor: {
          _id: vendor._id,
          businessName: vendor.businessName,
          status: vendor.status,
          email: vendor.email
        }
      }
    });
  } catch (error) {
    console.error('Submit application error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

/**
 * Get application status
 * GET /api/vendor/application-status
 * PRD Section 5: Stage 4 - Dashboard Activation
 */
exports.getApplicationStatus = async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.vendor._id)
      .select('status rejectionReason documents businessName legalName vendorType email phone address createdAt');
    
    if (!vendor) {
      return res.status(404).json({ 
        success: false, 
        message: 'Vendor not found' 
      });
    }
    
    // Calculate completion percentage
    const requiredFields = ['businessName', 'legalName', 'vendorType', 'email', 'phone', 'address.city'];
    const completedFields = requiredFields.filter(field => {
      if (field.includes('.')) {
        const [parent, child] = field.split('.');
        return vendor[parent] && vendor[parent][child];
      }
      return vendor[field];
    });
    const completionPercentage = Math.round((completedFields.length / requiredFields.length) * 100);
    
    res.json({ 
      success: true, 
      data: { 
        status: vendor.status || 'draft',
        rejectionReason: vendor.rejectionReason || null,
        documents: vendor.documents || [],
        businessName: vendor.businessName,
        vendorType: vendor.vendorType || null,
        email: vendor.email,
        completionPercentage,
        submittedAt: vendor.createdAt
      }
    });
  } catch (error) {
    console.error('Get application status error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

/**
 * Upload document for verification
 * POST /api/vendor/upload-document
 * PRD Section 7.2: Required Documents
 */
exports.uploadDocument = async (req, res) => {
  try {
    const { type } = req.body;
    
    if (!type) {
      return res.status(400).json({ 
        success: false, 
        message: 'Document type is required' 
      });
    }
    
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'No file uploaded' 
      });
    }
    
    const vendor = await Vendor.findById(req.vendor._id);
    
    if (!vendor) {
      return res.status(404).json({ 
        success: false, 
        message: 'Vendor not found' 
      });
    }
    
    // Check if document type already exists
    const existingDocIndex = vendor.documents.findIndex(d => d.type === type);
    
    const documentData = {
      type,
      url: req.file.path, // Cloudinary URL
      status: 'pending',
      uploadedAt: new Date()
    };
    
    if (existingDocIndex >= 0) {
      // Replace existing document
      vendor.documents[existingDocIndex] = documentData;
    } else {
      // Add new document
      vendor.documents.push(documentData);
    }
    
    await vendor.save();
    
    res.json({ 
      success: true, 
      message: 'Document uploaded successfully',
      data: { 
        document: documentData,
        totalDocuments: vendor.documents.length
      }
    });
  } catch (error) {
    console.error('Upload document error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

/**
 * Resubmit application after rejection
 * PUT /api/vendor/resubmit
 * PRD Section 5: Stage 3 - Approval/Rejection
 */
exports.resubmitApplication = async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.vendor._id);
    
    if (!vendor) {
      return res.status(404).json({ 
        success: false, 
        message: 'Vendor not found' 
      });
    }
    
    // Can only resubmit rejected applications
    if (vendor.status !== 'rejected') {
      return res.status(400).json({ 
        success: false, 
        message: 'Can only resubmit rejected applications' 
      });
    }
    
    // Update status
    vendor.status = 'submitted';
    vendor.rejectionReason = null;
    await vendor.save();
    
    // Send notification email
    try {
      await sendEmail({
        to: vendor.email,
        subject: 'Application Resubmitted - DrinkBuddy Vendor',
        html: `
          <h2>Application Resubmitted</h2>
          <p>Dear ${vendor.ownerName || vendor.businessName},</p>
          <p>Your vendor application has been resubmitted for review.</p>
          <p>We will notify you once the review is complete.</p>
        `
      });
    } catch (emailError) {
      console.error('Failed to send resubmission email:', emailError);
    }
    
    res.json({ 
      success: true, 
      message: 'Application resubmitted successfully',
      data: { 
        vendor: {
          _id: vendor._id,
          businessName: vendor.businessName,
          status: vendor.status
        }
      }
    });
  } catch (error) {
    console.error('Resubmit application error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

/**
 * Update application details (while in draft)
 * PUT /api/vendor/application
 * PRD Section 7.1: Required Fields
 */
exports.updateApplication = async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.vendor._id);
    
    if (!vendor) {
      return res.status(404).json({ 
        success: false, 
        message: 'Vendor not found' 
      });
    }
    
    // Can only update draft applications
    if (vendor.status !== 'draft') {
      return res.status(400).json({ 
        success: false, 
        message: 'Can only update draft applications' 
      });
    }
    
    // Update allowed fields
    const allowedFields = [
      'businessName', 'legalName', 'vendorType', 'ownerName', 
      'phone', 'email', 'description', 'address'
    ];
    
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        vendor[field] = req.body[field];
      }
    });
    
    await vendor.save();
    
    res.json({ 
      success: true, 
      message: 'Application updated successfully',
      data: { vendor }
    });
  } catch (error) {
    console.error('Update application error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};
