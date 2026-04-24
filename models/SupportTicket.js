const mongoose = require('mongoose');

const supportTicketSchema = new mongoose.Schema({
  vendor:   { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true },
  email:    { type: String, required: true, lowercase: true, trim: true },
  subject:  { type: String, required: true, trim: true, maxlength: 200 },
  category: {
    type: String,
    enum: ['billing', 'technical', 'account', 'bookings', 'feature-request', 'other'],
    default: 'other',
  },
  message:  { type: String, required: true, maxlength: 5000 },
  status:   { type: String, enum: ['open', 'in-progress', 'resolved', 'closed'], default: 'open', index: true },
  priority: { type: String, enum: ['low', 'normal', 'high', 'urgent'], default: 'normal' },
  response: String,
  respondedAt: Date,
  respondedBy: String,
}, { timestamps: true });

module.exports = mongoose.model('SupportTicket', supportTicketSchema);
