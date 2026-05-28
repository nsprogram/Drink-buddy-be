const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const FunnyMessage = require('./models/FunnyMessage');

async function testFunnyMessages() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Test 1: Count messages
    const count = await FunnyMessage.countDocuments();
    console.log(`📊 Total messages in database: ${count}`);

    // Test 2: Count active messages
    const activeCount = await FunnyMessage.countDocuments({ isActive: true });
    console.log(`✅ Active messages: ${activeCount}`);

    // Test 3: Get random message
    if (activeCount > 0) {
      const random = Math.floor(Math.random() * activeCount);
      const randomMsg = await FunnyMessage.findOne({ isActive: true }).skip(random);
      console.log('\n🎲 Random message:');
      console.log(`   ${randomMsg.emoji} "${randomMsg.message}"`);
      console.log(`   Category: ${randomMsg.category}, Priority: ${randomMsg.priority}, Display: ${randomMsg.displayTime}s`);
    }

    // Test 4: List all messages by category
    console.log('\n📋 Messages by category:');
    const categories = ['motivational', 'funny', 'warning', 'tip', 'general'];
    for (const cat of categories) {
      const catCount = await FunnyMessage.countDocuments({ category: cat, isActive: true });
      console.log(`   ${cat}: ${catCount} active`);
    }

    // Test 5: Show first 3 messages
    console.log('\n📝 Sample messages:');
    const samples = await FunnyMessage.find({ isActive: true }).limit(3);
    samples.forEach((msg, i) => {
      console.log(`   ${i + 1}. ${msg.emoji} ${msg.message}`);
    });

    console.log('\n✨ All tests passed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testFunnyMessages();
