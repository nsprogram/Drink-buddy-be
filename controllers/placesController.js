/**
 * Places API — powered by OpenStreetMap Overpass (FREE, no API key).
 * Returns real bars, restaurants, and cafes worldwide with:
 *   - Exact distance in km
 *   - Deterministic ratings + realistic sample reviews
 *   - INR pricing (₹ / ₹₹ / ₹₹₹ / ₹₹₹₹)
 *   - Rich amenities: wifi, outdoor seating, delivery, vegetarian, etc.
 *   - Cuisine info from OSM
 *   - Opening hours, phone, website, address
 *
 * Endpoints:
 *   GET /api/places/nearby?lat=&lng=&radius=&type=&search=  (protected)
 *   GET /api/places/details/:placeId                         (protected)
 *   GET /api/places/photo?ref=                               (public)
 */

const crypto = require('crypto');

const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
];

// ═══════════════════════════════════════════════════════════════
//  CURATED STOCK IMAGES (rotated by name hash — deterministic)
// ═══════════════════════════════════════════════════════════════
const STOCK = {
  bar: [
    'https://images.unsplash.com/photo-1572116469696-31de0f17cc34?w=800&q=80',
    'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800&q=80',
    'https://images.unsplash.com/photo-1543007630-9710e4a00a20?w=800&q=80',
    'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=800&q=80',
    'https://images.unsplash.com/photo-1525268323446-0505b6fe7778?w=800&q=80',
    'https://images.unsplash.com/photo-1566417713940-fe7c737a9ef2?w=800&q=80',
    'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=800&q=80',
    'https://images.unsplash.com/photo-1470158499416-75be9aa0c4db?w=800&q=80',
  ],
  restaurant: [
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80',
    'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80',
    'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80',
    'https://images.unsplash.com/photo-1552566626-52f8b828add9?w=800&q=80',
    'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800&q=80',
    'https://images.unsplash.com/photo-1424847651672-bf20a4b0982b?w=800&q=80',
    'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80',
    'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&q=80',
  ],
  cafe: [
    'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800&q=80',
    'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=800&q=80',
    'https://images.unsplash.com/photo-1445116572660-236099ec97a0?w=800&q=80',
    'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80',
    'https://images.unsplash.com/photo-1453614512568-c4024d13c247?w=800&q=80',
    'https://images.unsplash.com/photo-1559925393-8be0ec4767c8?w=800&q=80',
    'https://images.unsplash.com/photo-1521017432531-fbd92d768814?w=800&q=80',
    'https://images.unsplash.com/photo-1511920170033-f8396924c348?w=800&q=80',
  ],
};

// ═══════════════════════════════════════════════════════════════
//  REVIEW GENERATION POOLS
// ═══════════════════════════════════════════════════════════════
const REVIEWER_NAMES = [
  'Aarav Kumar', 'Priya Sharma', 'Rohan Patel', 'Ananya Singh', 'Vikram Reddy',
  'Kavya Nair', 'Arjun Mehta', 'Isha Gupta', 'Karan Desai', 'Neha Iyer',
  'Aditya Joshi', 'Pooja Malhotra', 'Sameer Khan', 'Diya Chopra', 'Raj Verma',
  'Sanya Rao', 'Varun Kapoor', 'Meera Bhat', 'Yash Agarwal', 'Tara Menon',
];

const REVIEW_POOL_BAR = [
  { r: 5, t: 'Amazing vibes and the cocktails are out of this world. Perfect spot for a night out with friends.' },
  { r: 5, t: 'Best bar in the area! Great music, friendly staff, and the drinks are reasonably priced.' },
  { r: 4, t: 'Really nice ambiance and good selection of drinks. Gets crowded on weekends though.' },
  { r: 5, t: 'Love this place. The bartender mixed an incredible drink for me. Will definitely come back.' },
  { r: 4, t: 'Great place to unwind after work. The happy hour deals are worth checking out.' },
  { r: 4, t: 'Cozy atmosphere and the live music adds to the experience. Drinks are a bit pricey but worth it.' },
  { r: 5, t: 'Fantastic craft beer selection and the food menu pairs perfectly with the drinks.' },
  { r: 3, t: 'Decent spot but service was slow when I visited. Drinks were good though.' },
  { r: 5, t: 'Rooftop view is breathtaking at sunset. The signature cocktails are a must-try.' },
];

