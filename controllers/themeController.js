const Theme = require('../models/Theme');

// ══════════════════════════════════════════════════════════════
//  5 DISTINCT APP DESIGN LANGUAGES
//  Each preset is a complete UI/UX transformation — not just color:
//  radius, padding, density, shape, shadow, card style, header style,
//  typography weight/spacing, and icon sizes all change.
// ══════════════════════════════════════════════════════════════
const PRESETS = {

  // 1. CLASSIC ORANGE — balanced, energetic, default
  //    Shape: SOFT rounded | Density: COZY | Cards: ELEVATED | Header: MINIMAL
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
    typography: { fontFamily: 'Poppins', baseSize: 14, headingSize: 24, fontWeight: '700', letterSpacing: 0 },
    design: { density: 'cozy', shape: 'soft', shadow: 'medium', cardStyle: 'elevated', headerStyle: 'minimal', iconSize: 20, spacing: 16 },
  },

  // 2. GLASS PREMIUM (purple) — luxurious, glassmorphic, elegant
  //    Shape: ROUND (big radius) | Density: SPACIOUS | Cards: GLASS | Header: GLASS+GRADIENT
  purple: {
    mode: 'dark',
    colors: {
      bg: '#0D0618', bgCard: 'rgba(26,16,50,0.75)', bgCardAlt: 'rgba(43,24,82,0.6)',
      primary: '#C084FC', primaryLight: '#E9D5FF', accent: '#F472B6',
      text: '#FFFFFF', textSecondary: 'rgba(233,213,255,0.85)', textMuted: 'rgba(233,213,255,0.5)',
      border: 'rgba(192,132,252,0.25)', iconColor: '#D8B4FE',
      success: '#34D399', error: '#FB7185', warning: '#FCD34D', info: '#60A5FA',
    },
    header: { height: 84, bgColor: '#0D0618', textColor: '#FFFFFF', gradient: true, gradientColors: ['#0D0618', '#2B1852'] },
    card: { borderRadius: 26, padding: 22, margin: 12, bgColor: 'rgba(26,16,50,0.75)', borderColor: 'rgba(192,132,252,0.25)', borderWidth: 1 },
    bottomNav: { bgColor: 'rgba(13,6,24,0.85)', activeIconColor: '#C084FC', inactiveIconColor: 'rgba(233,213,255,0.4)', borderColor: 'rgba(192,132,252,0.15)', height: 78 },
    typography: { fontFamily: 'Inter', baseSize: 15, headingSize: 28, fontWeight: '600', letterSpacing: 0.3 },
    design: { density: 'spacious', shape: 'round', shadow: 'glow', cardStyle: 'glass', headerStyle: 'glass', iconSize: 22, spacing: 20 },
  },

  // 3. MINIMAL SHARP (ocean) — clean, professional, flat
  //    Shape: SHARP corners | Density: COMPACT | Cards: FLAT/BORDERED | Header: MINIMAL
  ocean: {
    mode: 'dark',
    colors: {
      bg: '#08111B', bgCard: '#0E1A2A', bgCardAlt: '#15263C',
      primary: '#3B82F6', primaryLight: '#93C5FD', accent: '#22D3EE',
      text: '#FFFFFF', textSecondary: 'rgba(147,197,253,0.88)', textMuted: 'rgba(147,197,253,0.5)',
      border: 'rgba(59,130,246,0.3)', iconColor: '#60A5FA',
      success: '#34D399', error: '#F87171', warning: '#FBBF24', info: '#22D3EE',
    },
    header: { height: 56, bgColor: '#08111B', textColor: '#FFFFFF', gradient: false },
    card: { borderRadius: 6, padding: 14, margin: 6, bgColor: '#0E1A2A', borderColor: 'rgba(59,130,246,0.3)', borderWidth: 1.5 },
    bottomNav: { bgColor: '#08111B', activeIconColor: '#3B82F6', inactiveIconColor: 'rgba(147,197,253,0.4)', borderColor: 'rgba(59,130,246,0.25)', height: 64 },
    typography: { fontFamily: 'Roboto', baseSize: 13, headingSize: 22, fontWeight: '500', letterSpacing: 0.5 },
    design: { density: 'compact', shape: 'sharp', shadow: 'none', cardStyle: 'bordered', headerStyle: 'minimal', iconSize: 18, spacing: 12 },
  },

  // 4. NEUMORPHIC SOFT (forest) — pillowy, rounded, gentle shadows
  //    Shape: ROUND (very big radius) | Density: SPACIOUS | Cards: NEUMORPHIC | Header: HERO
  forest: {
    mode: 'dark',
    colors: {
      bg: '#0C1A15', bgCard: '#16302A', bgCardAlt: '#1F4238',
      primary: '#10B981', primaryLight: '#6EE7B7', accent: '#A3E635',
      text: '#FFFFFF', textSecondary: 'rgba(167,243,208,0.88)', textMuted: 'rgba(167,243,208,0.5)',
      border: 'rgba(16,185,129,0.15)', iconColor: '#34D399',
      success: '#10B981', error: '#F87171', warning: '#FBBF24', info: '#60A5FA',
    },
    header: { height: 92, bgColor: '#0C1A15', textColor: '#FFFFFF', gradient: true, gradientColors: ['#0C1A15', '#1F4238'] },
    card: { borderRadius: 28, padding: 24, margin: 14, bgColor: '#16302A', borderColor: 'rgba(16,185,129,0.08)', borderWidth: 1 },
    bottomNav: { bgColor: '#0C1A15', activeIconColor: '#10B981', inactiveIconColor: 'rgba(167,243,208,0.4)', borderColor: 'rgba(16,185,129,0.1)', height: 82 },
    typography: { fontFamily: 'Nunito', baseSize: 15, headingSize: 26, fontWeight: '700', letterSpacing: -0.2 },
    design: { density: 'spacious', shape: 'round', shadow: 'soft', cardStyle: 'neumorphic', headerStyle: 'hero', iconSize: 24, spacing: 20 },
  },

  // 5. BOLD VIBRANT (sunset) — brutalist, bold, Instagram-energy
  //    Shape: PILL (huge radius) | Density: SPACIOUS | Cards: BORDERED THICK | Header: BOLD
  sunset: {
    mode: 'dark',
    colors: {
      bg: '#140914', bgCard: '#2A0F26', bgCardAlt: '#3F1538',
      primary: '#EC4899', primaryLight: '#F9A8D4', accent: '#FB923C',
      text: '#FFFFFF', textSecondary: 'rgba(249,168,212,0.9)', textMuted: 'rgba(249,168,212,0.55)',
      border: 'rgba(236,72,153,0.4)', iconColor: '#F472B6',
      success: '#34D399', error: '#F43F5E', warning: '#FB923C', info: '#A78BFA',
    },
    header: { height: 88, bgColor: '#140914', textColor: '#FFFFFF', gradient: true, gradientColors: ['#140914', '#3F1538'] },
    card: { borderRadius: 32, padding: 20, margin: 12, bgColor: '#2A0F26', borderColor: 'rgba(236,72,153,0.4)', borderWidth: 2.5 },
    bottomNav: { bgColor: '#140914', activeIconColor: '#EC4899', inactiveIconColor: 'rgba(249,168,212,0.45)', borderColor: 'rgba(236,72,153,0.3)', height: 80 },
    typography: { fontFamily: 'Quicksand', baseSize: 15, headingSize: 30, fontWeight: '800', letterSpacing: -0.3 },
    design: { density: 'spacious', shape: 'pill', shadow: 'heavy', cardStyle: 'bordered', headerStyle: 'bold', iconSize: 26, spacing: 18 },
  },
};

// GET /api/theme — public, for mobile app to fetch
exports.getTheme = async (req, res) => {
  try {
    let theme = await Theme.findOne({ key: 'active' });
    if (!theme) theme = await Theme.create({ key: 'active' });
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

    const io = req.app.get('io');
    if (io) io.emit('theme:updated', theme.toObject());

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
