/**
 * Create a test admin account
 * Usage: node scripts/createAdmin.js
 */
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const User = require('../models/User');

async function createAdmin() {
  const email = 'admin@drinkbuddy.com';
  const password = 'Admin@1234';

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Check if already exists
    const existing = await User.findOne({ email });
    if (existing) {
      // Just promote to admin if not already
      if (existing.role !== 'admin') {
        existing.role = 'admin';
        existing.isEmailVerified = true;
        existing.isActive = true;
        existing.isBlocked = false;
        await existing.save();
        console.log('\n  User already existed — promoted to admin.\n');
      } else {
        console.log('\n  Admin account already exists.\n');
      }
      console.log('  ┌─────────────────────────────────────┐');
      console.log('  │  Email:    admin@drinkbuddy.com      │');
      console.log('  │  Password: Admin@1234                │');
      console.log('  └─────────────────────────────────────┘\n');
      await mongoose.disconnect();
      process.exit(0);
    }

    // Create new admin user
    const admin = new User({
      firstName: 'Admin',
      lastName: 'DrinkBuddy',
      email,
      password,
      role: 'admin',
      isEmailVerified: true,
      isActive: true,
      dateOfBirth: new Date('1995-01-01'),
      age: 31,
      bio: 'DrinkBuddy Administrator',
      avatarEmoji: '🛡️',
      avatarColor: '#FF9F43',
    });

    await admin.save();

    console.log('\n  ✅ Admin account created successfully!\n');
    console.log('  ┌─────────────────────────────────────┐');
    console.log('  │  Email:    admin@drinkbuddy.com      │');
    console.log('  │  Password: Admin@1234                │');
    console.log('  │  Role:     admin                     │');
    console.log('  └─────────────────────────────────────┘\n');
    console.log('  Login at: http://localhost:3001/#/login\n');
  } catch (err) {
    console.error('Error:', err.message);
  }

  await mongoose.disconnect();
  process.exit(0);
}

createAdmin();
