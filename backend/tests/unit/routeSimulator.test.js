const { pointAtDistance, totalLengthKm, createSimulator } = require('../../src/utils/routeSimulator');

describe('routeSimulator', () => {
  const poly = [
    [0, 0],
    [0, 1], // ~111km east
    [0, 2], // ~222km east total
  ];

  test('totalLengthKm sums segments', () => {
    const len = totalLengthKm(poly);
    expect(len).toBeGreaterThan(220);
    expect(len).toBeLessThan(224);
  });

  test('pointAtDistance at 0 is start', () => {
    const p = pointAtDistance(poly, 0);
    expect(p.lat).toBeCloseTo(0);
    expect(p.lng).toBeCloseTo(0);
  });

  test('pointAtDistance interpolates on first segment', () => {
    const len = totalLengthKm(poly);
    const p = pointAtDistance(poly, len / 4);
    expect(p.lat).toBeCloseTo(0);
    expect(p.lng).toBeGreaterThan(0);
    expect(p.lng).toBeLessThan(1);
  });

  test('pointAtDistance loops when exceeding total', () => {
    const len = totalLengthKm(poly);
    const p1 = pointAtDistance(poly, len / 2);
    const p2 = pointAtDistance(poly, len + len / 2);
    expect(p1.lat).toBeCloseTo(p2.lat, 3);
    expect(p1.lng).toBeCloseTo(p2.lng, 3);
  });

  test('createSimulator advances deterministically', () => {
    const sim = createSimulator(poly, 111); // 111 km/h
    const p0 = sim.tick(0);
    const p1 = sim.tick(60); // 60s = 1 min = ~1.85 km
    expect(p1.lng).toBeGreaterThan(p0.lng);
  });

  test('throws on invalid polyline', () => {
    expect(() => pointAtDistance([[0, 0]], 1)).toThrow();
  });
});
