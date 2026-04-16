/**
 * Make a user an admin by email
 * Usage: node scripts/makeAdmin.js user@email.com
 */
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const User = require('../models/User');

async function makeAdmin() {
  const email = process.argv[2];
  if (!email) {
    console.log('Usage: node scripts/makeAdmin.js <email>');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      console.log(`User with email "${email}" not found`);
      process.exit(1);
    }

    if (user.role === 'admin') {
      console.log(`${user.fullName} (${email}) is already an admin`);
      process.exit(0);
    }

    user.role = 'admin';
    await user.save();

    console.log(`\n  SUCCESS: ${user.fullName} (${email}) is now an ADMIN\n`);
    console.log('  They can now log into the Admin Panel at:');
    console.log('  http://localhost:3001/#/login\n');
  } catch (err) {
    console.error('Error:', err.message);
  }

  await mongoose.disconnect();
  process.exit(0);
}

makeAdmin();
