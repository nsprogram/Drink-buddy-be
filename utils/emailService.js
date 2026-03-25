const nodemailer = require('nodemailer');

// Generate a 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Create transporter with timeout
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 8000, // 8 second timeout (Render blocks SMTP)
    greetingTimeout: 8000,
    socketTimeout: 8000,
  });
};

// Send with timeout wrapper — returns true if sent, false if failed
const safeSendMail = async (mailOptions) => {
  try {
    const transporter = createTransporter();
    await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent to ${mailOptions.to}`);
    return true;
  } catch (err) {
    console.error(`❌ Email failed to ${mailOptions.to}: ${err.message}`);
    return false;
  }
};

const sendEmailVerification = async (email, firstName, token) => {
  return safeSendMail({
    from: `"Drink Buddy" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Verify Your Drink Buddy Email',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #FF6B35, #FF8C00); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">🍷 Drink Buddy</h1>
        </div>
        <div style="padding: 30px; background: #f9f9f9; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333;">Hi ${firstName}! Welcome 🎉</h2>
          <p style="color: #666;">Please verify your email with this code:</p>
          <div style="background: #FF6B35; color: white; font-size: 36px; font-weight: bold; text-align: center; padding: 20px; border-radius: 10px; letter-spacing: 8px; margin: 20px 0;">
            ${token}
          </div>
          <p style="color: #999; font-size: 14px;">This code expires in 24 hours.</p>
        </div>
      </div>
    `
  });
};

const sendLoginOTP = async (email, firstName, otp) => {
  return safeSendMail({
    from: `"Drink Buddy" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Your Drink Buddy Login Code',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #FF6B35, #FF8C00); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">🍷 Drink Buddy</h1>
        </div>
        <div style="padding: 30px; background: #f9f9f9; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333;">Hi ${firstName}! Your login code:</h2>
          <div style="background: #FF6B35; color: white; font-size: 36px; font-weight: bold; text-align: center; padding: 20px; border-radius: 10px; letter-spacing: 8px; margin: 20px 0;">
            ${otp}
          </div>
          <p style="color: #999; font-size: 14px;">Expires in ${process.env.OTP_EXPIRE_MINUTES || 10} minutes.</p>
        </div>
      </div>
    `
  });
};

const sendPasswordResetEmail = async (email, firstName, otp) => {
  return safeSendMail({
    from: `"Drink Buddy" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Drink Buddy Password Reset',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #FF6B35, #FF8C00); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">🍷 Drink Buddy</h1>
        </div>
        <div style="padding: 30px; background: #f9f9f9; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333;">Hi ${firstName}, reset your password</h2>
          <p style="color: #666;">Use this code to reset your password:</p>
          <div style="background: #FF6B35; color: white; font-size: 36px; font-weight: bold; text-align: center; padding: 20px; border-radius: 10px; letter-spacing: 8px; margin: 20px 0;">
            ${otp}
          </div>
          <p style="color: #999; font-size: 14px;">Expires in ${process.env.OTP_EXPIRE_MINUTES || 10} minutes.</p>
        </div>
      </div>
    `
  });
};

const sendWelcomeEmail = async (email, firstName) => {
  return safeSendMail({
    from: `"Drink Buddy" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Welcome to Drink Buddy! 🎉',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #FF6B35, #FF8C00); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">🍷 Drink Buddy</h1>
        </div>
        <div style="padding: 30px; background: #f9f9f9; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333;">Welcome, ${firstName}! 🎉</h2>
          <p style="color: #666;">Your email is verified and your account is ready!</p>
        </div>
      </div>
    `
  });
};

module.exports = {
  generateOTP,
  sendEmailVerification,
  sendLoginOTP,
  sendPasswordResetEmail,
  sendWelcomeEmail
};
