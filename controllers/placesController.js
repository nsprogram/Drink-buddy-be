/**
 * Places API — powered by OpenStreetMap Overpass (FREE, no API key).
 * Returns ONLY REAL data from OpenStreetMap:
 *   - Real name, address, location
 *   - Real phone, website (when tagged)
 *   - Real opening hours (when tagged)
 *   - Real cuisine info (when tagged)
 *   - Real amenities (wifi, outdoor seating, takeaway, delivery, etc.)
 *   - Exact distance from user (Haversine)
 *
 * NO synthetic ratings, reviews, or pricing — we only return what OSM knows.
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

// Stock images — rotated deterministically by name hash so each place
// always gets the same picture. OSM doesn't store photos; these are
// category-appropriate illustrations until a real photo source is added.
const STOCK = {
  bar: [
    'https://images.unsplash.com/photo-1572116469696-31de0f17cc34?w=800&q=80',
    'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800&q=80',
    'https://images.unsplash.com/photo-1543007630-9710e4a00a20?w=800&q=80',
    'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=800&q=80',
    'https://images.unsplash.com/photo-1525268323446-0505b6fe7778?w=800&q=80',
    'https://images.unsplash.com/photo-1566417713940-fe7c737a9ef2?w=800&q=80',
  ],
  restaurant: [
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80',
    'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80',
    'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80',
    'https://images.unsplash.com/photo-1552566626-52f8b828add9?w=800&q=80',
    'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80',
    'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&q=80',
  ],
  cafe: [
    'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800&q=80',
    'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=800&q=80',
    'https://images.unsplash.com/photo-1445116572660-236099ec97a0?w=800&q=80',
    'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80',
    'https://images.unsplash.com/photo-1453614512568-c4024d13c247?w=800&q=80',
    'https://images.unsplash.com/photo-1521017432531-fbd92d768814?w=800&q=80',
  ],
  liquor: [
    'https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=800&q=80',
    'https://images.unsplash.com/photo-1568213816046-0ee1c42bd559?w=800&q=80',
    'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=800&q=80',
    'https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=800&q=80',
    'https://images.unsplash.com/photo-1555696958-c5049b866f6d?w=800&q=80',
    'https://images.unsplash.com/photo-1542990253-a781e04c0082?w=800&q=80',
  ],
  club: [
    'https://images.unsplash.com/photo-1566737236500-c8ac43014a67?w=800&q=80',
    'https://images.unsplash.com/photo-1571266028243-d220c6b4d33d?w=800&q=80',
    'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800&q=80',
    'https://images.unsplash.com/photo-1545128485-c400e7702796?w=800&q=80',
    'https://images.unsplash.com/photo-1598518619773-2ee1e30c05cb?w=800&q=80',
    'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800&q=80',
  ],
};

// ═══════════════════════════════════════════════════════════════
//  UTILITIES
// ═══════════════════════════════════════════════════════════════
function hashStr(str) {
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
  if (m == null) return null;
  if (m < 100) return `${Math.round(m)} m`;
  if (m < 1000) return `${Math.round(m / 10) * 10} m`;
  return `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`;
}

// ── Parse OSM opening_hours string → open now? ──
function parseOpenNow(opHours) {
  if (!opHours || typeof opHours !== 'string') return null;
  const lower = opHours.toLowerCase();
  if (lower.includes('24/7')) return true;
  if (lower === 'off' || lower.includes('closed')) return false;

  const now = new Date();
  const dayNames = ['su', 'mo', 'tu', 'we', 'th', 'fr', 'sa'];
  const todayDay = dayNames[now.getDay()];
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const rules = opHours.split(';').map(s => s.trim());
  for (const rule of rules) {
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
  return rules.some(r => /(mo|tu|we|th|fr|sa|su)/i.test(r)) ? false : null;
}

function formatOpeningHours(opHours) {
  if (!opHours) return [];
  if (opHours.includes('24/7')) return ['Open 24 hours'];
  return opHours.split(';').map(s => s.trim()).filter(Boolean).map(s =>
    s.replace(/mo/gi, 'Mon').replace(/tu/gi, 'Tue').replace(/we/gi, 'Wed')
     .replace(/th/gi, 'Thu').replace(/fr/gi, 'Fri').replace(/sa/gi, 'Sat').replace(/su/gi, 'Sun')
  );
}

// ── Amenities extracted from OSM tags (all real, all tag-based) ──
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
    parking: tags['parking'] != null && tags['parking'] !== 'no',
    acceptsCards: yes(tags['payment:credit_cards']) || yes(tags['payment:cards']) || yes(tags['payment:visa']),
  };
}

// ── Overpass fetch with multi-server fallback ──
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
          'User-Agent': 'DrinkBuddy/1.0',
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

function categoryForElement(tags) {
  const a = tags.amenity;
  const s = tags.shop;
  const c = tags.craft;
  // Alcohol / liquor shops
  if (s === 'alcohol' || s === 'wine' || s === 'beverages') return 'liquor';
  if (c === 'brewery' || c === 'winery' || c === 'distillery') return 'liquor';
  // Nightclubs
  if (a === 'nightclub') return 'club';
  // Bars & pubs
  if (['bar', 'pub', 'biergarten'].includes(a)) return 'bar';
  // Cafes
  if (['cafe', 'coffee_shop'].includes(a)) return 'cafe';
  // Fallback
  return 'restaurant';
}

function typeLabelForCategory(cat) {
  if (cat === 'bar') return 'Bar';
  if (cat === 'cafe') return 'Cafe';
  if (cat === 'liquor') return 'Liquor Store';
  if (cat === 'club') return 'Nightclub';
  return 'Restaurant';
}

// ── Normalize OSM element → place object (REAL DATA ONLY) ──
function normalizeOsm(el, userLat, userLng) {
  const tags = el.tags || {};
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (lat == null || lng == null) return null;

  const name = tags.name || tags['name:en'] || tags['brand'];
  if (!name) return null;

  const category = categoryForElement(tags);
  const typeLabel = typeLabelForCategory(category);

  const dist = userLat != null && userLng != null
    ? Math.round(distanceMeters(userLat, userLng, lat, lng))
    : null;

  // Deterministic image pick (stock illustrations — OSM has no photos)
  const h = hashStr(name + Math.round(lat * 10000) + Math.round(lng * 10000));
  const pool = STOCK[category] || STOCK.restaurant;
  const image = pool[h % pool.length];

  // Opening info (real, parsed from tags)
  const openingHoursRaw = tags.opening_hours || null;
  const openNow = parseOpenNow(openingHoursRaw);
  const openingHours = formatOpeningHours(openingHoursRaw);

  // Cuisine
  const cuisines = (tags.cuisine || '').split(';').map(s => s.trim()).filter(Boolean);
  const cuisineLabel = cuisines.length
    ? cuisines.map(c => c.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')).join(', ')
    : null;

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

  const amenities = extractAmenities(tags);

  return {
    id: `osm-${el.type}-${el.id}`,
    placeId: `osm-${el.type}-${el.id}`,
    osmType: el.type,
    osmId: el.id,
    name,
    type: typeLabel,
    category,
    // Distance — REAL (calculated from user's location)
    distance: formatDistance(dist),
    distanceMeters: dist,
    distanceKm: dist != null ? (dist / 1000).toFixed(dist < 10000 ? 2 : 1) : null,
    distanceLabel: dist != null ? (dist < 1000 ? `${Math.round(dist)} meters` : `${(dist / 1000).toFixed(1)} km`) : null,
    // Status — parsed from real OSM opening_hours tag
    status: openNow === true ? 'Open' : openNow === false ? 'Closed' : 'Unknown',
    isOpen: openNow === true,
    hasStatusInfo: openingHoursRaw != null,
    openingHours,
    openingHoursRaw,
    // Media — stock illustration (single image, no fake gallery)
    image,
    // Location + contact — REAL OSM tags
    location: { lat, lng },
    address: fullAddress || shortAddress || null,
    shortAddress: shortAddress || null,
    phone: tags.phone || tags['contact:phone'] || null,
    website: tags.website || tags['contact:website'] || null,
    mapsUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
    // Descriptive info
    cuisines,
    cuisineLabel,
    description: tags.description || tags['description:en'] || null,
    amenities,
    hasAmenities: Object.values(amenities).some(Boolean),
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
      : ['bar', 'restaurant', 'cafe', 'liquor', 'club'];

    // Amenity-based POIs (bars, restaurants, cafes, clubs)
    const amenityList = [];
    if (wantedTypes.includes('bar')) amenityList.push('bar', 'pub', 'biergarten');
    if (wantedTypes.includes('club') || wantedTypes.includes('nightclub')) amenityList.push('nightclub');
    if (wantedTypes.includes('restaurant')) amenityList.push('restaurant', 'fast_food', 'food_court');
    if (wantedTypes.includes('cafe')) amenityList.push('cafe', 'coffee_shop', 'ice_cream');

    // Shop-based POIs (alcohol/liquor stores, wine shops, craft breweries)
    const shopList = [];
    const craftList = [];
    if (wantedTypes.includes('liquor') || wantedTypes.includes('shop') || wantedTypes.includes('alcohol')) {
      shopList.push('alcohol', 'wine', 'beverages');
      craftList.push('brewery', 'winery', 'distillery');
    }

    // Build the query with OR between amenity + shop + craft
    const queryParts = [];
    if (amenityList.length) {
      const f = amenityList.join('|');
      queryParts.push(`node["amenity"~"^(${f})$"]["name"](around:${r},${userLat},${userLng});`);
      queryParts.push(`way["amenity"~"^(${f})$"]["name"](around:${r},${userLat},${userLng});`);
    }
    if (shopList.length) {
      const f = shopList.join('|');
      queryParts.push(`node["shop"~"^(${f})$"]["name"](around:${r},${userLat},${userLng});`);
      queryParts.push(`way["shop"~"^(${f})$"]["name"](around:${r},${userLat},${userLng});`);
    }
    if (craftList.length) {
      const f = craftList.join('|');
      queryParts.push(`node["craft"~"^(${f})$"]["name"](around:${r},${userLat},${userLng});`);
      queryParts.push(`way["craft"~"^(${f})$"]["name"](around:${r},${userLat},${userLng});`);
    }

    if (!queryParts.length) {
      return res.json({ success: true, data: { places: [], count: 0, summary: { total: 0, bars: 0, restaurants: 0, cafes: 0, liquor: 0, clubs: 0, open: 0 }, source: 'openstreetmap' } });
    }

    const query = `
      [out:json][timeout:25];
      (
        ${queryParts.join('\n        ')}
      );
      out center tags 200;
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

    // Server-side search
    if (search) {
      const q = String(search).toLowerCase().trim();
      places = places.filter(p =>
        (p.name || '').toLowerCase().includes(q)
        || (p.type || '').toLowerCase().includes(q)
        || (p.address || '').toLowerCase().includes(q)
        || (p.cuisines || []).some(c => c.toLowerCase().includes(q))
      );
    }

    // Sort by distance (closest first)
    places.sort((a, b) => (a.distanceMeters ?? 99999) - (b.distanceMeters ?? 99999));

    const summary = {
      total: places.length,
      bars: places.filter(p => p.category === 'bar').length,
      restaurants: places.filter(p => p.category === 'restaurant').length,
      cafes: places.filter(p => p.category === 'cafe').length,
      liquor: places.filter(p => p.category === 'liquor').length,
      clubs: places.filter(p => p.category === 'club').length,
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
