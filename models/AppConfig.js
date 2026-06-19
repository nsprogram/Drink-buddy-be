const mongoose = require('mongoose');

/**
 * Singleton app-config document.
 * Only one document ever exists (configKey = 'global').
 * Admin writes via PUT /api/app-config (admin auth required).
 * Mobile app reads via GET /api/app-config (public, no auth).
 */
const appConfigSchema = new mongoose.Schema(
  {
    configKey: { type: String, default: 'global', unique: true },
    drinkCooldownSeconds: { type: Number, default: 120, min: 10, max: 3600 },
    sessionMaxDrinks:     { type: Number, default: 0,   min: 0, max: 100 },
    updatedBy:            { type: String, default: 'admin' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AppConfig', appConfigSchema);
