const nodemailer = require('nodemailer');

// Generate a 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Create transporter — try port 465 (SSL) first, fallback to 587 (STARTTLS)
const createTransporter = () => {
  const useSSL = process.env.EMAIL_USE_SSL === 'true' || process.env.NODE_ENV === 'production';

  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: useSSL ? 465 : (parseInt(process.env.EMAIL_PORT) || 587),
    secure: useSSL, // true for 465 (SSL), false for 587 (STARTTLS)
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 15000,
  });
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

// Send email — returns true if sent, false if failed
const safeSendMail = async (mailOptions) => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.log('⚠️ Email not configured (missing EMAIL_USER/EMAIL_PASS)');
      return false;
    }
    const transporter = createTransporter();
    await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent to ${mailOptions.to}`);
    return true;
  } catch (err) {
    console.error(`❌ Email failed to ${mailOptions.to}: ${err.message}`);

    // If port 465 failed, retry with port 587
    if (err.message.includes('ECONN') || err.message.includes('timeout')) {
      try {
        console.log('🔄 Retrying with port 587...');
        const fallback = nodemailer.createTransport({
          host: process.env.EMAIL_HOST || 'smtp.gmail.com',
          port: 587,
          secure: false,
          auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
          tls: { rejectUnauthorized: false },
          connectionTimeout: 10000,
          greetingTimeout: 10000,
          socketTimeout: 10000,
        });
        await fallback.sendMail(mailOptions);
        console.log(`✅ Email sent (fallback 587) to ${mailOptions.to}`);
        return true;
      } catch (e2) {
        console.error(`❌ Fallback 587 also failed: ${e2.message}`);
        return false;
      }
    }
    return false;
  }
};

const sendEmailVerification = async (email, firstName, token) => {
  return safeSendMail({
    from: `"Drink Buddy" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `${token} - Verify Your Drink Buddy Email`,
    html: emailTemplate(
      `Hi ${firstName}! Welcome 🎉`,
      'Please verify your email address using the code below:',
      token
    ),
  });
};

const sendLoginOTP = async (email, firstName, otp) => {
  return safeSendMail({
    from: `"Drink Buddy" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `${otp} - Your Drink Buddy Login Code`,
    html: emailTemplate(
      `Hi ${firstName}! Your login code:`,
      'Use this code to log in to your account. Never share this code with anyone.',
      otp
    ),
  });
};

const sendPasswordResetEmail = async (email, firstName, otp) => {
  return safeSendMail({
    from: `"Drink Buddy" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `${otp} - Reset Your Drink Buddy Password`,
    html: emailTemplate(
      `Hi ${firstName}, reset your password`,
      'Use the code below to reset your password. This code expires in 10 minutes.',
      otp
    ),
  });
};

const sendWelcomeEmail = async (email, firstName) => {
  return safeSendMail({
    from: `"Drink Buddy" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Welcome to Drink Buddy! 🎉',
    html: emailTemplate(
      `Welcome, ${firstName}! 🎉`,
      'Your email has been verified and your account is ready. Time to find your drink buddies and track your sessions responsibly!',
      null
    ),
  });
};

module.exports = {
  generateOTP,
  sendEmailVerification,
  sendLoginOTP,
  sendPasswordResetEmail,
  sendWelcomeEmail,
};
