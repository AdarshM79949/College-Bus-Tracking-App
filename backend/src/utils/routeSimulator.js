const { haversineKm } = require('./etaCalculator');

/**
 * Walk along a polyline at a given speed. Returns the point at `distanceKm`
 * traveled from the start, interpolating between vertices. Wraps to the start
 * when the end is reached (looping bus route).
 *
 * @param {Array<[number,number]>} polyline [[lat,lng], ...]
 * @param {number} distanceKm
 */
function pointAtDistance(polyline, distanceKm) {
  if (!Array.isArray(polyline) || polyline.length < 2) {
    throw new Error('polyline must have at least 2 points');
  }
  const totalKm = totalLengthKm(polyline);
  if (totalKm === 0) return { lat: polyline[0][0], lng: polyline[0][1] };

  // loop
  let remaining = ((distanceKm % totalKm) + totalKm) % totalKm;

  for (let i = 0; i < polyline.length - 1; i++) {
    const a = { lat: polyline[i][0], lng: polyline[i][1] };
    const b = { lat: polyline[i + 1][0], lng: polyline[i + 1][1] };
    const seg = haversineKm(a, b);
    if (remaining <= seg || i === polyline.length - 2) {
      const t = seg === 0 ? 0 : Math.min(1, remaining / seg);
      return {
        lat: a.lat + (b.lat - a.lat) * t,
        lng: a.lng + (b.lng - a.lng) * t,
      };
    }
    remaining -= seg;
  }
  const last = polyline[polyline.length - 1];
  return { lat: last[0], lng: last[1] };
}

function totalLengthKm(polyline) {
  let total = 0;
  for (let i = 0; i < polyline.length - 1; i++) {
    total += haversineKm(
      { lat: polyline[i][0], lng: polyline[i][1] },
      { lat: polyline[i + 1][0], lng: polyline[i + 1][1] }
    );
  }
  return total;
}

/**
 * Stateful simulator. Call .tick(dtSeconds) to advance and get the next point.
 */
function createSimulator(polyline, speedKmh = 25) {
  let distanceKm = 0;
  return {
    tick(dtSeconds) {
      distanceKm += (speedKmh * dtSeconds) / 3600;
      return pointAtDistance(polyline, distanceKm);
    },
    reset() {
      distanceKm = 0;
    },
    get distanceKm() {
      return distanceKm;
    },
  };
}

module.exports = { pointAtDistance, totalLengthKm, createSimulator };
