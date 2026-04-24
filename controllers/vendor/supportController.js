const SupportTicket = require('../../models/SupportTicket');
const { sendEmail } = require('../../utils/emailService');

const SUPPORT_INBOX = process.env.SUPPORT_EMAIL || 'support@drinkbuddy.app';

exports.createTicket = async (req, res) => {
  try {
    const { subject, category, message, priority } = req.body || {};
    if (!subject || !message) {
      return res.status(400).json({ success: false, message: 'subject and message are required' });
    }
    const ticket = await SupportTicket.create({
      vendor: req.vendorId,
      email: req.vendor.email,
      subject: String(subject).slice(0, 200),
      category: category || 'other',
      message: String(message).slice(0, 5000),
      priority: priority || 'normal',
    });

    // Fire-and-forget email to support inbox (don't fail the request)
    try {
      await sendEmail({
        to: SUPPORT_INBOX,
        subject: `[Vendor Support] ${ticket.subject}`,
        html: `
          <h3>New vendor support ticket</h3>
          <p><b>Vendor:</b> ${req.vendor.businessName} &lt;${req.vendor.email}&gt;</p>
          <p><b>Category:</b> ${ticket.category}</p>
          <p><b>Priority:</b> ${ticket.priority}</p>
          <p><b>Subject:</b> ${ticket.subject}</p>
          <hr/>
          <pre style="white-space:pre-wrap;font-family:inherit">${ticket.message}</pre>
          <p><small>Ticket ID: ${ticket._id}</small></p>
        `,
      });
    } catch (e) {
      console.warn('[support] email failed:', e.message);
    }

    res.status(201).json({ success: true, data: { ticket }, message: 'Support ticket submitted' });
  } catch (e) {
    console.error('createTicket error:', e);
    res.status(500).json({ success: false, message: e.message });
  }
};

exports.listTickets = async (req, res) => {
  const tickets = await SupportTicket.find({ vendor: req.vendorId }).sort('-createdAt').limit(100);
  res.json({ success: true, data: { tickets } });
};
