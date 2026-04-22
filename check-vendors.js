const mongoose = require('mongoose');
require('dotenv').config();

async function checkVendors() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    const Vendor = require('./models/Vendor');
    
    const vendors = await Vendor.find({}).select('email businessName subscription.tier createdAt');
    
    console.log(`📊 Found ${vendors.length} vendors:\n`);
    
    vendors.forEach((vendor, index) => {
      console.log(`${index + 1}. Email: ${vendor.email}`);
      console.log(`   Business: ${vendor.businessName}`);
      console.log(`   Tier: ${vendor.subscription.tier}`);
      console.log(`   Created: ${vendor.createdAt}`);
      console.log('');
    });
    
    if (vendors.length > 0) {
      console.log('💡 Use one of these emails to login with password: password123\n');
    } else {
      console.log('⚠️  No vendors found. You need to register first.\n');
    }
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkVendors();
