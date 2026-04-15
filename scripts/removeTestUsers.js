// One-time script to remove test accounts from the database.
// Run: node scripts/removeTestUsers.js
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function removeTestUsers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const User = require('../models/User');

    // Match common test patterns: test1@, test2@, test@, anything starting with "test"
    const result = await User.deleteMany({
      $or: [
        { email: /^test\d*@/i },
        { email: /@test\./i },
        { firstName: /^test$/i },
        { email: /^demo@/i },
        { email: /^admin@/i },
      ],
    });

    console.log(`Removed ${result.deletedCount} test users`);
    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

removeTestUsers();
