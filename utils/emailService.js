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
// Method 1: Resend HTTP API (works on Render — no SMTP needed)
// Uses raw fetch, no npm package required
// ═══════════════════════════════════════
const sendViaResendHTTP = async (to, subject, html) => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || 'Drink Buddy <onboarding@resend.dev>',
        to: [to],
        subject,
        html,
      }),
    });

    const data = await response.json();

    if (response.ok && data.id) {
      console.log(`✅ [Resend] Email sent to ${to} (id: ${data.id})`);
      return true;
    }

    console.log(`⚠️ [Resend] Failed for ${to}: ${data.message || JSON.stringify(data)}`);
    return false;
  } catch (err) {
    console.log(`⚠️ [Resend] Error: ${err.message}`);
    return false;
  }
};

// ═══════════════════════════════════════
// Method 2: Nodemailer Gmail SMTP (works locally, may timeout on Render)
// ═══════════════════════════════════════
let cachedTransporter = null;

const sendViaGmailSMTP = async (to, subject, html) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return false;

  try {
    if (!cachedTransporter) {
      cachedTransporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
      });

      // Verify connection
      await cachedTransporter.verify();
      console.log('✅ Gmail SMTP transporter ready');
    }

    const info = await cachedTransporter.sendMail({
      from: `"Drink Buddy 🍷" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });

    console.log(`✅ [Gmail] Email sent to ${to} - ${info.messageId}`);
    return true;
  } catch (err) {
    console.log(`⚠️ [Gmail] Failed: ${err.message}`);
    cachedTransporter = null; // Reset so next attempt creates fresh
    return false;
  }
};

// ═══════════════════════════════════════
// Main send function — tries Resend HTTP first, then Gmail SMTP
// ═══════════════════════════════════════
const sendMail = async (to, subject, html) => {
  // Try Resend HTTP API first (works on Render via HTTPS, no SMTP)
  const resendOk = await sendViaResendHTTP(to, subject, html);
  if (resendOk) return true;

  // Fallback to Gmail SMTP (works locally)
  console.log(`🔄 Falling back to Gmail SMTP for ${to}...`);
  const gmailOk = await sendViaGmailSMTP(to, subject, html);
  if (gmailOk) return true;

  console.error(`❌ ALL email methods failed for ${to}`);
  return false;
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
