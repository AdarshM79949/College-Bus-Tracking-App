const { connect, disconnect, clearDB } = require('../setup');
const User = require('../../src/models/User');
const Route = require('../../src/models/Route');
const Bus = require('../../src/models/Bus');

beforeAll(connect);
afterAll(disconnect);
afterEach(clearDB);

describe('User model', () => {
  test('hashes password via setPassword and verifies', async () => {
    const u = new User({ name: 'A', email: 'a@x.com', role: 'student' });
    await u.setPassword('secret123');
    expect(u.passwordHash).toBeTruthy();
    expect(u.passwordHash).not.toBe('secret123');
    expect(await u.verifyPassword('secret123')).toBe(true);
    expect(await u.verifyPassword('wrong')).toBe(false);
  });

  test('rejects short passwords', async () => {
    const u = new User({ name: 'A', email: 'a@x.com' });
    await expect(u.setPassword('abc')).rejects.toThrow();
  });

  test('rejects invalid email', async () => {
    const u = new User({ name: 'A', email: 'not-an-email', passwordHash: 'x' });
    await expect(u.validate()).rejects.toThrow();
  });

  test('toJSON strips passwordHash', async () => {
    const u = new User({ name: 'A', email: 'a@x.com' });
    await u.setPassword('secret123');
    const json = u.toJSON();
    expect(json.passwordHash).toBeUndefined();
  });
});

describe('Route model', () => {
  test('requires at least 2 stops', async () => {
    const r = new Route({ name: 'R1', stops: [{ name: 'A', lat: 0, lng: 0, order: 1 }] });
    await expect(r.validate()).rejects.toThrow();
  });

  test('rejects out-of-range lat/lng', async () => {
    const r = new Route({
      name: 'R1',
      stops: [
        { name: 'A', lat: 200, lng: 0, order: 1 },
        { name: 'B', lat: 0, lng: 0, order: 2 },
      ],
    });
    await expect(r.validate()).rejects.toThrow();
  });

  test('saves a valid route', async () => {
    const r = await Route.create({
      name: 'R1',
      stops: [
        { name: 'A', lat: 0, lng: 0, order: 1 },
        { name: 'B', lat: 1, lng: 1, order: 2 },
      ],
    });
    expect(r._id).toBeDefined();
  });
});

describe('Bus model', () => {
  test('requires busNumber and routeId', async () => {
    const b = new Bus({});
    await expect(b.validate()).rejects.toThrow();
  });

  test('defaults status to idle', async () => {
    const route = await Route.create({
      name: 'R',
      stops: [
        { name: 'A', lat: 0, lng: 0, order: 1 },
        { name: 'B', lat: 1, lng: 1, order: 2 },
      ],
    });
    const b = await Bus.create({ busNumber: 'B1', routeId: route._id });
    expect(b.status).toBe('idle');
  });
});