const REVIEW_POOL_RESTAURANT = [
  { r: 5, t: 'The food is absolutely delicious. Every dish we tried was cooked to perfection. Highly recommend!' },
  { r: 5, t: 'One of the best dining experiences I have had. The ambience and service are top-notch.' },
  { r: 4, t: 'Great food and portion sizes are generous. Will definitely visit again with family.' },
  { r: 5, t: 'Authentic flavors and fresh ingredients. The chef really knows what they are doing.' },
  { r: 4, t: 'Loved the menu variety. Something for everyone. Prices are reasonable for the quality.' },
  { r: 5, t: 'Perfect date night spot. Romantic setting and the food was absolutely divine.' },
  { r: 3, t: 'Food was good but the wait time was long. Make a reservation to avoid disappointment.' },
  { r: 4, t: 'Delicious and freshly prepared. The staff was attentive and accommodating.' },
  { r: 5, t: 'Amazing biryani and the kebabs are melt-in-mouth. A true gem in the neighborhood.' },
];

const REVIEW_POOL_CAFE = [
  { r: 5, t: 'Best coffee in town! Cozy atmosphere and the pastries are always fresh. My go-to spot.' },
  { r: 5, t: 'Love the vibe of this cafe. Perfect for working remotely with great Wi-Fi and coffee.' },
  { r: 4, t: 'Good coffee and decent snacks. Gets busy during peak hours but worth the wait.' },
  { r: 5, t: 'Their cappuccino is perfection. The staff is super friendly and the place has a homey feel.' },
  { r: 4, t: 'Lovely spot for a quick break. Nice selection of teas and fresh sandwiches.' },
  { r: 5, t: 'Hidden gem! The breakfast menu is fantastic and the coffee is exceptional.' },
  { r: 4, t: 'Great place to catch up with friends. The cakes are freshly baked and delicious.' },
  { r: 3, t: 'Nice cafe but a bit overpriced for the portions. Coffee quality is good though.' },
  { r: 5, t: 'Hands down the best cold coffee I have had. The ambience is perfect for lazy afternoons.' },
];

const TIME_AGO = ['2 days ago', '1 week ago', '2 weeks ago', '3 weeks ago', '1 month ago', '2 months ago', '3 months ago'];

// ═══════════════════════════════════════════════════════════════
//  UTILITIES
// ═══════════════════════════════════════════════════════════════
function hash(str) {
  return parseInt(crypto.createHash('md5').update(String(str || '')).digest('hex').slice(0, 8), 16);
}

function distanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const toRad = (v) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(m) {
  if (m == null) return '—';
  if (m < 100) return `${Math.round(m)} m`;
  if (m < 1000) return `${Math.round(m / 10) * 10} m`;
  return `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`;
}

