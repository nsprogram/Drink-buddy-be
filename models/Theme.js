const mongoose = require('mongoose');

// Singleton theme document - only one exists in the DB
const themeSchema = new mongoose.Schema({
  key: { type: String, default: 'active', unique: true, index: true },

  // Theme mode
  mode: { type: String, enum: ['dark', 'light'], default: 'dark' },
  preset: { type: String, default: 'classic' },

  // Core colors
  colors: {
    bg: { type: String, default: '#0F1118' },
    bgCard: { type: String, default: '#1A1D29' },
    bgCardAlt: { type: String, default: '#252A36' },
    primary: { type: String, default: '#FF9F43' },
    primaryLight: { type: String, default: '#FFB86C' },
    accent: { type: String, default: '#FF9F43' },
    text: { type: String, default: '#FFFFFF' },
    textSecondary: { type: String, default: 'rgba(255,255,255,0.7)' },
    textMuted: { type: String, default: 'rgba(255,255,255,0.45)' },
    border: { type: String, default: 'rgba(255,255,255,0.1)' },
    success: { type: String, default: '#10B981' },
    error: { type: String, default: '#EF4444' },
    warning: { type: String, default: '#F59E0B' },
    info: { type: String, default: '#3B82F6' },
    iconColor: { type: String, default: '#FF9F43' },
  },

  // Header (home screen)
  header: {
    height: { type: Number, default: 64 },
    bgColor: { type: String, default: '#0F1118' },
    gradient: { type: Boolean, default: false },
    gradientColors: { type: [String], default: ['#0F1118', '#1A1D29'] },
    textColor: { type: String, default: '#FFFFFF' },
  },

  // Card styling
  card: {
    borderRadius: { type: Number, default: 16 },
    padding: { type: Number, default: 16 },
    margin: { type: Number, default: 8 },
    bgColor: { type: String, default: '#1A1D29' },
    borderColor: { type: String, default: 'rgba(255,255,255,0.08)' },
    borderWidth: { type: Number, default: 1 },
    shadowColor: { type: String, default: '#FF9F43' },
    shadowOpacity: { type: Number, default: 0.15 },
  },

  // Bottom navigation
  bottomNav: {
    bgColor: { type: String, default: '#0F1118' },
    activeIconColor: { type: String, default: '#FF9F43' },
    inactiveIconColor: { type: String, default: 'rgba(255,255,255,0.45)' },
    borderColor: { type: String, default: 'rgba(255,255,255,0.08)' },
    height: { type: Number, default: 70 },
  },

  // Typography
  typography: {
    fontFamily: { type: String, default: 'Poppins' }, // Google Font name
    fontFamilyUrl: { type: String, default: null }, // Optional custom font URL
    baseSize: { type: Number, default: 14 },
    headingSize: { type: Number, default: 24 },
    fontWeight: { type: String, default: '700' },
    letterSpacing: { type: Number, default: 0 },
  },

  // Design language — differentiates the 5 presets beyond just color
  design: {
    density: { type: String, enum: ['compact', 'cozy', 'spacious'], default: 'cozy' },
    shape: { type: String, enum: ['sharp', 'soft', 'round', 'pill'], default: 'soft' },
    shadow: { type: String, enum: ['none', 'soft', 'medium', 'glow', 'heavy'], default: 'medium' },
    cardStyle: { type: String, enum: ['flat', 'elevated', 'glass', 'bordered', 'neumorphic'], default: 'elevated' },
    headerStyle: { type: String, enum: ['minimal', 'gradient', 'glass', 'hero', 'bold'], default: 'minimal' },
    iconSize: { type: Number, default: 20 },
    spacing: { type: Number, default: 16 },
  },

  // Metadata
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  version: { type: Number, default: 1 },
}, { timestamps: true });

// Increment version on save
themeSchema.pre('save', function (next) {
  if (!this.isNew) this.version += 1;
  next();
});

module.exports = mongoose.model('Theme', themeSchema);
