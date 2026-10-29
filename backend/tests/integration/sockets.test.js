const http = require('http');
const { Server } = require('socket.io');
const Client = require('socket.io-client');
const { connect, disconnect, clearDB } = require('../setup');
const { registerSocketHandlers } = require('../../src/sockets');
const { signToken } = require('../../src/middleware/auth');
const User = require('../../src/models/User');
const Route = require('../../src/models/Route');
const Bus = require('../../src/models/Bus');

let httpServer;
let io;
let port;

beforeAll(async () => {
  await connect();
  httpServer = http.createServer();
  io = new Server(httpServer, { cors: { origin: '*' } });
  registerSocketHandlers(io);
  await new Promise((resolve) => {
    httpServer.listen(0, () => {
      port = httpServer.address().port;
      resolve();
    });
  });
});

afterAll(async () => {
  io.close();
  await new Promise((r) => httpServer.close(r));
  await disconnect();
});

afterEach(clearDB);

function clientFor(token) {
  return Client(`http://localhost:${port}`, {
    auth: { token },
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
  });
}

async function setupUsers() {
  const driver = new User({ name: 'D', email: 'd@x.com', role: 'driver' });
  await driver.setPassword('secret123');
  await driver.save();
  const student = new User({ name: 'S', email: 's@x.com', role: 'student' });
  await student.setPassword('secret123');
  await student.save();

  const route = await Route.create({
    name: 'Loop',
    stops: [
      { name: 'A', lat: 0, lng: 0, order: 1 },
      { name: 'B', lat: 0, lng: 1, order: 2 },
    ],
  });
  const bus = await Bus.create({ busNumber: 'B-1', routeId: route._id, driverId: driver._id });
  return {
    driver,
    student,
    route,
    bus,
    driverToken: signToken(driver),
    studentToken: signToken(student),
  };
}

test('socket connection rejects without token', (done) => {
  const sock = Client(`http://localhost:${port}`, {
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
  });
  sock.on('connect_error', (err) => {
    expect(err.message).toMatch(/token/i);
    sock.close();
    done();
  });
});

test('driver -> server -> student end-to-end location broadcast', async () => {
  const { driverToken, studentToken, route, bus } = await setupUsers();

  const driverSock = clientFor(driverToken);
  const studentSock = clientFor(studentToken);

  // Wait for both to connect
  await Promise.all([
    new Promise((res) => driverSock.on('connect', res)),
    new Promise((res) => studentSock.on('connect', res)),
  ]);

  // Student subscribes to the route
  studentSock.emit('subscribe:route', { routeId: route._id.toString() });

  // Driver starts a trip (use callback-ack to know it completed)
  await new Promise((resolve, reject) => {
    driverSock.emit('trip:start', { busId: bus._id.toString() }, (ack) => {
      if (ack && ack.ok) resolve();
      else reject(new Error(ack && ack.message));
    });
  });

  // Listen for the broadcast
  const received = new Promise((resolve) => {
    studentSock.on('bus:location', (payload) => resolve(payload));
  });

  driverSock.emit('location:update', {
    busId: bus._id.toString(),
    lat: 0,
    lng: 0.5,
    speed: 20,
  });

  const payload = await received;
  expect(payload.busId).toBe(bus._id.toString());
  expect(payload.lat).toBe(0);
  expect(payload.lng).toBe(0.5);
  expect(Array.isArray(payload.etas)).toBe(true);

  driverSock.close();
  studentSock.close();
});

test('delay notification broadcasts to route subscribers', async () => {
  const { driverToken, studentToken, route, bus } = await setupUsers();
  const driverSock = clientFor(driverToken);
  const studentSock = clientFor(studentToken);

  await Promise.all([
    new Promise((res) => driverSock.on('connect', res)),
    new Promise((res) => studentSock.on('connect', res)),
  ]);

  studentSock.emit('subscribe:route', { routeId: route._id.toString() });

  const got = new Promise((resolve) => {
    studentSock.on('bus:delay', (p) => resolve(p));
  });

  // Give the subscribe a tick to register
  await new Promise((r) => setTimeout(r, 50));

  driverSock.emit('status:delay', { busId: bus._id.toString(), reason: 'Traffic' });

  const payload = await got;
  expect(payload.busId).toBe(bus._id.toString());
  expect(payload.reason).toBe('Traffic');

  driverSock.close();
  studentSock.close();
});
