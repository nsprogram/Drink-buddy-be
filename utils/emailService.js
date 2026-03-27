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
// Method 1: SMTP (works locally + paid Render)
// ═══════════════════════════════════════
let transporter = null;

const sendViaSMTP = async (to, subject, html) => {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  if (!user || !pass) return false;

  try {
    if (!transporter) {
      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass },
        pool: true,
        maxConnections: 3,
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 20000,
      });
      await transporter.verify();
      console.log('✅ Gmail SMTP ready');
    }

    const info = await transporter.sendMail({
      from: `"Drink Buddy 🍷" <${user}>`,
      to, subject, html,
    });
    console.log(`✅ [SMTP] Email sent to ${to} - ${info.messageId}`);
    return true;
  } catch (err) {
    console.log(`⚠️ [SMTP] Failed: ${err.message}`);
    transporter = null;
    return false;
  }
};

// ═══════════════════════════════════════
// Method 2: HTTP API via fetch (works on Render FREE tier)
// Uses smtp2go.com free tier OR direct Gmail API
// ═══════════════════════════════════════
const sendViaHTTP = async (to, subject, html) => {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  if (!user || !pass) return false;

  // Use Brevo HTTP API if key exists
  const brevoKey = process.env.BREVO_API_KEY;
  if (brevoKey) {
    try {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': brevoKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sender: { name: 'Drink Buddy', email: user },
          to: [{ email: to }],
          subject,
          htmlContent: html,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        console.log(`✅ [Brevo] Email sent to ${to}`);
        return true;
      }
      console.log(`⚠️ [Brevo] Failed: ${JSON.stringify(data)}`);
    } catch (err) {
      console.log(`⚠️ [Brevo] Error: ${err.message}`);
    }
  }

  // Use Mailjet HTTP API if keys exist
  const mjKey = process.env.MAILJET_API_KEY;
  const mjSecret = process.env.MAILJET_SECRET_KEY;
  if (mjKey && mjSecret) {
    try {
      const res = await fetch('https://api.mailjet.com/v3.1/send', {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${mjKey}:${mjSecret}`).toString('base64'),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          Messages: [{
            From: { Email: user, Name: 'Drink Buddy' },
            To: [{ Email: to }],
            Subject: subject,
            HTMLPart: html,
          }],
        }),
      });
      const data = await res.json();
      if (res.ok) {
        console.log(`✅ [Mailjet] Email sent to ${to}`);
        return true;
      }
      console.log(`⚠️ [Mailjet] Failed: ${JSON.stringify(data)}`);
    } catch (err) {
      console.log(`⚠️ [Mailjet] Error: ${err.message}`);
    }
  }

  return false;
};

// ═══════════════════════════════════════
// Main send — tries SMTP first, falls back to HTTP API
// ═══════════════════════════════════════
const sendMail = async (to, subject, html) => {
  // Try SMTP first (works locally + paid Render)
  const smtpOk = await sendViaSMTP(to, subject, html);
  if (smtpOk) return true;

  // Try HTTP API (works on Render free tier)
  console.log(`🔄 SMTP failed, trying HTTP API for ${to}...`);
  const httpOk = await sendViaHTTP(to, subject, html);
  if (httpOk) return true;

  console.error(`❌ ALL email methods failed for ${to}`);
  console.error('💡 To fix: Add BREVO_API_KEY or MAILJET_API_KEY+MAILJET_SECRET_KEY to .env');
  console.error('💡 Sign up free at https://www.brevo.com or https://www.mailjet.com');
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
