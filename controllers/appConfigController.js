const AppConfig = require('../models/AppConfig');

class AppConfigController {
  /**
   * GET /api/app-config
   * Public — mobile app reads this on every session screen load.
   */
  static async getConfig(req, res) {
    try {
      let config = await AppConfig.findOne({ configKey: 'global' }).lean();
      if (!config) {
        // Return defaults if no config has been saved yet
        config = { drinkCooldownSeconds: 120, sessionMaxDrinks: 0 };
      }
      res.json({
        success: true,
        data: {
          drinkCooldownSeconds: config.drinkCooldownSeconds,
          sessionMaxDrinks:     config.sessionMaxDrinks,
          updatedAt:            config.updatedAt || null,
        },
      });
    } catch (error) {
      console.error('AppConfig getConfig error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch app config' });
    }
  }

  /**
   * PUT /api/app-config
   * Admin only — admin panel calls this when saving session settings.
   */
  static async saveConfig(req, res) {
    try {
      const { drinkCooldownSeconds, sessionMaxDrinks } = req.body;

      const update = {};
      if (drinkCooldownSeconds !== undefined) {
        const val = Number(drinkCooldownSeconds);
        if (isNaN(val) || val < 10 || val > 3600) {
          return res.status(400).json({ success: false, message: 'drinkCooldownSeconds must be 10-3600' });
        }
        update.drinkCooldownSeconds = val;
      }
      if (sessionMaxDrinks !== undefined) {
        const val = Number(sessionMaxDrinks);
        if (isNaN(val) || val < 0 || val > 100) {
          return res.status(400).json({ success: false, message: 'sessionMaxDrinks must be 0-100' });
        }
        update.sessionMaxDrinks = val;
      }

      if (Object.keys(update).length === 0) {
        return res.status(400).json({ success: false, message: 'No valid fields to update' });
      }

      update.updatedBy = req.user?.email || 'admin';

      const config = await AppConfig.findOneAndUpdate(
        { configKey: 'global' },
        { $set: update },
        { upsert: true, new: true, runValidators: true }
      ).lean();

      res.json({
        success: true,
        message: 'App config saved',
        data: {
          drinkCooldownSeconds: config.drinkCooldownSeconds,
          sessionMaxDrinks:     config.sessionMaxDrinks,
          updatedAt:            config.updatedAt,
        },
      });
    } catch (error) {
      console.error('AppConfig saveConfig error:', error);
      res.status(500).json({ success: false, message: 'Failed to save app config' });
    }
  }
}

module.exports = AppConfigController;
