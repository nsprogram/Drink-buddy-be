// Quick fix script to upgrade vendor subscription
// Run this with: node fix-venue-limit.js

require('dotenv').config();
const mongoose = require('mongoose');
const Vendor = require('./models/Vendor');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/drinkbuddy';

async function fixVenueLimit() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Option 1: Upgrade ALL vendors to Pro tier (for development/testing)
    const result = await Vendor.updateMany(
      {},
      {
        $set: {
          'subscription.tier': 'pro',
          'subscription.venueLimit': 10,
          'subscription.status': 'active'
        }
      }
    );

    console.log(`✅ Updated ${result.modifiedCount} vendor(s) to Pro tier with 10 venue limit`);

    // Show current subscriptions
    const vendors = await Vendor.find({}, { email: 1, subscription: 1 });
    console.log('\nCurrent vendor subscriptions:');
    vendors.forEach(v => {
      console.log(`- ${v.email}: ${v.subscription?.tier || 'free'} tier, ${v.subscription?.venueLimit || 1} venue limit`);
    });      

    await mongoose.disconnect();
    console.log('\n✅ Done! Backend restart recommended.');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  fixVenueLimit();
}

module.exports = fixVenueLimit;
