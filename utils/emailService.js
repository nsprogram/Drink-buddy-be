const nodemailer = require('nodemailer');

// Generate a 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Create transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    tls: {
      rejectUnauthorized: false
    }
  });
};

const sendEmailVerification = async (email, firstName, token) => {
  const transporter = createTransporter();

  const mailOptions = {
    from: `"DrinkBuddy" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Verify Your DrinkBuddy Email',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #FF6B35, #FF8C00); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">🍷 DrinkBuddy</h1>
        </div>
        <div style="padding: 30px; background: #f9f9f9; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333;">Hi ${firstName}! Welcome to DrinkBuddy 🎉</h2>
          <p style="color: #666;">Please verify your email address using the code below:</p>
          <div style="background: #FF6B35; color: white; font-size: 36px; font-weight: bold; text-align: center; padding: 20px; border-radius: 10px; letter-spacing: 8px; margin: 20px 0;">
            ${token}
          </div>
          <p style="color: #999; font-size: 14px;">This code expires in 24 hours. If you did not create an account, please ignore this email.</p>
        </div>
      </div>
    `
  };

  return transporter.sendMail(mailOptions);
};

const sendLoginOTP = async (email, firstName, otp) => {
  const transporter = createTransporter();

  const mailOptions = {
    from: `"DrinkBuddy" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Your DrinkBuddy Login Code',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #FF6B35, #FF8C00); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">🍷 DrinkBuddy</h1>
        </div>
        <div style="padding: 30px; background: #f9f9f9; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333;">Hi ${firstName}! Here's your login code</h2>
          <div style="background: #FF6B35; color: white; font-size: 36px; font-weight: bold; text-align: center; padding: 20px; border-radius: 10px; letter-spacing: 8px; margin: 20px 0;">
            ${otp}
          </div>
          <p style="color: #999; font-size: 14px;">This code expires in ${process.env.OTP_EXPIRE_MINUTES || 10} minutes. Never share this code.</p>
        </div>
      </div>
    `
  };

  return transporter.sendMail(mailOptions);
};

const sendPasswordResetEmail = async (email, firstName, otp) => {
  const transporter = createTransporter();

  const mailOptions = {
    from: `"DrinkBuddy" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'DrinkBuddy Password Reset',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #FF6B35, #FF8C00); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">🍷 DrinkBuddy</h1>
        </div>
        <div style="padding: 30px; background: #f9f9f9; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333;">Hi ${firstName}, reset your password</h2>
          <p style="color: #666;">Use the code below to reset your password:</p>
          <div style="background: #FF6B35; color: white; font-size: 36px; font-weight: bold; text-align: center; padding: 20px; border-radius: 10px; letter-spacing: 8px; margin: 20px 0;">
            ${otp}
          </div>
          <p style="color: #999; font-size: 14px;">This code expires in ${process.env.OTP_EXPIRE_MINUTES || 10} minutes. If you did not request a password reset, please ignore this email.</p>
        </div>
      </div>
    `
  };

  return transporter.sendMail(mailOptions);
};

const sendWelcomeEmail = async (email, firstName) => {
  const transporter = createTransporter();

  const mailOptions = {
    from: `"DrinkBuddy" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Welcome to DrinkBuddy! 🎉',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #FF6B35, #FF8C00); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">🍷 DrinkBuddy</h1>
        </div>
        <div style="padding: 30px; background: #f9f9f9; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333;">Welcome, ${firstName}! 🎉</h2>
          <p style="color: #666;">Your email has been verified and your account is ready. Time to find your drink buddies!</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" 
               style="background: #FF6B35; color: white; padding: 15px 30px; border-radius: 25px; text-decoration: none; font-weight: bold;">
              Open DrinkBuddy 🍺
            </a>
          </div>
        </div>
      </div>
    `
  };

  return transporter.sendMail(mailOptions);
};

module.exports = {
  generateOTP,
  sendEmailVerification,
  sendLoginOTP,
  sendPasswordResetEmail,
  sendWelcomeEmail
};
