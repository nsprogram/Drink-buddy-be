const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function resetPassword() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    const Vendor = require('./models/Vendor');
    
    const email = 'marvelant667@gmail.com';
    const newPassword = 'password123';
    
    const vendor = await Vendor.findOne({ email });
    
    if (!vendor) {
      console.log('❌ Vendor not found');
      process.exit(1);
    }
    
    vendor.password = newPassword;
    await vendor.save();
    
    console.log(`✅ Password reset successfully for: ${email}`);
    console.log(`📧 Email: ${email}`);
    console.log(`🔑 Password: ${newPassword}`);
    console.log(`\n💡 You can now login with these credentials\n`);
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

resetPassword();
