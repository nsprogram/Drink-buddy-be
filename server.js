const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { setupSocket } = require('./socket');

// Load passport strategies (Google OAuth + JWT)
require('./config/passport');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const profileRoutes = require('./routes/profile');
const sessionRoutes = require('./routes/sessionRoutes');
const chatRoutes = require('./routes/chatRoutes');
const storyRoutes = require('./routes/storyRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const favoriteRoutes = require('./routes/favoriteRoutes');
const roomRoutes = require('./routes/roomRoutes');
const callRoutes = require('./routes/callRoutes');
const chatbotRoutes = require('./routes/chatbotRoutes');
const adminRoutes = require('./routes/adminRoutes');
const adminVendorApplicationRoutes = require('./routes/admin/vendorApplications');
const placesRoutes = require('./routes/placesRoutes');
const healthRoutes = require('./routes/healthRoutes');
const drinkCommentRoutes = require('./routes/drinkCommentRoutes');
const groupRoutes = require('./routes/groupRoutes');
const pushRoutes = require('./routes/pushRoutes');

// Vendor routes
const vendorAuthRoutes          = require('./routes/vendor/auth');
const vendorApplicationRoutes   = require('./routes/vendor/application');
const vendorBasicInfoRoutes     = require('./routes/vendor/basicInfo');
const vendorKycRoutes           = require('./routes/vendor/kyc');
const vendorProfileRoutes       = require('./routes/vendor/profile');
const vendorVenuesRoutes        = require('./routes/vendor/venues');
const vendorMenuRoutes          = require('./routes/vendor/menu');
const vendorPromotionsRoutes    = require('./routes/vendor/promotions');
const vendorBookingsRoutes      = require('./routes/vendor/bookings');
const vendorReviewsRoutes       = require('./routes/vendor/reviews');
const vendorAnalyticsRoutes     = require('./routes/vendor/analytics');
const vendorInventoryRoutes     = require('./routes/vendor/inventory');
const vendorTeamRoutes          = require('./routes/vendor/team');
const vendorNotificationsRoutes = require('./routes/vendor/notifications');
const vendorSupportRoutes       = require('./routes/vendor/support');
const funnyMessageRoutes        = require('./routes/funnyMessageRoutes');


// ── Validate required env vars ──
const requiredEnvs = ['MONGODB_URI', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];
for (const env of requiredEnvs) {
  if (!process.env[env]) {
    console.error(`❌ Missing required env variable: ${env}`);
    if (process.env.NODE_ENV === 'production') process.exit(1);
  }
}

const app = express();
const server = http.createServer(app);

// Setup Socket.io
const io = setupSocket(server);
app.set('io', io);

// Share io with the notification utility so it can emit live notifications
const notifUtil = require('./utils/notifications');
notifUtil.setIo(io);

console.log('-------------------------------------------');
console.log('🚀 DRINKBUDDY BACKEND STARTING');
console.log('📅 Time:', new Date().toISOString());
console.log('-------------------------------------------');

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'development'
    ? true
    : [process.env.FRONTEND_URL || 'http://localhost:3000', 'exp://localhost:8081'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Rate limiting — only on sensitive auth endpoints
// (No global limiter: Render free tier shares IPs across users via proxy,
// so a global limiter would block legitimate requests from different users)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many authentication attempts, please try again later.' }
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/verify-email', authLimiter);

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

// Response compression
const compression = require('compression');
app.use(compression());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use('/uploads', express.static('uploads'));

// Database connection
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/drinkbuddy';

const connectDB = async (retries = 3) => {
  if (mongoose.connection.readyState >= 1) {
    console.log('✅ MongoDB already connected (reusing connection)');
    return;
  }
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`🔄 MongoDB connection attempt ${i + 1}/${retries}...`);
      console.log(`📋 URI starts with: ${mongoUri ? mongoUri.substring(0, 30) + '...' : 'MISSING!'}`);
      await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000,
      });
      console.log('✅ Connected to MongoDB');
      console.log('📍 Database:', mongoose.connection.name);
      console.log('🏠 Host:', mongoose.connection.host);
      return;
    } catch (err) {
      console.error(`❌ MongoDB connection attempt ${i + 1} failed:`, err.message);
      if (i < retries - 1) {
        console.log(`⏳ Retrying in 3 seconds...`);
        await new Promise(r => setTimeout(r, 3000));
      }
    }
  }
  console.error('❌ All MongoDB connection attempts failed! Auth routes will not work.');
};

