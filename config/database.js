const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    if (mongoose.connection.readyState >= 1) {
      console.log('✅ MongoDB already connected (reusing connection)');
      return;
    }

    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/drinkbuddy';
    await mongoose.connect(mongoUri);

    console.log('✅ Connected to MongoDB');
    console.log('📍 Database:', mongoose.connection.name);
    console.log('🏠 Host:', mongoose.connection.host);
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    throw err;
  }
};

module.exports = connectDB;