// ── Better opening_hours parser ──
// Supports: "24/7", "Mo-Su 10:00-23:00", "Mo-Fr 09:00-18:00; Sa-Su 10:00-16:00"
function parseOpenNow(opHours) {
  if (!opHours || typeof opHours !== 'string') return null;
  const lower = opHours.toLowerCase();
  if (lower.includes('24/7')) return true;
  if (lower === 'off' || lower.includes('closed')) return false;

  const now = new Date();
  const dayNames = ['su', 'mo', 'tu', 'we', 'th', 'fr', 'sa'];
  const todayDay = dayNames[now.getDay()];
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // Split semicolon-separated rules
  const rules = opHours.split(';').map(s => s.trim());
  for (const rule of rules) {
    // Pattern: "Mo-Fr 10:00-23:00"
    const match = rule.match(/(mo|tu|we|th|fr|sa|su)(?:-(mo|tu|we|th|fr|sa|su))?\s*([0-9]{1,2}):([0-9]{2})\s*[-\u2013\u2014]\s*([0-9]{1,2}):([0-9]{2})/i);
    if (!match) continue;
    const startDay = dayNames.indexOf(match[1].toLowerCase());
    const endDay = match[2] ? dayNames.indexOf(match[2].toLowerCase()) : startDay;
    const startMin = parseInt(match[3]) * 60 + parseInt(match[4]);
    const endMinRaw = parseInt(match[5]) * 60 + parseInt(match[6]);
    const endMin = endMinRaw === 0 ? 24 * 60 : endMinRaw;
    const todayIdx = dayNames.indexOf(todayDay);
    const inDayRange = endDay >= startDay
      ? todayIdx >= startDay && todayIdx <= endDay
      : todayIdx >= startDay || todayIdx <= endDay;
    if (inDayRange && currentMinutes >= startMin && currentMinutes < endMin) return true;
  }
  // If we parsed rules but none matched, it's closed
  return rules.some(r => /(mo|tu|we|th|fr|sa|su)/i.test(r)) ? false : null;
}

// ── Friendly opening hours display ──
function formatOpeningHours(opHours) {
  if (!opHours) return [];
  if (opHours.includes('24/7')) return ['Open 24 hours'];
  // Split by ; and clean up
  return opHours.split(';').map(s => s.trim()).filter(Boolean).map(s => {
    return s.replace(/mo/gi, 'Mon').replace(/tu/gi, 'Tue').replace(/we/gi, 'Wed')
      .replace(/th/gi, 'Thu').replace(/fr/gi, 'Fri').replace(/sa/gi, 'Sat').replace(/su/gi, 'Sun');
  });
}

// ── Generate deterministic sample reviews ──
function generateReviews(name, category, avgRating, h) {
  const pool = category === 'bar' ? REVIEW_POOL_BAR
    : category === 'cafe' ? REVIEW_POOL_CAFE
    : REVIEW_POOL_RESTAURANT;

  const count = 3 + (h % 3); // 3-5 reviews
  const reviews = [];
  for (let i = 0; i < count; i++) {
    const reviewer = REVIEWER_NAMES[(h + i * 7) % REVIEWER_NAMES.length];
    const review = pool[(h + i * 13) % pool.length];
    const time = TIME_AGO[(h + i * 3) % TIME_AGO.length];
    // Bias rating toward average
    const rating = avgRating >= 4.5 ? Math.max(4, review.r)
      : avgRating >= 4.0 ? review.r
      : Math.min(4, review.r);
    reviews.push({
      author: reviewer,
      rating,
      text: review.t,
      time,
      avatarColor: ['#FF9F43', '#3B82F6', '#22C55E', '#A855F7', '#EC4899', '#FB923C'][(h + i) % 6],
    });
  }
  return reviews;
}

// ── Extract amenities from OSM tags ──
function extractAmenities(tags) {
  const yes = (v) => v === 'yes' || v === 'designated';
  return {
    wifi: yes(tags['internet_access']) || yes(tags['wifi']) || tags['internet_access'] === 'wlan',
    outdoorSeating: yes(tags['outdoor_seating']),
    wheelchair: yes(tags['wheelchair']),
    takeaway: yes(tags['takeaway']),
    delivery: yes(tags['delivery']),
    reservation: yes(tags['reservation']),
    smoking: tags['smoking'] === 'yes' || tags['smoking'] === 'outside',
    nonSmoking: tags['smoking'] === 'no',
    vegetarian: yes(tags['diet:vegetarian']),
    vegan: yes(tags['diet:vegan']),
    halal: yes(tags['diet:halal']),
    parking: yes(tags['parking']) || tags['parking'] != null,
    acceptsCards: yes(tags['payment:credit_cards']) || yes(tags['payment:cards']),
  };
}

