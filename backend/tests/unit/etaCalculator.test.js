const { haversineKm, etaSeconds, computeEtas } = require('../../src/utils/etaCalculator');

describe('etaCalculator', () => {
  describe('haversineKm', () => {
    test('zero distance for identical points', () => {
      expect(haversineKm({ lat: 28.5, lng: 77.1 }, { lat: 28.5, lng: 77.1 })).toBe(0);
    });

    test('approx 111km per degree latitude', () => {
      const d = haversineKm({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
      expect(d).toBeGreaterThan(110);
      expect(d).toBeLessThan(112);
    });

    test('symmetric', () => {
      const a = { lat: 28.5, lng: 77.1 };
      const b = { lat: 28.6, lng: 77.2 };
      expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a), 6);
    });
  });

  describe('etaSeconds', () => {
    test('10km at 60km/h = 600s', () => {
      expect(etaSeconds(10, 60)).toBeCloseTo(600);
    });
    test('returns Infinity when speed is 0', () => {
      expect(etaSeconds(5, 0)).toBe(Infinity);
    });
  });

  describe('computeEtas', () => {
    const stops = [
      { _id: 'a', name: 'A', lat: 0, lng: 0, order: 1 },
      { _id: 'b', name: 'B', lat: 0, lng: 1, order: 2 }, // ~111km east
      { _id: 'c', name: 'C', lat: 0, lng: 2, order: 3 },
    ];

    test('returns ETAs for remaining stops from current location', () => {
      const result = computeEtas({ lat: 0, lng: 0 }, stops, 111);
      expect(result).toHaveLength(3);
      expect(result[0].stopName).toBe('A');
      expect(result[1].etaSeconds).toBeGreaterThan(result[0].etaSeconds);
    });

    test('skips already-passed stops', () => {
      // current location very close to B, so nearest is B; result = [B, C]
      const result = computeEtas({ lat: 0, lng: 1 }, stops, 111);
      expect(result).toHaveLength(2);
      expect(result[0].stopName).toBe('B');
      expect(result[1].stopName).toBe('C');
    });

    test('handles empty stops', () => {
      expect(computeEtas({ lat: 0, lng: 0 }, [], 30)).toEqual([]);
    });
  });
});
