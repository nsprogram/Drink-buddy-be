// Script to delete all vendors from the database
const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;

async function deleteAllVendors() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    console.log('📍 Database:', mongoose.connection.name);
    
    // Get the Vendor model
    const Vendor = mongoose.model('Vendor', new mongoose.Schema({}, { strict: false }));
    
    // Count vendors before deletion
    const countBefore = await Vendor.countDocuments();
    console.log(`\n📊 Found ${countBefore} vendors in database`);
    
    if (countBefore === 0) {
      console.log('✅ No vendors to delete');
      await mongoose.connection.close();
      process.exit(0);
    }
    
    // List vendors
    const vendors = await Vendor.find({}, { businessName: 1, email: 1, status: 1 });
    console.log('\n📋 Vendors to be deleted:');
    vendors.forEach((v, i) => {
      console.log(`   ${i + 1}. ${v.businessName} (${v.email}) - ${v.status}`);
    });
    
    // Ask for confirmation
    console.log('\n⚠️  WARNING: This will delete ALL vendors from the database!');
    console.log('⚠️  This action cannot be undone!');
    console.log('\nPress Ctrl+C to cancel, or wait 5 seconds to continue...\n');
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Delete all vendors
    console.log('🗑️  Deleting all vendors...');
    const result = await Vendor.deleteMany({});
    
    console.log(`✅ Deleted ${result.deletedCount} vendors`);
    
    // Verify deletion
    const countAfter = await Vendor.countDocuments();
    console.log(`📊 Vendors remaining: ${countAfter}`);
    
    if (countAfter === 0) {
      console.log('\n✅ All vendors successfully deleted!');
      console.log('✅ Database is now clean');
    } else {
      console.log('\n⚠️  Some vendors may still remain');
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\n👋 Disconnected from MongoDB');
    process.exit(0);
  }
}

deleteAllVendors();
