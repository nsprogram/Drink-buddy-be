const { Resend } = require('resend');
const nodemailer = require('nodemailer');

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Drink Buddy <onboarding@resend.dev>';

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
    ` : ''}
    <p style="color: #4A4555; font-size: 12px; margin: 0; text-align: center;">
      If you didn't request this, you can safely ignore this email.
    </p>
  </div>
  <div style="text-align: center; padding: 16px;">
    <p style="color: #3A3545; font-size: 10px; margin: 0;">© ${new Date().getFullYear()} Drink Buddy. All rights reserved.</p>
  </div>
</div>
`;

// Method 1: Send via Resend API (works on Render, fast)
const sendViaResend = async (to, subject, html) => {
  try {
    if (!process.env.RESEND_API_KEY) return false;
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject,
      html,
    });
    if (error) {
      console.log(`⚠️ Resend error: ${error.message}`);
      return false;
    }
    console.log(`✅ [Resend] Email sent to ${to} (id: ${data?.id})`);
    return true;
  } catch (err) {
    console.log(`⚠️ Resend failed: ${err.message}`);
    return false;
  }
};

// Method 2: Send via Gmail SMTP (fallback — works locally, may fail on Render)
const sendViaGmail = async (to, subject, html) => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return false;
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 12000,
      greetingTimeout: 12000,
      socketTimeout: 12000,
    });
    await transporter.sendMail({
      from: `"Drink Buddy" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });
    console.log(`✅ [Gmail] Email sent to ${to}`);
    return true;
  } catch (err) {
    console.log(`⚠️ Gmail failed: ${err.message}`);
    return false;
  }
};

// Main send function — tries Resend first, then Gmail fallback
const safeSendMail = async (to, subject, html) => {
  // Try Resend first (works on Render via HTTPS)
  const resendOk = await sendViaResend(to, subject, html);
  if (resendOk) return true;

  // Fallback to Gmail SMTP
  console.log(`🔄 Falling back to Gmail SMTP for ${to}...`);
  const gmailOk = await sendViaGmail(to, subject, html);
  if (gmailOk) return true;

  console.error(`❌ ALL email methods failed for ${to}`);
  return false;
};

const sendEmailVerification = async (email, firstName, token) => {
  return safeSendMail(
    email,
    `${token} - Verify Your Drink Buddy Email`,
    emailTemplate(`Hi ${firstName}! Welcome 🎉`, 'Please verify your email address using the code below:', token)
  );
};

const sendLoginOTP = async (email, firstName, otp) => {
  return safeSendMail(
    email,
    `${otp} - Your Drink Buddy Login Code`,
    emailTemplate(`Hi ${firstName}! Your login code:`, 'Use this code to log in. Never share this code.', otp)
  );
};

const sendPasswordResetEmail = async (email, firstName, otp) => {
  return safeSendMail(
    email,
    `${otp} - Reset Your Drink Buddy Password`,
    emailTemplate(`Hi ${firstName}, reset your password`, 'Use the code below to reset your password. Expires in 10 minutes.', otp)
  );
};

const sendWelcomeEmail = async (email, firstName) => {
  return safeSendMail(
    email,
    'Welcome to Drink Buddy! 🎉',
    emailTemplate(`Welcome, ${firstName}! 🎉`, 'Your email is verified and your account is ready!', null)
  );
};

module.exports = {
  generateOTP,
  sendEmailVerification,
  sendLoginOTP,
  sendPasswordResetEmail,
  sendWelcomeEmail,
};
