/**
 * Great-circle distance between two coords in kilometers (haversine).
 */
function haversineKm(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371; // km
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * ETA in seconds given distance (km) and speed (km/h).
 */
function etaSeconds(distanceKm, speedKmh) {
  if (speedKmh <= 0) return Infinity;
  return (distanceKm / speedKmh) * 3600;
}

/**
 * Compute ETAs from current location to each remaining stop on a route.
 * Determines remaining stops by finding the next unvisited stop (closest
 * ahead in the stop order). For simplicity we assume sequential progression.
 *
 * @param {{lat:number,lng:number}} current
 * @param {Array<{_id?:any,name:string,lat:number,lng:number,order:number}>} stops
 * @param {number} speedKmh
 * @returns {Array<{stopId?:any,stopName:string,distanceKm:number,etaSeconds:number}>}
 */
function computeEtas(current, stops, speedKmh) {
  if (!current || !Array.isArray(stops) || stops.length === 0) return [];
  const sorted = [...stops].sort((a, b) => a.order - b.order);

  // Find the nearest stop; assume stops after it are "remaining".
  let nearestIdx = 0;
  let nearestDist = Infinity;
  sorted.forEach((s, i) => {
    const d = haversineKm(current, s);
    if (d < nearestDist) {
      nearestDist = d;
      nearestIdx = i;
    }
  });

  const remaining = sorted.slice(nearestIdx);
  const result = [];
  let prev = current;
  let cumulativeKm = 0;
  for (const stop of remaining) {
    cumulativeKm += haversineKm(prev, stop);
    result.push({
      stopId: stop._id,
      stopName: stop.name,
      distanceKm: Number(cumulativeKm.toFixed(3)),
      etaSeconds: Math.round(etaSeconds(cumulativeKm, speedKmh)),
    });
    prev = stop;
  }
  return result;
}

module.exports = { haversineKm, etaSeconds, computeEtas };