// ── INR pricing calculation ──
function getINRPricing(category, h) {
  // Base price ranges in INR
  const ranges = {
    cafe: [
      { symbol: '₹', label: 'Budget', min: 100, max: 300 },
      { symbol: '₹₹', label: 'Moderate', min: 250, max: 500 },
      { symbol: '₹₹₹', label: 'Premium', min: 400, max: 800 },
    ],
    restaurant: [
      { symbol: '₹₹', label: 'Moderate', min: 400, max: 1000 },
      { symbol: '₹₹', label: 'Moderate', min: 600, max: 1500 },
      { symbol: '₹₹₹', label: 'Premium', min: 1000, max: 2500 },
      { symbol: '₹₹₹₹', label: 'Luxury', min: 2000, max: 4500 },
    ],
    bar: [
      { symbol: '₹₹', label: 'Casual', min: 500, max: 1500 },
      { symbol: '₹₹₹', label: 'Upscale', min: 1200, max: 3000 },
      { symbol: '₹₹₹₹', label: 'Premium', min: 2500, max: 5000 },
    ],
  };
  const pool = ranges[category] || ranges.restaurant;
  const pick = pool[h % pool.length];
  const formatINR = (n) => '₹' + n.toLocaleString('en-IN');
  return {
    symbol: pick.symbol,
    label: pick.label,
    range: `${formatINR(pick.min)} - ${formatINR(pick.max)}`,
    rangeFor2: `${formatINR(pick.min)} - ${formatINR(pick.max)} for two`,
    avg: Math.round((pick.min + pick.max) / 2),
  };
}

// ── Query Overpass ──
async function queryOverpass(query, timeoutMs = 25000) {
  const body = `data=${encodeURIComponent(query)}`;
  let lastErr;
  for (const url of OVERPASS_URLS) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeoutMs);
      const res = await fetch(url, {
        method: 'POST',
        body,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'DrinkBuddy/1.0 (drink-buddy-b.onrender.com)',
        },
        signal: ctrl.signal,
      });
      clearTimeout(t);
      if (!res.ok) { lastErr = new Error(`Overpass HTTP ${res.status}`); continue; }
      return await res.json();
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('Overpass API unavailable');
}

// ── Map OSM amenity tag → our category ──
function categoryForAmenity(amenity) {
  if (!amenity) return 'restaurant';
  if (['bar', 'pub', 'biergarten', 'nightclub'].includes(amenity)) return 'bar';
  if (['cafe', 'coffee_shop'].includes(amenity)) return 'cafe';
  return 'restaurant';
}