// Auto-reconnect on disconnect
mongoose.connection.on('disconnected', () => {
  console.log('⚠️ MongoDB disconnected! Attempting reconnect...');
  setTimeout(() => connectDB(2), 5000);
});

connectDB();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/stories', storyRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/push',  pushRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/places', placesRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/funny-messages', funnyMessageRoutes);
app.use('/api/drink-comments', drinkCommentRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/public-vendors', require('./routes/publicVendorRoutes'));

// Vendor API
app.use('/api/vendor/auth',          vendorAuthRoutes);
app.use('/api/vendor/basic-info',    vendorBasicInfoRoutes);
app.use('/api/vendor/kyc',           vendorKycRoutes);
app.use('/api/vendor',               vendorApplicationRoutes); // Application routes
app.use('/api/vendor/profile',       vendorProfileRoutes);
app.use('/api/vendor/venues',        vendorVenuesRoutes);
app.use('/api/vendor/menu',          vendorMenuRoutes);
app.use('/api/vendor/promotions',    vendorPromotionsRoutes);
app.use('/api/vendor/bookings',      vendorBookingsRoutes);
app.use('/api/vendor/reviews',       vendorReviewsRoutes);
app.use('/api/vendor/analytics',     vendorAnalyticsRoutes);
app.use('/api/vendor/inventory',     vendorInventoryRoutes);
app.use('/api/vendor/team',          vendorTeamRoutes);
app.use('/api/vendor/notifications', vendorNotificationsRoutes);
app.use('/api/vendor/support',       vendorSupportRoutes);
app.use('/api/vendor/auth/login',    authLimiter);
app.use('/api/vendor/auth/register', authLimiter);

// Admin API (vendor-applications must come before the wildcard adminRoutes)
app.use('/api/admin/vendor-applications', adminVendorApplicationRoutes);
app.use('/api/admin', adminRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'DrinkBuddy Backend is running',
    timestamp: new Date().toISOString(),
    socket: io ? 'active' : 'inactive',
  });
});

// DB reconnect endpoint
app.get('/api/reconnect-db', async (req, res) => {
  try {
    await connectDB(2);
    const state = mongoose.connection.readyState;
    res.json({ success: state === 1, dbState: state === 1 ? 'connected' : 'failed' });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// Status/test route
app.get('/api/test', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStateMap = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
  res.status(200).json({
    success: true,
    message: 'DrinkBuddy Backend is Running!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: {
      status: dbStateMap[dbState] || 'unknown',
      host: mongoose.connection.host || 'unknown',
      name: mongoose.connection.name || 'unknown'
    },
    vercel: {
      region: process.env.VERCEL_REGION || 'unknown',
      env: process.env.VERCEL_ENV || 'unknown'
    }
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error:', err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
});

const PORT = process.env.PORT || 5000;

// ── Self-ping to keep Render free tier alive ──
const RENDER_URL = process.env.RENDER_EXTERNAL_URL || process.env.BACKEND_URL;
const SELF_PING_INTERVAL = 10 * 60 * 1000; // 10 minutes

function startSelfPing() {
  if (!RENDER_URL && process.env.NODE_ENV !== 'production') {
    console.log('⏸️  Self-ping disabled (not production)');
    return;
  }
  const pingUrl = RENDER_URL
    ? `${RENDER_URL}/api/health`
    : `http://localhost:${PORT}/api/health`;

  console.log(`🏓 Self-ping enabled: ${pingUrl} every 10 min`);

  setInterval(async () => {
    try {
      const https = pingUrl.startsWith('https') ? require('https') : require('http');
      https.get(pingUrl, (res) => {
        console.log(`🏓 Ping OK: ${res.statusCode} at ${new Date().toLocaleTimeString()}`);
      }).on('error', (err) => {
        console.log(`🏓 Ping failed: ${err.message}`);
      });
    } catch (err) {
      console.log(`🏓 Ping error: ${err.message}`);
    }
  }, SELF_PING_INTERVAL);
}

if (require.main === module) {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 DrinkBuddy Backend running on port ${PORT}`);
    console.log(`🔌 Socket.io ready`);
    console.log(`📱 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 Health: http://localhost:${PORT}/api/health`);

    startSelfPing();
  });
}

module.exports = app;
