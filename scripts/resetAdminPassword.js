/**
 * Force-reset the admin password to a known value.
 * Usage: node scripts/resetAdminPassword.js
 */
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const User = require('../models/User');

(async () => {
  const email = 'admin@drinkbuddy.com';
  const password = 'Admin@1234';

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✓ Connected to MongoDB');
  console.log('  DB:', mongoose.connection.name);

  const user = await User.findOne({ email });
  if (!user) {
    console.log('✗ Admin user NOT FOUND. Run createAdmin.js first.');
    process.exit(1);
  }

  // Reset everything
  user.password = password;       // pre-save hook will hash
  user.role = 'admin';
  user.isEmailVerified = true;
  user.isActive = true;
  user.isBlocked = false;
  user.loginAttempts = 0;
  user.lockUntil = undefined;
  await user.save();

  console.log('\n✅ Admin reset complete.');
  console.log('  ┌─────────────────────────────────────┐');
  console.log('  │  Email:    admin@drinkbuddy.com      │');
  console.log('  │  Password: Admin@1234                │');
  console.log('  │  Role:     admin                     │');
  console.log('  │  Verified: yes                       │');
  console.log('  │  Active:   yes  · Blocked: no        │');
  console.log('  └─────────────────────────────────────┘\n');
  await mongoose.disconnect();
  process.exit(0);
})();