// ── Normalize OSM element → rich Bar object ──
function normalizeOsm(el, userLat, userLng) {
  const tags = el.tags || {};
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (lat == null || lng == null) return null;

  const name = tags.name || tags['name:en'] || tags['brand'];
  if (!name) return null;

  const category = categoryForAmenity(tags.amenity);
  const typeLabel = category === 'bar' ? 'Bar' : category === 'cafe' ? 'Cafe' : 'Restaurant';

  const dist = Math.round(distanceMeters(userLat, userLng, lat, lng));
  const distanceStr = formatDistance(dist);
  const distanceKm = (dist / 1000).toFixed(dist < 10000 ? 2 : 1);

  // Deterministic hash
  const h = hash(name + Math.round(lat * 10000) + Math.round(lng * 10000));

  // Rating 3.8–4.9 biased by popularity indicators
  const hasWebsite = !!(tags.website || tags['contact:website']);
  const hasPhone = !!(tags.phone || tags['contact:phone']);
  const hasWifi = tags.internet_access === 'yes' || tags.internet_access === 'wlan';
  const popularityBoost = (hasWebsite ? 0.15 : 0) + (hasPhone ? 0.1 : 0) + (hasWifi ? 0.1 : 0);
  const baseRating = 3.8 + ((h % 110) / 100); // 3.80–4.89
  const rating = Math.min(4.9, baseRating + popularityBoost).toFixed(1);
  const ratingValue = parseFloat(rating);
  const userRatingsTotal = 30 + (h % 850);

  // Image
  const pool = STOCK[category] || STOCK.restaurant;
  const image = pool[h % pool.length];
  const gallery = [0, 1, 2, 3, 4].map(i => pool[(h + i) % pool.length]);

  // Opening status
  const openingHoursRaw = tags.opening_hours;
  const openNow = parseOpenNow(openingHoursRaw);
  const openingHours = formatOpeningHours(openingHoursRaw);

  // Pricing (INR)
  const pricing = getINRPricing(category, h);

  // Cuisine info
  const cuisines = (tags.cuisine || '').split(';').map(s => s.trim()).filter(Boolean);

  // Address
  const addressParts = [
    tags['addr:housenumber'],
    tags['addr:street'],
    tags['addr:suburb'],
    tags['addr:city'],
    tags['addr:postcode'],
  ].filter(Boolean);
  const fullAddress = addressParts.join(', ');
  const shortAddress = [tags['addr:street'], tags['addr:city']].filter(Boolean).join(', ') || tags['addr:city'] || '';

  // Amenities
  const amenities = extractAmenities(tags);

  // Reviews
  const reviews = generateReviews(name, category, ratingValue, h);

  // Description
  const description = tags.description || tags['description:en'] || null;

  return {
    id: `osm-${el.type}-${el.id}`,
    placeId: `osm-${el.type}-${el.id}`,
    osmType: el.type,
    osmId: el.id,
    name,
    type: typeLabel,
    category,
    // Distance
    distance: distanceStr,
    distanceMeters: dist,
    distanceKm,
    distanceLabel: dist < 1000 ? `${Math.round(dist)} meters` : `${distanceKm} km`,
    // Rating
    rating,
    ratingValue,
    userRatingsTotal,
    reviewsCount: userRatingsTotal,
    reviews,
    // Status
    status: openNow === true ? 'Open' : openNow === false ? 'Closed' : 'Open',
    isOpen: openNow !== false,
    openingHours,
    openingHoursRaw,
    // Pricing
    price: pricing.symbol,
    priceLabel: pricing.label,
    priceRange: pricing.range,
    priceRangeFor2: pricing.rangeFor2,
    priceAvg: pricing.avg,
    priceCurrency: 'INR',
    priceLevel: pricing.symbol.length,
    // Media
    image,
    gallery,
    // Location + contact
    location: { lat, lng },
    address: fullAddress || shortAddress || 'Address not available',
    shortAddress,
    phone: tags.phone || tags['contact:phone'] || null,
    phoneIntl: tags.phone || tags['contact:phone'] || null,
    website: tags.website || tags['contact:website'] || null,
    mapsUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
    // Info
    cuisines,
    cuisineLabel: cuisines.length ? cuisines.map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(', ') : null,
    description,
    amenities,
    types: [tags.amenity, ...cuisines].filter(Boolean),
    tags: Object.keys(tags),
  };
}

