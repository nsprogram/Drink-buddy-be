/**
 * Health Report controller
 * ────────────────────────
 * Reads the user's drinking sessions + room participation, computes
 * realistic health metrics (BAC approximation via Widmark formula,
 * weekly/monthly drink counts, consistency, risk level), then returns
 * personalized health, workout, and improvement tips.
 *
 * NOTE: BAC estimation is a public-safety approximation based on
 * drink count × standard drink alcohol mass. It assumes defaults for
 * weight (70 kg) and gender factor (0.68) unless the user profile
 * has more specific data. Not for legal or medical use.
 */

const DrinkingSession = require('../models/DrinkingSession');
const Room = require('../models/Room');
const User = require('../models/User');

// ── Constants ──
const STANDARD_DRINK_G = 14;          // grams of pure ethanol per "standard drink" (US)
const WEIGHT_KG_DEFAULT = 70;
const WIDMARK_R_DEFAULT = 0.68;       // averaged body-water distribution factor
const BAC_ELIMINATION = 0.015;        // BAC drops per hour
const LOW_RISK_WEEKLY = 14;           // WHO low-risk threshold
const MODERATE_WEEKLY = 21;           // moderate-risk upper bound

// ── Helpers ──
function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function daysAgo(n) { const d = startOfDay(new Date()); d.setDate(d.getDate() - n); return d; }

// Widmark formula (approximate):
//   BAC % = (A_grams / (W_kg × r)) × 100% - elimination × hours_elapsed
function estimateBAC({ drinkCount = 0, hours = 0, weightKg = WEIGHT_KG_DEFAULT, r = WIDMARK_R_DEFAULT }) {
  if (drinkCount <= 0 || weightKg <= 0) return 0;
  const grams = drinkCount * STANDARD_DRINK_G;
  const raw = (grams / (weightKg * 1000 * r)) * 100;
  const adjusted = Math.max(0, raw - BAC_ELIMINATION * Math.max(0, hours));
  return Number(adjusted.toFixed(3));
}

// Classify BAC into a friendly level
function bacClass(bac) {
  if (bac === 0) return { level: 'sober', label: 'Sober', color: '#22C55E' };
  if (bac < 0.03) return { level: 'minimal', label: 'Minimal', color: '#22C55E' };
  if (bac < 0.06) return { level: 'moderate', label: 'Moderate', color: '#FBBF24' };
  if (bac < 0.08) return { level: 'elevated', label: 'Elevated', color: '#F59E0B' };
  if (bac < 0.15) return { level: 'impaired', label: 'Impaired', color: '#EF4444' };
  return { level: 'danger', label: 'Danger', color: '#991B1B' };
}

// Convert weekly drinks → risk level (0..100 health score)
function riskFromWeekly(weeklyDrinks) {
  if (weeklyDrinks <= 7) return { level: 'low', score: 90, label: 'Low Risk' };
  if (weeklyDrinks <= LOW_RISK_WEEKLY) return { level: 'low', score: 78, label: 'Low Risk' };
  if (weeklyDrinks <= MODERATE_WEEKLY) return { level: 'moderate', score: 55, label: 'Moderate Risk' };
  if (weeklyDrinks <= 35) return { level: 'high', score: 35, label: 'High Risk' };
  return { level: 'severe', score: 15, label: 'Severe Risk' };
}

