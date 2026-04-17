const Theme = require('../models/Theme');

// Built-in presets
const PRESETS = {
  classic: {
    mode: 'dark',
    colors: { bg: '#0F1118', bgCard: '#1A1D29', primary: '#FF9F43', primaryLight: '#FFB86C', accent: '#FF9F43', text: '#FFFFFF', iconColor: '#FF9F43' },
    header: { bgColor: '#0F1118', textColor: '#FFFFFF', gradient: false },
    card: { borderRadius: 16, padding: 16, bgColor: '#1A1D29' },
    bottomNav: { bgColor: '#0F1118', activeIconColor: '#FF9F43' },
    typography: { fontFamily: 'Poppins' },
  },
  purple: {
    mode: 'dark',
    colors: { bg: '#150E20', bgCard: '#1E1630', primary: '#C084FC', primaryLight: '#D8B4FE', accent: '#F472B6', text: '#FFFFFF', iconColor: '#C084FC' },
    header: { bgColor: '#150E20', textColor: '#FFFFFF', gradient: true, gradientColors: ['#150E20', '#1E1630'] },
    card: { borderRadius: 20, padding: 18, bgColor: '#1E1630' },
    bottomNav: { bgColor: '#150E20', activeIconColor: '#C084FC' },
    typography: { fontFamily: 'Inter' },
  },
  ocean: {
    mode: 'dark',
    colors: { bg: '#0A1929', bgCard: '#132F4C', primary: '#2196F3', primaryLight: '#64B5F6', accent: '#00BCD4', text: '#FFFFFF', iconColor: '#64B5F6' },
    header: { bgColor: '#0A1929', textColor: '#FFFFFF' },
    card: { borderRadius: 14, padding: 16, bgColor: '#132F4C' },
    bottomNav: { bgColor: '#0A1929', activeIconColor: '#64B5F6' },
    typography: { fontFamily: 'Roboto' },
  },
  forest: {
    mode: 'dark',
    colors: { bg: '#0F1F0F', bgCard: '#1A2E1A', primary: '#10B981', primaryLight: '#34D399', accent: '#22D3EE', text: '#FFFFFF', iconColor: '#34D399' },
    header: { bgColor: '#0F1F0F', textColor: '#FFFFFF' },
    card: { borderRadius: 18, padding: 16, bgColor: '#1A2E1A' },
    bottomNav: { bgColor: '#0F1F0F', activeIconColor: '#34D399' },
    typography: { fontFamily: 'Nunito' },
  },
  sunset: {
    mode: 'dark',
    colors: { bg: '#1F0A1A', bgCard: '#2D1326', primary: '#F472B6', primaryLight: '#FDA4AF', accent: '#FB923C', text: '#FFFFFF', iconColor: '#F472B6' },
    header: { bgColor: '#1F0A1A', textColor: '#FFFFFF' },
    card: { borderRadius: 22, padding: 18, bgColor: '#2D1326' },
    bottomNav: { bgColor: '#1F0A1A', activeIconColor: '#F472B6' },
    typography: { fontFamily: 'Quicksand' },
  },
  light: {
    mode: 'light',
    colors: { bg: '#FAFAFA', bgCard: '#FFFFFF', primary: '#FF9F43', primaryLight: '#FFB86C', accent: '#FF9F43', text: '#1A1D29', textSecondary: 'rgba(26,29,41,0.7)', textMuted: 'rgba(26,29,41,0.45)', border: 'rgba(0,0,0,0.08)', iconColor: '#FF9F43' },
    header: { bgColor: '#FFFFFF', textColor: '#1A1D29' },
    card: { borderRadius: 16, padding: 16, bgColor: '#FFFFFF', borderColor: 'rgba(0,0,0,0.08)' },
    bottomNav: { bgColor: '#FFFFFF', activeIconColor: '#FF9F43', inactiveIconColor: 'rgba(26,29,41,0.45)', borderColor: 'rgba(0,0,0,0.08)' },
    typography: { fontFamily: 'Poppins' },
  },
};

// GET /api/theme — public, for mobile app to fetch
exports.getTheme = async (req, res) => {
  try {
    let theme = await Theme.findOne({ key: 'active' });
    if (!theme) {
      theme = await Theme.create({ key: 'active' });
    }
    res.json({ success: true, data: theme });
  } catch (err) {
    console.error('Get theme error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/theme/presets — list available presets
exports.getPresets = async (req, res) => {
  try {
    const list = Object.entries(PRESETS).map(([key, value]) => ({ key, ...value }));
    res.json({ success: true, data: list });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/theme — admin only, update theme
exports.updateTheme = async (req, res) => {
  try {
    const updates = req.body;
    let theme = await Theme.findOne({ key: 'active' });
    if (!theme) theme = new Theme({ key: 'active' });

    // Deep merge updates
    Object.keys(updates).forEach(k => {
      if (k === 'key' || k === '_id') return;
      if (typeof updates[k] === 'object' && updates[k] !== null && !Array.isArray(updates[k])) {
        theme[k] = { ...(theme[k]?.toObject ? theme[k].toObject() : theme[k] || {}), ...updates[k] };
      } else {
        theme[k] = updates[k];
      }
    });

    theme.updatedBy = req.user?._id;
    await theme.save();

    // Broadcast theme update via Socket.io for real-time updates
    const io = req.app.get('io');
    if (io) {
      io.emit('theme:updated', theme.toObject());
    }

    res.json({ success: true, data: theme, message: 'Theme updated' });
  } catch (err) {
    console.error('Update theme error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/theme/apply-preset — apply a preset by key
exports.applyPreset = async (req, res) => {
  try {
    const { preset } = req.body;
    if (!PRESETS[preset]) return res.status(400).json({ success: false, message: 'Unknown preset' });

    let theme = await Theme.findOne({ key: 'active' });
    if (!theme) theme = new Theme({ key: 'active' });

    const p = PRESETS[preset];
    theme.mode = p.mode;
    theme.preset = preset;
    Object.keys(p).forEach(k => {
      if (k === 'mode' || k === 'preset') return;
      if (typeof p[k] === 'object') theme[k] = { ...(theme[k]?.toObject ? theme[k].toObject() : theme[k]), ...p[k] };
      else theme[k] = p[k];
    });

    theme.updatedBy = req.user?._id;
    await theme.save();

    const io = req.app.get('io');
    if (io) io.emit('theme:updated', theme.toObject());

    res.json({ success: true, data: theme, message: `Applied "${preset}" preset` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/theme/reset — reset to defaults
exports.resetTheme = async (req, res) => {
  try {
    await Theme.deleteOne({ key: 'active' });
    const theme = await Theme.create({ key: 'active' });
    const io = req.app.get('io');
    if (io) io.emit('theme:updated', theme.toObject());
    res.json({ success: true, data: theme, message: 'Theme reset to defaults' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
