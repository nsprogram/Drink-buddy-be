/**
 * Google Places API proxy
 * ─────────────────────────
 * Keeps GOOGLE_PLACES_API_KEY server-side only.
 * Mobile app calls these endpoints; we forward to Google.
 *
 * Endpoints:
 *   GET /api/places/nearby?lat=&lng=&radius=&type=  (protected)
 *   GET /api/places/details/:placeId               (protected)
 *   GET /api/places/photo?ref=&w=                  (public — stream image)
 */

const KEY = process.env.GOOGLE_PLACES_API_KEY;
const BASE = 'https://maps.googleapis.com/maps/api/place';

// Small helper — safe JSON fetch with timeout
async function gfetch(url, timeoutMs = 10000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) throw new Error(`Google Places HTTP ${r.status}`);
    return await r.json();
  } finally { clearTimeout(t); }
}

// ── Distance in meters between two lat/lng (Haversine) ──
function distanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const toRad = (v) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Build proxied photo URLs so the frontend never sees our API key
function buildPhotoUrl(req, photo_reference, w = 800) {
  if (!photo_reference) return null;
  const host = `${req.protocol}://${req.get('host')}`;
  return `${host}/api/places/photo?ref=${encodeURIComponent(photo_reference)}&w=${w}`;
}

// ── GET /api/places/nearby ──
exports.nearby = async (req, res) => {
  try {
    if (!KEY) return res.status(503).json({ success: false, message: 'Places API key not configured on server' });

    const { lat, lng, radius = 2500, type } = req.query;
    if (!lat || !lng) return res.status(400).json({ success: false, message: 'lat & lng required' });

    // Types to fetch (comma-separated or single)
    const types = type
      ? String(type).split(',').map(s => s.trim()).filter(Boolean)
      : ['bar', 'restaurant', 'cafe'];

    const userLat = parseFloat(lat), userLng = parseFloat(lng);

    const allResults = [];
    await Promise.all(types.map(async (t) => {
      const url = `${BASE}/nearbysearch/json?location=${userLat},${userLng}&radius=${radius}&type=${t}&key=${KEY}`;
      try {
        const data = await gfetch(url);
        if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
          console.warn(`[Places] ${t}: ${data.status}`, data.error_message);
        }
        (data.results || []).forEach(r => allResults.push({ ...r, __type: t }));
      } catch (e) {
        console.warn(`[Places] ${t} fetch failed:`, e.message);
      }
    }));

    // De-duplicate by place_id, prefer more specific type (bar > restaurant > cafe)
    const typeRank = { bar: 3, restaurant: 2, cafe: 1 };
    const map = new Map();
    for (const r of allResults) {
      const existing = map.get(r.place_id);
      if (!existing || (typeRank[r.__type] || 0) > (typeRank[existing.__type] || 0)) {
        map.set(r.place_id, r);
      }
    }

    // Normalize into Bar shape
    const places = Array.from(map.values()).map(r => {
      const loc = r.geometry?.location;
      const dist = loc ? Math.round(distanceMeters(userLat, userLng, loc.lat, loc.lng)) : null;
      const distanceStr = dist == null ? '—' : dist < 1000 ? `${dist} m` : `${(dist / 1000).toFixed(1)} km`;
      const priceMap = ['Free', '$', '$$', '$$$', '$$$$'];
      const openNow = r.opening_hours?.open_now;
      const photo = r.photos?.[0]?.photo_reference;
      const gallery = (r.photos || []).slice(0, 6).map(p => buildPhotoUrl(req, p.photo_reference, 1200)).filter(Boolean);

      return {
        id: r.place_id,
        placeId: r.place_id,
        name: r.name,
        type: r.__type === 'bar' ? 'Bar' : r.__type === 'restaurant' ? 'Restaurant' : 'Cafe',
        category: r.__type,
        distance: distanceStr,
        distanceMeters: dist,
        rating: r.rating ? r.rating.toFixed(1) : null,
        ratingValue: r.rating || 0,
        userRatingsTotal: r.user_ratings_total || 0,
        status: openNow === true ? 'Open' : openNow === false ? 'Closed' : 'Unknown',
        isOpen: openNow === true,
        price: r.price_level != null ? priceMap[r.price_level] : '$$',
        priceLevel: r.price_level ?? null,
        image: buildPhotoUrl(req, photo, 800),
        gallery: gallery.length ? gallery : (buildPhotoUrl(req, photo, 1200) ? [buildPhotoUrl(req, photo, 1200)] : []),
        location: loc ? { lat: loc.lat, lng: loc.lng } : null,
        address: r.vicinity || '',
        types: r.types || [],
      };
    });

    // Sort by distance by default
    places.sort((a, b) => (a.distanceMeters || 99999) - (b.distanceMeters || 99999));

    res.json({ success: true, data: { places, count: places.length } });
  } catch (err) {
    console.error('Places nearby error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET /api/places/details/:placeId ──
exports.details = async (req, res) => {
  try {
    if (!KEY) return res.status(503).json({ success: false, message: 'Places API key not configured' });
    const { placeId } = req.params;
    const fields = 'name,rating,user_ratings_total,formatted_address,formatted_phone_number,international_phone_number,website,opening_hours,price_level,photos,geometry,types,url,reviews';
    const url = `${BASE}/details/json?place_id=${placeId}&fields=${encodeURIComponent(fields)}&key=${KEY}`;
    const data = await gfetch(url, 15000);

    if (data.status !== 'OK') return res.status(404).json({ success: false, message: data.status });

    const r = data.result || {};
    const photo = r.photos?.[0]?.photo_reference;
    const gallery = (r.photos || []).slice(0, 8).map(p => buildPhotoUrl(req, p.photo_reference, 1200)).filter(Boolean);
    const priceMap = ['Free', '$', '$$', '$$$', '$$$$'];

    res.json({
      success: true,
      data: {
        id: placeId,
        placeId,
        name: r.name,
        rating: r.rating ? r.rating.toFixed(1) : null,
        ratingValue: r.rating || 0,
        userRatingsTotal: r.user_ratings_total || 0,
        address: r.formatted_address || '',
        phone: r.formatted_phone_number || null,
        phoneIntl: r.international_phone_number || null,
        website: r.website || null,
        mapsUrl: r.url || null,
        openingHours: r.opening_hours?.weekday_text || [],
        status: r.opening_hours?.open_now === true ? 'Open' : r.opening_hours?.open_now === false ? 'Closed' : 'Unknown',
        isOpen: r.opening_hours?.open_now === true,
        price: r.price_level != null ? priceMap[r.price_level] : '$$',
        priceLevel: r.price_level ?? null,
        image: buildPhotoUrl(req, photo, 1200),
        gallery,
        location: r.geometry?.location || null,
        types: r.types || [],
        reviews: (r.reviews || []).slice(0, 5).map(rv => ({
          author: rv.author_name,
          rating: rv.rating,
          text: rv.text,
          time: rv.relative_time_description,
        })),
      },
    });
  } catch (err) {
    console.error('Places details error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET /api/places/photo?ref=&w= ──
// Streams the Google photo so the frontend never learns the API key.
exports.photo = async (req, res) => {
  try {
    if (!KEY) return res.status(503).send('');
    const { ref, w = 800 } = req.query;
    if (!ref) return res.status(400).send('');
    const url = `${BASE}/photo?maxwidth=${w}&photo_reference=${encodeURIComponent(ref)}&key=${KEY}`;

    // Follow redirect but do not expose the redirected URL (which contains the key)
    const r = await fetch(url, { redirect: 'follow' });
    if (!r.ok) return res.status(502).send('');
    res.setHeader('Content-Type', r.headers.get('content-type') || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=604800');
    // Node 18+ supports r.body as stream
    const buf = Buffer.from(await r.arrayBuffer());
    res.end(buf);
  } catch (err) {
    console.error('Places photo error:', err);
    res.status(500).send('');
  }
};