// ══════════════════════════════════════════════════════════════════════
//  GET /api/places/nearby
// ══════════════════════════════════════════════════════════════════════
exports.nearby = async (req, res) => {
  try {
    const { lat, lng, radius = 3000, type, search } = req.query;
    if (!lat || !lng) return res.status(400).json({ success: false, message: 'lat & lng required' });

    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);
    const r = Math.min(parseInt(radius) || 3000, 15000);

    const wantedTypes = type
      ? String(type).split(',').map(s => s.trim()).filter(Boolean)
      : ['bar', 'restaurant', 'cafe'];

    const amenityList = [];
    if (wantedTypes.includes('bar')) amenityList.push('bar', 'pub', 'biergarten', 'nightclub');
    if (wantedTypes.includes('restaurant')) amenityList.push('restaurant', 'fast_food', 'food_court');
    if (wantedTypes.includes('cafe')) amenityList.push('cafe', 'coffee_shop', 'ice_cream');
    const amenityFilter = amenityList.join('|');

    // Overpass query — up to 150 results, includes nodes + ways
    const query = `
      [out:json][timeout:25];
      (
        node["amenity"~"^(${amenityFilter})$"]["name"](around:${r},${userLat},${userLng});
        way["amenity"~"^(${amenityFilter})$"]["name"](around:${r},${userLat},${userLng});
      );
      out center tags 150;
    `;

    const data = await queryOverpass(query);
    const elements = data.elements || [];

    // Normalize + de-dupe
    const map = new Map();
    for (const el of elements) {
      const place = normalizeOsm(el, userLat, userLng);
      if (!place) continue;
      const key = `${place.name.toLowerCase()}-${Math.round(place.location.lat * 1000)}-${Math.round(place.location.lng * 1000)}`;
      if (!map.has(key) || (map.get(key).distanceMeters > place.distanceMeters)) {
        map.set(key, place);
      }
    }

    let places = Array.from(map.values());

    // Optional server-side search
    if (search) {
      const q = String(search).toLowerCase().trim();
      places = places.filter(p =>
        (p.name || '').toLowerCase().includes(q)
        || (p.type || '').toLowerCase().includes(q)
        || (p.address || '').toLowerCase().includes(q)
        || (p.cuisines || []).some(c => c.toLowerCase().includes(q))
      );
    }

    // Sort by distance
    places.sort((a, b) => a.distanceMeters - b.distanceMeters);

    // Summary counts for UI
    const summary = {
      total: places.length,
      bars: places.filter(p => p.category === 'bar').length,
      restaurants: places.filter(p => p.category === 'restaurant').length,
      cafes: places.filter(p => p.category === 'cafe').length,
      open: places.filter(p => p.isOpen).length,
    };

    res.json({
      success: true,
      data: { places, count: places.length, summary, source: 'openstreetmap' },
    });
  } catch (err) {
    console.error('Places nearby error:', err?.message);
    res.status(500).json({ success: false, message: err?.message || 'Failed to fetch places' });
  }
};

// ══════════════════════════════════════════════════════════════════════
//  GET /api/places/details/:placeId
// ══════════════════════════════════════════════════════════════════════
exports.details = async (req, res) => {
  try {
    const { placeId } = req.params;
    if (!placeId?.startsWith('osm-')) {
      return res.status(404).json({ success: false, message: 'Unknown place ID format' });
    }

    const parts = placeId.split('-');
    const osmType = parts[1];
    const osmId = parts[2];
    if (!osmType || !osmId) return res.status(400).json({ success: false, message: 'Bad placeId' });

    const query = `[out:json][timeout:15]; ${osmType}(${osmId}); out body tags;`;
    const data = await queryOverpass(query);
    const el = data.elements?.[0];
    if (!el) return res.status(404).json({ success: false, message: 'Place not found' });

    const lat = el.lat ?? el.center?.lat ?? 0;
    const lng = el.lon ?? el.center?.lon ?? 0;
    const place = normalizeOsm(el, lat, lng);
    if (!place) return res.status(404).json({ success: false, message: 'Place has no valid data' });

    res.json({ success: true, data: place });
  } catch (err) {
    console.error('Places details error:', err?.message);
    res.status(500).json({ success: false, message: err?.message || 'Failed to fetch details' });
  }
};

// ══════════════════════════════════════════════════════════════════════
//  GET /api/places/photo — backward compat
// ══════════════════════════════════════════════════════════════════════
exports.photo = async (req, res) => {
  const { ref } = req.query;
  if (!ref) return res.status(400).send('');
  if (/^https?:\/\//.test(ref)) return res.redirect(ref);
  return res.status(404).send('');
};
