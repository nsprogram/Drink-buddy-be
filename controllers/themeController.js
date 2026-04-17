const Theme = require('../models/Theme');

// ══════════════════════════════════════════════════════════════
//  6 Premium Preset Themes — each a complete design story
// ══════════════════════════════════════════════════════════════
const PRESETS = {
  // 1. CLASSIC ORANGE — warm, energetic, social
  classic: {
    mode: 'dark',
    colors: {
      bg: '#0F1118', bgCard: '#1A1D29', bgCardAlt: '#252936',
      primary: '#FF9F43', primaryLight: '#FFB86C', accent: '#FF6B35',
      text: '#FFFFFF', textSecondary: 'rgba(255,255,255,0.72)', textMuted: 'rgba(255,255,255,0.45)',
      border: 'rgba(255,159,67,0.12)', iconColor: '#FF9F43',
      success: '#10B981', error: '#EF4444', warning: '#F59E0B', info: '#3B82F6',
    },
    header: { height: 64, bgColor: '#0F1118', textColor: '#FFFFFF', gradient: false },
    card: { borderRadius: 16, padding: 16, margin: 8, bgColor: '#1A1D29', borderColor: 'rgba(255,159,67,0.1)', borderWidth: 1 },
    bottomNav: { bgColor: '#0F1118', activeIconColor: '#FF9F43', inactiveIconColor: 'rgba(255,255,255,0.45)', borderColor: 'rgba(255,255,255,0.08)', height: 70 },
    typography: { fontFamily: 'Poppins', baseSize: 14, headingSize: 24 },
  },

  // 2. MIDNIGHT PURPLE — premium, glassmorphic, elegant
  purple: {
    mode: 'dark',
    colors: {
      bg: '#0D0618', bgCard: '#1A1032', bgCardAlt: '#2B1852',
      primary: '#C084FC', primaryLight: '#E9D5FF', accent: '#F472B6',
      text: '#FFFFFF', textSecondary: 'rgba(233,213,255,0.85)', textMuted: 'rgba(233,213,255,0.5)',
      border: 'rgba(192,132,252,0.18)', iconColor: '#D8B4FE',
      success: '#34D399', error: '#FB7185', warning: '#FCD34D', info: '#60A5FA',
    },
    header: { height: 72, bgColor: '#0D0618', textColor: '#FFFFFF', gradient: true, gradientColors: ['#0D0618', '#1A1032'] },
    card: { borderRadius: 22, padding: 18, margin: 10, bgColor: '#1A1032', borderColor: 'rgba(192,132,252,0.15)', borderWidth: 1 },
    bottomNav: { bgColor: '#0D0618', activeIconColor: '#C084FC', inactiveIconColor: 'rgba(233,213,255,0.45)', borderColor: 'rgba(192,132,252,0.1)', height: 74 },
    typography: { fontFamily: 'Inter', baseSize: 14, headingSize: 26 },
  },

  // 3. OCEAN BREEZE — cool, calm, professional
  ocean: {
    mode: 'dark',
    colors: {
      bg: '#061019', bgCard: '#0F1F33', bgCardAlt: '#1A2D4A',
      primary: '#3B82F6', primaryLight: '#93C5FD', accent: '#22D3EE',
      text: '#FFFFFF', textSecondary: 'rgba(147,197,253,0.85)', textMuted: 'rgba(147,197,253,0.5)',
      border: 'rgba(59,130,246,0.18)', iconColor: '#60A5FA',
      success: '#34D399', error: '#F87171', warning: '#FBBF24', info: '#22D3EE',
    },
    header: { height: 64, bgColor: '#061019', textColor: '#FFFFFF', gradient: true, gradientColors: ['#061019', '#0F1F33'] },
    card: { borderRadius: 14, padding: 16, margin: 8, bgColor: '#0F1F33', borderColor: 'rgba(59,130,246,0.15)', borderWidth: 1 },
    bottomNav: { bgColor: '#061019', activeIconColor: '#60A5FA', inactiveIconColor: 'rgba(147,197,253,0.45)', borderColor: 'rgba(59,130,246,0.1)', height: 70 },
    typography: { fontFamily: 'Roboto', baseSize: 14, headingSize: 24 },
  },

  // 4. FOREST EMERALD — natural, fresh, healthy
  forest: {
    mode: 'dark',
    colors: {
      bg: '#061510', bgCard: '#0E2B1E', bgCardAlt: '#1A4030',
      primary: '#10B981', primaryLight: '#6EE7B7', accent: '#A3E635',
      text: '#FFFFFF', textSecondary: 'rgba(167,243,208,0.85)', textMuted: 'rgba(167,243,208,0.5)',
      border: 'rgba(16,185,129,0.2)', iconColor: '#34D399',
      success: '#10B981', error: '#F87171', warning: '#FBBF24', info: '#60A5FA',
    },
    header: { height: 64, bgColor: '#061510', textColor: '#FFFFFF', gradient: true, gradientColors: ['#061510', '#0E2B1E'] },
    card: { borderRadius: 18, padding: 16, margin: 8, bgColor: '#0E2B1E', borderColor: 'rgba(16,185,129,0.15)', borderWidth: 1 },
    bottomNav: { bgColor: '#061510', activeIconColor: '#10B981', inactiveIconColor: 'rgba(167,243,208,0.45)', borderColor: 'rgba(16,185,129,0.12)', height: 72 },
    typography: { fontFamily: 'Nunito', baseSize: 14, headingSize: 24 },
  },

  // 5. SUNSET MAGENTA — vibrant, playful, Instagram-ish
  sunset: {
    mode: 'dark',
    colors: {
      bg: '#140914', bgCard: '#2A0F26', bgCardAlt: '#3F1538',
      primary: '#EC4899', primaryLight: '#F9A8D4', accent: '#FB923C',
      text: '#FFFFFF', textSecondary: 'rgba(249,168,212,0.85)', textMuted: 'rgba(249,168,212,0.5)',
      border: 'rgba(236,72,153,0.2)', iconColor: '#F472B6',
      success: '#34D399', error: '#F43F5E', warning: '#FB923C', info: '#A78BFA',
    },
    header: { height: 72, bgColor: '#140914', textColor: '#FFFFFF', gradient: true, gradientColors: ['#140914', '#2A0F26'] },
    card: { borderRadius: 24, padding: 18, margin: 10, bgColor: '#2A0F26', borderColor: 'rgba(236,72,153,0.18)', borderWidth: 1 },
    bottomNav: { bgColor: '#140914', activeIconColor: '#EC4899', inactiveIconColor: 'rgba(249,168,212,0.45)', borderColor: 'rgba(236,72,153,0.12)', height: 74 },
    typography: { fontFamily: 'Quicksand', baseSize: 14, headingSize: 26 },
  },

  // 6. CRIMSON GOLD — luxurious, bold, high-end
  crimson: {
    mode: 'dark',
    colors: {
      bg: '#0A0606', bgCard: '#1A0A0A', bgCardAlt: '#2A1010',
      primary: '#DC2626', primaryLight: '#FCA5A5', accent: '#FBBF24',
      text: '#FFFFFF', textSecondary: 'rgba(252,165,165,0.85)', textMuted: 'rgba(252,165,165,0.5)',
      border: 'rgba(220,38,38,0.2)', iconColor: '#EF4444',
      success: '#10B981', error: '#DC2626', warning: '#FBBF24', info: '#60A5FA',
    },
    header: { height: 68, bgColor: '#0A0606', textColor: '#FFFFFF', gradient: true, gradientColors: ['#0A0606', '#1A0A0A'] },
    card: { borderRadius: 16, padding: 16, margin: 8, bgColor: '#1A0A0A', borderColor: 'rgba(220,38,38,0.15)', borderWidth: 1 },
    bottomNav: { bgColor: '#0A0606', activeIconColor: '#DC2626', inactiveIconColor: 'rgba(252,165,165,0.45)', borderColor: 'rgba(220,38,38,0.12)', height: 70 },
    typography: { fontFamily: 'Playfair Display', baseSize: 14, headingSize: 26 },
  },

  // 7. LIGHT DAY — clean daytime mode
  light: {
    mode: 'light',
    colors: {
      bg: '#F8FAFC', bgCard: '#FFFFFF', bgCardAlt: '#F1F5F9',
      primary: '#F97316', primaryLight: '#FDBA74', accent: '#FB923C',
      text: '#0F172A', textSecondary: 'rgba(15,23,42,0.72)', textMuted: 'rgba(15,23,42,0.45)',
      border: 'rgba(15,23,42,0.08)', iconColor: '#F97316',
      success: '#059669', error: '#DC2626', warning: '#D97706', info: '#2563EB',
    },
    header: { height: 64, bgColor: '#FFFFFF', textColor: '#0F172A', gradient: false },
    card: { borderRadius: 16, padding: 16, margin: 8, bgColor: '#FFFFFF', borderColor: 'rgba(15,23,42,0.08)', borderWidth: 1 },
    bottomNav: { bgColor: '#FFFFFF', activeIconColor: '#F97316', inactiveIconColor: 'rgba(15,23,42,0.45)', borderColor: 'rgba(15,23,42,0.08)', height: 70 },
    typography: { fontFamily: 'Poppins', baseSize: 14, headingSize: 24 },
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
