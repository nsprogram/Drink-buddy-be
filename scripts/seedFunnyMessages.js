const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const FunnyMessage = require('../models/FunnyMessage');

const defaultMessages = [
  {
    message: "Remember to drink water between drinks! Your body will thank you 💧",
    emoji: "💧",
    displayTime: 30,
    category: "tip",
    priority: 8,
    isActive: true,
  },
  {
    message: "You're doing great! But maybe slow down a bit? 😅",
    emoji: "😅",
    displayTime: 30,
    category: "funny",
    priority: 5,
    isActive: true,
  },
  {
    message: "Pro tip: Eating food helps! Don't drink on an empty stomach 🍕",
    emoji: "🍕",
    displayTime: 35,
    category: "tip",
    priority: 7,
    isActive: true,
  },
  {
    message: "Cheers to good times and great friends! 🥂",
    emoji: "🥂",
    displayTime: 25,
    category: "motivational",
    priority: 6,
    isActive: true,
  },
  {
    message: "Your future self called... they want you to drink some water 😂",
    emoji: "😂",
    displayTime: 30,
    category: "funny",
    priority: 5,
    isActive: true,
  },
  {
    message: "Pace yourself! The night is young 🌙",
    emoji: "🌙",
    displayTime: 30,
    category: "warning",
    priority: 7,
    isActive: true,
  },
  {
    message: "Having fun? Don't forget to stay safe! 🛡️",
    emoji: "🛡️",
    displayTime: 30,
    category: "warning",
    priority: 8,
    isActive: true,
  },
  {
    message: "Legend says every 3rd drink should be water... just saying 💡",
    emoji: "💡",
    displayTime: 35,
    category: "tip",
    priority: 6,
    isActive: true,
  },
  {
    message: "You're a rockstar! But even rockstars need breaks 🎸",
    emoji: "🎸",
    displayTime: 30,
    category: "motivational",
    priority: 4,
    isActive: true,
  },
  {
    message: "Plot twist: Water is also a beverage! Try some? 😎",
    emoji: "😎",
    displayTime: 30,
    category: "funny",
    priority: 5,
    isActive: true,
  },
  {
    message: "Remember: It's a marathon, not a sprint! 🏃",
    emoji: "🏃",
    displayTime: 30,
    category: "tip",
    priority: 7,
    isActive: true,
  },
  {
    message: "Your liver is working overtime tonight! Show it some love 💚",
    emoji: "💚",
    displayTime: 35,
    category: "warning",
    priority: 6,
    isActive: true,
  },
  {
    message: "Fun fact: Hangovers are 100% preventable... by not drinking! 🤪",
    emoji: "🤪",
    displayTime: 30,
    category: "funny",
    priority: 3,
    isActive: true,
  },
  {
    message: "Stay hydrated, stay happy! Water = life 🌊",
    emoji: "🌊",
    displayTime: 30,
    category: "tip",
    priority: 8,
    isActive: true,
  },
  {
    message: "You're making memories tonight! Make them good ones ✨",
    emoji: "✨",
    displayTime: 30,
    category: "motivational",
    priority: 5,
    isActive: true,
  },
];

async function seedMessages() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing messages
    const deleteResult = await FunnyMessage.deleteMany({});
    console.log(`🗑️  Deleted ${deleteResult.deletedCount} existing messages`);

    // Insert new messages
    const result = await FunnyMessage.insertMany(defaultMessages);
    console.log(`✅ Inserted ${result.length} funny messages`);

    console.log('\n📋 Sample messages:');
    result.slice(0, 3).forEach((msg, i) => {
      console.log(`${i + 1}. ${msg.emoji} ${msg.message}`);
    });

    console.log('\n✨ Seeding complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding messages:', error);
    process.exit(1);
  }
}

seedMessages();
