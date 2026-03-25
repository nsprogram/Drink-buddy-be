const nodemailer = require('nodemailer');

// Generate a 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// HTML email template
const emailTemplate = (title, body, code) => `
<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0A0A0F;">
  <div style="background: linear-gradient(135deg, #FF6B35, #FF8C00); padding: 32px; text-align: center; border-radius: 16px 16px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px; letter-spacing: 1px;">🍷 Drink Buddy</h1>
  </div>
  <div style="padding: 36px 32px; background: #1A1A25; border-radius: 0 0 16px 16px;">
    <h2 style="color: #F0ECE5; margin: 0 0 12px 0; font-size: 20px;">${title}</h2>
    <p style="color: #8A8595; font-size: 14px; line-height: 1.6; margin: 0 0 24px 0;">${body}</p>
    ${code ? `
    <div style="background: linear-gradient(135deg, #FF6B35, #FF8C00); color: white; font-size: 36px; font-weight: bold; text-align: center; padding: 20px; border-radius: 14px; letter-spacing: 10px; margin: 0 0 24px 0; font-family: 'Courier New', monospace;">
      ${code}
    </div>
    <p style="color: #8A8595; font-size: 12px; text-align: center; margin: 0 0 24px 0;">
      This code expires in 5 minutes. Do not share it with anyone.
    </p>
    ` : ''}
    <p style="color: #4A4555; font-size: 12px; margin: 0; text-align: center;">
      If you didn't request this, you can safely ignore this email.
    </p>
  </div>
  <div style="text-align: center; padding: 16px;">
    <p style="color: #3A3545; font-size: 10px; margin: 0;">&copy; ${new Date().getFullYear()} Drink Buddy. All rights reserved.</p>
  </div>
</div>
`;

// ═══════════════════════════════════════
// Nodemailer Gmail — ONLY method, no third party
// Uses pool connections + multiple port attempts
// ═══════════════════════════════════════
let transporter = null;
let transporterReady = false;

const createTransporter = async () => {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!user || !pass) {
    console.error('❌ EMAIL_USER or EMAIL_PASS not set in .env');
    return null;
  }

  // Try multiple configs — one will work depending on environment
  const configs = [
    // Config 1: Gmail service (simplest, works most places)
    {
      name: 'Gmail Service',
      service: 'gmail',
      auth: { user, pass },
      pool: true,
      maxConnections: 3,
      maxMessages: 100,
      connectionTimeout: 30000,
      greetingTimeout: 30000,
      socketTimeout: 30000,
    },
    // Config 2: Direct SMTP with TLS on port 587
    {
      name: 'Gmail 587 TLS',
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: { user, pass },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 30000,
      greetingTimeout: 30000,
      socketTimeout: 30000,
    },
    // Config 3: Direct SMTP with SSL on port 465
    {
      name: 'Gmail 465 SSL',
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user, pass },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 30000,
      greetingTimeout: 30000,
      socketTimeout: 30000,
    },
  ];

  for (const config of configs) {
    try {
      const { name, ...transportConfig } = config;
      console.log(`📧 Trying ${name}...`);
      const t = nodemailer.createTransport(transportConfig);
      await t.verify();
      console.log(`✅ ${name} connected successfully!`);
      return t;
    } catch (err) {
      console.log(`⚠️ ${config.name} failed: ${err.message}`);
    }
  }

  console.error('❌ All Gmail SMTP configs failed');
  return null;
};

// Initialize transporter on first use
const getTransporter = async () => {
  if (transporter && transporterReady) return transporter;

  transporter = await createTransporter();
  transporterReady = !!transporter;
  return transporter;
};

// Main send function
const sendMail = async (to, subject, html) => {
  const t = await getTransporter();

  if (!t) {
    console.error(`❌ No email transporter available. Cannot send to ${to}`);
    return false;
  }

  try {
    const info = await t.sendMail({
      from: `"Drink Buddy 🍷" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });

    console.log(`✅ Email sent to ${to} - MessageID: ${info.messageId}`);
    return true;
  } catch (err) {
    console.error(`❌ Email send failed to ${to}: ${err.message}`);
    // Reset transporter so next attempt retries connection
    transporter = null;
    transporterReady = false;

    // Retry once with fresh transporter
    try {
      console.log(`🔄 Retrying email to ${to}...`);
      const t2 = await createTransporter();
      if (t2) {
        const info = await t2.sendMail({
          from: `"Drink Buddy 🍷" <${process.env.EMAIL_USER}>`,
          to,
          subject,
          html,
        });
        console.log(`✅ Retry succeeded! Email sent to ${to} - ${info.messageId}`);
        transporter = t2;
        transporterReady = true;
        return true;
      }
    } catch (retryErr) {
      console.error(`❌ Retry also failed: ${retryErr.message}`);
    }

    return false;
  }
};

// ── Email functions ──
const sendEmailVerification = async (email, firstName, otp) => {
  return sendMail(
    email,
    `${otp} - Verify Your Email | Drink Buddy`,
    emailTemplate('Welcome! 🎉', `Hi ${firstName}, please verify your email using the code below:`, otp)
  );
};

const sendLoginOTP = async (email, firstName, otp) => {
  return sendMail(
    email,
    `${otp} - Login Code | Drink Buddy`,
    emailTemplate(`Hi ${firstName}!`, 'Use this code to log in. Never share this code with anyone.', otp)
  );
};

const sendPasswordResetEmail = async (email, firstName, otp) => {
  return sendMail(
    email,
    `${otp} - Reset Password | Drink Buddy`,
    emailTemplate(`Hi ${firstName}`, 'Use the code below to reset your password:', otp)
  );
};

const sendWelcomeEmail = async (email, firstName) => {
  return sendMail(
    email,
    'Welcome to Drink Buddy! 🍷🎉',
    emailTemplate(`Welcome, ${firstName}! 🎉`, 'Your email is verified! Start tracking your drinks responsibly.', null)
  );
};

module.exports = {
  generateOTP,
  sendEmailVerification,
  sendLoginOTP,
  sendPasswordResetEmail,
  sendWelcomeEmail,
};