// ── Tip generators ──
function generateHealthTips(ctx) {
  const tips = [];
  tips.push({ icon: 'Droplets', title: 'Hydrate between drinks', desc: 'Alternate each alcoholic drink with a glass of water. Prevents dehydration and slows absorption.', color: '#3B82F6' });
  if (ctx.weeklyDrinks > LOW_RISK_WEEKLY) {
    tips.push({ icon: 'AlertTriangle', title: 'Cut back this week', desc: `You've had ${ctx.weeklyDrinks} drinks in 7 days — above the WHO low-risk threshold of ${LOW_RISK_WEEKLY}.`, color: '#EF4444' });
  }
  if (ctx.avgSessionHours > 4) {
    tips.push({ icon: 'Clock', title: 'Pace your sessions', desc: `Your average session is ${ctx.avgSessionHours.toFixed(1)}h long. Space drinks across the evening — 1 per hour is safe.`, color: '#FBBF24' });
  }
  tips.push({ icon: 'Utensils', title: 'Eat before drinking', desc: 'A meal with protein and carbs slows alcohol absorption and reduces next-day hangover severity.', color: '#F97316' });
  tips.push({ icon: 'Moon', title: 'Sleep matters', desc: 'Alcohol disrupts REM sleep. Stop drinking at least 3 hours before bed for better recovery.', color: '#8B5CF6' });
  if (ctx.restDaysInWeek < 2) {
    tips.push({ icon: 'Heart', title: 'Take rest days', desc: 'Your liver needs 24-48 hours to fully process alcohol. Aim for 2-3 dry days each week.', color: '#EC4899' });
  }
  if (ctx.peakBAC > 0.08) {
    tips.push({ icon: 'ShieldAlert', title: 'Avoid heavy sessions', desc: 'Your peak BAC this week reached ' + ctx.peakBAC.toFixed(2) + ' — well into impaired range. Stick to 2-3 drinks per outing.', color: '#DC2626' });
  }
  return tips.slice(0, 6);
}

function generateWorkoutTips(ctx) {
  const tips = [];
  tips.push({ icon: 'Activity', title: 'Morning walk', desc: 'A 30-minute walk the morning after drinking clears the mind and aids metabolism.', color: '#22C55E' });
  tips.push({ icon: 'Dumbbell', title: 'Light cardio', desc: '15-20 min of low-intensity cardio (cycling, swimming) helps recovery without stressing a dehydrated body.', color: '#3B82F6' });
  if (ctx.weeklyDrinks > MODERATE_WEEKLY) {
    tips.push({ icon: 'Flame', title: 'Sweat it out', desc: 'Heavy weeks need extra aerobic exercise. Try 45 min zone-2 cardio (brisk walk/steady bike) 3 times this week.', color: '#F97316' });
  }
  tips.push({ icon: 'Stretch', title: 'Stretch & mobility', desc: '10 min of yoga or stretching in the morning reduces alcohol-related muscle tension.', color: '#A855F7' });
  tips.push({ icon: 'Zap', title: 'Strength training', desc: 'Lift weights 2x/week — muscle mass improves alcohol metabolism and protects liver health.', color: '#EF4444' });
  tips.push({ icon: 'Sunrise', title: 'Morning sunlight', desc: 'First-light exposure resets circadian rhythm disrupted by alcohol. Step outside within 30 min of waking.', color: '#FBBF24' });
  return tips.slice(0, 6);
}

function generateImprovementTips(ctx) {
  const tips = [];
  if (ctx.weeklyDrinks > LOW_RISK_WEEKLY) {
    tips.push({ icon: 'Target', title: 'Set a weekly cap', desc: `Target ${LOW_RISK_WEEKLY} drinks per week max. That's ~2/day for 7 days or 4/night for 3 nights.`, color: '#22C55E' });
  } else {
    tips.push({ icon: 'Award', title: 'You\'re within low-risk limits', desc: 'Keep up the moderate consumption. Stay mindful of session intensity.', color: '#22C55E' });
  }
  if (ctx.restDaysInWeek < 2) {
    tips.push({ icon: 'CalendarOff', title: 'Add 2 alcohol-free days', desc: 'Pick two weekdays as consistent dry days. Your liver regenerates fastest with predictable rest.', color: '#A855F7' });
  }
  if (ctx.daysActive > 5) {
    tips.push({ icon: 'TrendingDown', title: 'Reduce drinking frequency', desc: `You drank on ${ctx.daysActive} of the last 7 days. Daily drinking builds tolerance and increases risk — aim for 4 or fewer days.`, color: '#F97316' });
  }
  tips.push({ icon: 'Apple', title: 'Nutrition matters', desc: 'Eat B-vitamin-rich foods (eggs, leafy greens, whole grains) — alcohol depletes thiamine and folate.', color: '#10B981' });
  tips.push({ icon: 'BookOpen', title: 'Journal your triggers', desc: 'Note what drives you to drink (stress, social pressure, boredom) and plan non-alcohol alternatives for each.', color: '#3B82F6' });
  if (ctx.avgSessionHours > 3) {
    tips.push({ icon: 'PauseCircle', title: 'Introduce alcohol-free breaks', desc: 'After 2 drinks, switch to soda/water for an hour. Your session lasts longer and you drink less overall.', color: '#EC4899' });
  }
  tips.push({ icon: 'Users', title: 'Socialize sober too', desc: 'Make plans that don\'t center around drinking — hikes, coffee, sports. Breaks the drinking-equals-fun association.', color: '#FBBF24' });
  return tips.slice(0, 6);
}

