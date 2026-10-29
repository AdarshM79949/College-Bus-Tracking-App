const http = require('http');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const config = require('./config');
const { createApp } = require('./app');
const { registerSocketHandlers } = require('./sockets');

async function connectDb() {
  if (process.env.USE_MEMORY_DB === '1') {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    const mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);
    console.log('[db] in-memory MongoDB ready at', uri);
    return;
  }
  try {
    await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 3000 });
    console.log('[db] connected:', config.mongoUri);
  } catch (err) {
    console.warn('[db] could not reach', config.mongoUri, '- falling back to in-memory MongoDB');
    const { MongoMemoryServer } = require('mongodb-memory-server');
    const mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);
    console.log('[db] in-memory MongoDB ready at', uri);
  }
}

async function maybeAutoSeed() {
  const User = require('./models/User');
  const count = await User.estimatedDocumentCount();
  if (count > 0) return;
  console.log('[seed] empty DB - seeding demo data');
  const Route = require('./models/Route');
  const Bus = require('./models/Bus');
  async function mk(name, email, password, role) {
    const u = new User({ name, email, role });
    await u.setPassword(password);
    await u.save();
    return u;
  }
  await mk('Admin', 'admin@campus.edu', 'admin123', 'admin');
  const driver = await mk('Driver Dan', 'driver@campus.edu', 'driver123', 'driver');
  await mk('Student Sam', 'student@campus.edu', 'student123', 'student');
  // IIT (ISM) Dhanbad campus coordinates
  const route = await Route.create({
    name: 'ISM Campus Loop',
    stops: [
      { name: 'Main Gate',       lat: 23.8143, lng: 86.4412, order: 1 },
      { name: 'Penman Hostel',   lat: 23.8160, lng: 86.4420, order: 2 },
      { name: 'Academic Complex',lat: 23.8175, lng: 86.4408, order: 3 },
      { name: 'Central Library', lat: 23.8168, lng: 86.4395, order: 4 },
      { name: 'Sports Complex',  lat: 23.8152, lng: 86.4388, order: 5 },
    ],
    polyline: [
      [23.8143, 86.4412], [23.8150, 86.4416], [23.8160, 86.4420],
      [23.8170, 86.4418], [23.8175, 86.4408], [23.8172, 86.4400],
      [23.8168, 86.4395], [23.8160, 86.4390], [23.8152, 86.4388],
      [23.8146, 86.4398], [23.8143, 86.4412],
    ],
  });
  await Bus.create({ busNumber: 'BUS-001', routeId: route._id, driverId: driver._id });
  console.log('[seed] done');
}

async function start() {
  await connectDb();
  await maybeAutoSeed();

  const app = createApp();
  const server = http.createServer(app);

  const io = new Server(server, {
    cors: { origin: config.clientOrigin, credentials: true },
  });
  registerSocketHandlers(io);
  app.set('io', io);

  server.listen(config.port, () => {
    console.log(`[api] listening on http://localhost:${config.port}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});
