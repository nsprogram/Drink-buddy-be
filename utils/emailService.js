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

// ── Create Nodemailer transporter ──
// Try multiple configurations until one works
let cachedTransporter = null;

const createTransporter = async () => {
  if (cachedTransporter) return cachedTransporter;

  const configs = [
    // Config 1: Gmail with service shortcut (best for local + some cloud)
    {
      name: 'Gmail Service',
      config: {
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      },
    },
    // Config 2: Gmail with SSL port 465
    {
      name: 'Gmail SSL 465',
      config: {
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
        tls: { rejectUnauthorized: false },
      },
    },
    // Config 3: Gmail with TLS port 587
    {
      name: 'Gmail TLS 587',
      config: {
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
        tls: { rejectUnauthorized: false },
      },
    },
  ];

  for (const { name, config } of configs) {
    try {
      const t = nodemailer.createTransport({
        ...config,
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
      });
      await t.verify();
      console.log(`✅ Email transporter ready: ${name}`);
      cachedTransporter = t;
      return t;
    } catch (err) {
      console.log(`⚠️ ${name} failed: ${err.message}`);
    }
  }

  console.error('❌ All email transporter configs failed');
  return null;
};

// ── Send email function ──
const sendMail = async (to, subject, html) => {
  try {
    const transporter = await createTransporter();
    if (!transporter) {
      // Last resort: create fresh transporter without verify
      console.log('🔄 Attempting direct send without verify...');
      const directTransporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
        connectionTimeout: 15000,
        socketTimeout: 20000,
      });

      const info = await directTransporter.sendMail({
        from: `"Drink Buddy 🍷" <${process.env.EMAIL_USER}>`,
        to,
        subject,
        html,
      });
      console.log(`✅ Email sent to ${to} (direct) - MessageID: ${info.messageId}`);
      return true;
    }

    const info = await transporter.sendMail({
      from: `"Drink Buddy 🍷" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });
    console.log(`✅ Email sent to ${to} - MessageID: ${info.messageId}`);
    return true;
  } catch (err) {
    console.error(`❌ Email send failed to ${to}: ${err.message}`);

    // Reset cached transporter so next attempt tries fresh
    cachedTransporter = null;

    return false;
  }
};

// ── Email sending functions ──
const sendEmailVerification = async (email, firstName, otp) => {
  return sendMail(
    email,
    `${otp} - Verify Your Email | Drink Buddy`,
    emailTemplate(
      `Welcome, ${firstName}! 🎉`,
      'Please verify your email address using the code below to get started:',
      otp
    )
  );
};

const sendLoginOTP = async (email, firstName, otp) => {
  return sendMail(
    email,
    `${otp} - Your Login Code | Drink Buddy`,
    emailTemplate(
      `Hi ${firstName}!`,
      'Use this code to log in to your account. Never share this code with anyone.',
      otp
    )
  );
};

const sendPasswordResetEmail = async (email, firstName, otp) => {
  return sendMail(
    email,
    `${otp} - Reset Your Password | Drink Buddy`,
    emailTemplate(
      `Hi ${firstName}`,
      'We received a request to reset your password. Use the code below:',
      otp
    )
  );
};

const sendWelcomeEmail = async (email, firstName) => {
  return sendMail(
    email,
    'Welcome to Drink Buddy! 🍷🎉',
    emailTemplate(
      `Welcome aboard, ${firstName}! 🎉`,
      'Your email is verified and your account is ready. Start tracking your drinks responsibly!',
      null
    )
  );
};

module.exports = {
  generateOTP,
  sendEmailVerification,
  sendLoginOTP,
  sendPasswordResetEmail,
  sendWelcomeEmail,
};