// ══════════════════════════════════════════════════════════════════════
//  GET /api/health/report
// ══════════════════════════════════════════════════════════════════════
exports.report = async (req, res) => {
  try {
    const userId = req.user._id;

    // Load user for weight/age context (future expansion)
    const user = await User.findById(userId).select('dateOfBirth age').lean();

    // Time windows
    const now = new Date();
    const sevenDays = daysAgo(6);  // last 7 days inclusive
    const thirtyDays = daysAgo(29);

    // Pull sessions + room participation in parallel
    const [sessions, rooms] = await Promise.all([
      DrinkingSession.find({ user: userId, startTime: { $gte: thirtyDays } })
        .sort('-startTime')
        .lean(),
      Room.find({ 'members.user': userId, createdAt: { $gte: thirtyDays } })
        .lean(),
    ]);

    // Count drinks from room participation (user's drinkSelection quantity)
    let roomDrinks = 0;
    const roomSessionsByDay = {};
    for (const r of rooms) {
      const me = (r.members || []).find(m => m.user?.toString() === userId.toString());
      if (me?.drinkSelection?.quantity) {
        const qty = Number(me.drinkSelection.quantity) || 0;
        roomDrinks += qty;
        const d = startOfDay(r.sessionStartedAt || r.createdAt).toISOString().slice(0, 10);
        roomSessionsByDay[d] = (roomSessionsByDay[d] || 0) + qty;
      }
    }

    // Build per-day drink totals (sessions + rooms)
    const byDay = {};
    for (const s of sessions) {
      if (!s.drinkLog || s.drinkLog.length === 0) {
        const d = startOfDay(s.startTime).toISOString().slice(0, 10);
        byDay[d] = (byDay[d] || 0) + (s.drinkCount || 0);
      } else {
        for (const d of s.drinkLog) {
          const key = startOfDay(d.addedAt || s.startTime).toISOString().slice(0, 10);
          byDay[key] = (byDay[key] || 0) + (d.count || 1);
        }
      }
    }
    for (const [k, v] of Object.entries(roomSessionsByDay)) byDay[k] = (byDay[k] || 0) + v;

    // Weekly & monthly aggregates
    const sevenKey = sevenDays.toISOString().slice(0, 10);
    let weeklyDrinks = 0, monthlyDrinks = 0;
    for (const [k, v] of Object.entries(byDay)) {
      if (k >= thirtyDays.toISOString().slice(0, 10)) monthlyDrinks += v;
      if (k >= sevenKey) weeklyDrinks += v;
    }

    // Session stats (last 30 days)
    const endedSessions = sessions.filter(s => s.status === 'ended');
    const totalSessions = sessions.length;
    const totalDrinks = sessions.reduce((a, s) => a + (s.drinkCount || 0), 0) + roomDrinks;
    const totalHours = endedSessions.reduce((a, s) => a + ((s.duration || 0) / 60), 0);
    const avgSessionHours = endedSessions.length ? totalHours / endedSessions.length : 0;
    const avgDrinksPerSession = totalSessions ? totalDrinks / totalSessions : 0;

    // Days active in last 7 days
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = daysAgo(6 - i);
      return { date: d, key: d.toISOString().slice(0, 10), drinks: 0 };
    });
    for (const day of last7Days) { day.drinks = byDay[day.key] || 0; }
    const daysActive = last7Days.filter(d => d.drinks > 0).length;
    const restDaysInWeek = 7 - daysActive;

    // BAC estimates
    const weightKg = WEIGHT_KG_DEFAULT;
    const peakDayDrinks = Math.max(0, ...last7Days.map(d => d.drinks));
    // Approximate peak BAC as if drinks in one night over 3 hours
    const peakBAC = estimateBAC({ drinkCount: peakDayDrinks, hours: 3, weightKg });
    // Recent BAC — if there's an active session, use its live count; else 0
    const activeSession = sessions.find(s => s.status === 'active');
    let recentBAC = 0;
    if (activeSession) {
      const hoursElapsed = (now - new Date(activeSession.startTime)) / 3600000;
      recentBAC = estimateBAC({ drinkCount: activeSession.drinkCount, hours: hoursElapsed, weightKg });
    }

    const peakClass = bacClass(peakBAC);
    const recentClass = bacClass(recentBAC);
    const risk = riskFromWeekly(weeklyDrinks);

    // Warnings
    const warnings = [];
    if (weeklyDrinks > LOW_RISK_WEEKLY) warnings.push(`${weeklyDrinks} drinks this week — exceeds WHO low-risk threshold (${LOW_RISK_WEEKLY})`);
    if (peakBAC > 0.08) warnings.push(`Peak BAC reached ${peakBAC.toFixed(2)}% — above legal driving limit in most regions`);
    if (daysActive >= 6) warnings.push(`Drinking on ${daysActive} of the last 7 days — increases tolerance and dependency risk`);
    if (avgSessionHours > 5) warnings.push(`Average session length of ${avgSessionHours.toFixed(1)}h is long — consider shorter, more moderate outings`);
    if (warnings.length === 0) warnings.push('Your alcohol consumption is within low-risk guidelines — keep it up.');

    const ctx = { weeklyDrinks, monthlyDrinks, daysActive, restDaysInWeek, avgSessionHours, peakBAC };

    res.json({
      success: true,
      data: {
        summary: {
          totalSessions,
          totalDrinks,
          avgDrinksPerSession: Number(avgDrinksPerSession.toFixed(1)),
          totalHours: Number(totalHours.toFixed(1)),
          daysActive,
          restDaysInWeek,
          weeklyDrinks,
          monthlyDrinks,
          roomParticipation: rooms.length,
          roomDrinks,
        },
        alcoholLevel: {
          recentBAC: Number(recentBAC.toFixed(3)),
          peakBAC: Number(peakBAC.toFixed(3)),
          recentClass,
          peakClass,
          activeSession: activeSession ? {
            name: activeSession.sessionName || 'Active Session',
            drinks: activeSession.drinkCount,
            startTime: activeSession.startTime,
          } : null,
        },
        weeklyTrend: last7Days.map(d => ({
          day: d.date.toLocaleDateString('en-US', { weekday: 'short' }),
          date: d.key,
          drinks: d.drinks,
        })),
        riskAssessment: {
          level: risk.level,
          score: risk.score,
          label: risk.label,
          warnings,
          weeklyLimit: LOW_RISK_WEEKLY,
          weeklyUsagePercent: Math.min(200, Math.round((weeklyDrinks / LOW_RISK_WEEKLY) * 100)),
        },
        healthTips: generateHealthTips(ctx),
        workoutTips: generateWorkoutTips(ctx),
        improvementTips: generateImprovementTips(ctx),
      },
    });
  } catch (err) {
    console.error('Health report error:', err?.message);
    res.status(500).json({ success: false, message: err?.message || 'Failed to generate report' });
  }
};
