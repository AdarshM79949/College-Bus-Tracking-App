const request = require('supertest');
const { connect, disconnect, clearDB } = require('../setup');
const { createApp } = require('../../src/app');
const User = require('../../src/models/User');
const Route = require('../../src/models/Route');

let app;

// MongoMemoryServer first start can exceed 5s (download / bind on Windows)
beforeAll(async () => {
  await connect();
  app = createApp();
}, 60_000);
afterAll(async () => {
  await disconnect();
}, 30_000);
afterEach(clearDB);

async function makeUser(role = 'admin', password = 'secret123') {
  const u = new User({ name: role, email: `${role}@x.com`, role });
  await u.setPassword(password);
  await u.save();
  return { user: u, password };
}

async function loginToken(role) {
  const { user, password } = await makeUser(role);
  const res = await request(app).post('/api/auth/login').send({ email: user.email, password });
  return { token: res.body.token, user };
}

describe('Auth API', () => {
  test('POST /api/auth/register creates student and returns token', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Sam', email: 'sam@x.com', password: 'secret123' });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.role).toBe('student');
  });

  test('POST /api/auth/register rejects duplicate email', async () => {
    await makeUser('student');
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Sam', email: 'student@x.com', password: 'secret123' });
    expect(res.status).toBe(409);
  });

  test('POST /api/auth/login returns token for valid creds', async () => {
    await makeUser('admin');
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@x.com', password: 'secret123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
  });

  test('POST /api/auth/login rejects bad password', async () => {
    await makeUser('admin');
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@x.com', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  test('GET /api/auth/me returns current user', async () => {
    const { token } = await loginToken('student');
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('student');
  });
});

describe('Routes API (role-gated)', () => {
  const sampleRoute = {
    name: 'Main Loop',
    stops: [
      { name: 'A', lat: 28.5, lng: 77.1, order: 1 },
      { name: 'B', lat: 28.6, lng: 77.2, order: 2 },
    ],
    polyline: [[28.5, 77.1], [28.6, 77.2]],
  };

  test('student cannot create a route', async () => {
    const { token } = await loginToken('student');
    const res = await request(app)
      .post('/api/routes')
      .set('Authorization', `Bearer ${token}`)
      .send(sampleRoute);
    expect(res.status).toBe(403);
  });

  test('admin can create, list, update and delete a route', async () => {
    const { token } = await loginToken('admin');

    const createRes = await request(app)
      .post('/api/routes')
      .set('Authorization', `Bearer ${token}`)
      .send(sampleRoute);
    expect(createRes.status).toBe(201);
    const id = createRes.body.route._id;

    const listRes = await request(app).get('/api/routes').set('Authorization', `Bearer ${token}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.routes).toHaveLength(1);

    const updateRes = await request(app)
      .put(`/api/routes/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Renamed Loop' });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.route.name).toBe('Renamed Loop');

    const delRes = await request(app)
      .delete(`/api/routes/${id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(delRes.status).toBe(200);
  });
});

describe('Buses API', () => {
  test('admin creates a bus; student can list', async () => {
    const { token: adminToken } = await loginToken('admin');
    const route = await Route.create({
      name: 'R',
      stops: [
        { name: 'A', lat: 0, lng: 0, order: 1 },
        { name: 'B', lat: 1, lng: 1, order: 2 },
      ],
    });
    const createRes = await request(app)
      .post('/api/buses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ busNumber: 'B-1', routeId: route._id.toString() });
    expect(createRes.status).toBe(201);

    const { token: studentToken } = await loginToken('student');
    const listRes = await request(app).get('/api/buses').set('Authorization', `Bearer ${studentToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.buses).toHaveLength(1);
  });
});
