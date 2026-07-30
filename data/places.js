// Real nearby places, fetched live from OpenStreetMap.
//
// Overpass and Nominatim are both free and need no API key. Two things to know
// about them: they are rate-limited and sometimes slow, and they are
// third-party requests. Only a place name or coarse coordinates are ever sent —
// never any health data.
const OVERPASS = "https://overpass-api.de/api/interpreter";
const NOMINATIM = "https://nominatim.openstreetmap.org/search";

// Overpass can hang for a long time. Give up rather than leave the tab
// spinning, and let the caller fall back to what it already has.
const TIMEOUT_MS = 12000;

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Turns typed text like "Ithaca NY" into coordinates.
export async function geocode(query) {
  const url = `${NOMINATIM}?q=${encodeURIComponent(query)}&format=json&limit=1`;
  try {
    const response = await fetchWithTimeout(url, {
      headers: { Accept: "application/json" },
    });
    const results = await response.json();
    if (!results.length) return null;
    return {
      lat: Number(results[0].lat),
      lon: Number(results[0].lon),
      label: results[0].display_name.split(",").slice(0, 2).join(", "),
    };
  } catch {
    return null;
  }
}

// Care homes, community centres and sports centres within `radius` metres.
// `nwr` covers nodes, ways and relations, since a care home may be mapped as
// any of the three.
function buildQuery(lat, lon, radius) {
  const filters = [
    'nwr["social_facility"="assisted_living"]',
    'nwr["social_facility"="nursing_home"]',
    'nwr["amenity"="social_facility"]',
    'nwr["amenity"="community_centre"]',
    'nwr["leisure"="sports_centre"]',
  ]
    .map((f) => `${f}(around:${radius},${lat},${lon});`)
    .join("");

  // `out center` gives one coordinate per result even for ways and relations,
  // which is all a map marker needs.
  return `[out:json][timeout:20];(${filters});out center 40;`;
}

export async function fetchNearbyPlaces(lat, lon, radius = 8000) {
  try {
    const response = await fetchWithTimeout(OVERPASS, {
      method: "POST",
      body: `data=${encodeURIComponent(buildQuery(lat, lon, radius))}`,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    if (!response.ok) return [];
    const data = await response.json();
    return (data.elements || []).map(normalize).filter((p) => p.name && p.lat);
  } catch {
    return []; // caller keeps showing the curated events
  }
}

function normalize(element) {
  const tags = element.tags || {};
  // Nodes carry lat/lon directly; ways and relations carry a `center`.
  const point = element.center || element;
  return {
    id: `osm-${element.type}-${element.id}`,
    name: tags.name || "",
    kind: "facility",
    venue: describe(tags),
    lat: point.lat,
    lon: point.lon,
    // OSM records step-free access inconsistently, so treat only an explicit
    // "yes" as accessible rather than assuming.
    stepFree: tags.wheelchair === "yes",
    address: [tags["addr:housenumber"], tags["addr:street"]]
      .filter(Boolean)
      .join(" "),
    live: true, // marks this as fetched, not seeded
  };
}

function describe(tags) {
  if (tags.social_facility === "nursing_home") return "Nursing home";
  if (tags.social_facility === "assisted_living") return "Assisted living";
  if (tags.amenity === "social_facility") return "Care facility";
  if (tags.amenity === "community_centre") return "Community centre";
  if (tags.leisure === "sports_centre") return "Sports centre";
  return "Nearby place";
}

// Straight-line distance in miles. Good enough for "how far is this",
// and it needs no routing service.
export function milesBetween(a, b) {
  const R = 3958.8;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}
