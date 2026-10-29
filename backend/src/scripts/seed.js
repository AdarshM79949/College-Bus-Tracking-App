/* Seed demo data: admin, driver, student, one route, one bus */
const mongoose = require('mongoose');
const config = require('../config');
const User = require('../models/User');
const Route = require('../models/Route');
const Bus = require('../models/Bus');

async function seed() {
  await mongoose.connect(config.mongoUri);
  console.log('[seed] connected');

  await Promise.all([User.deleteMany({}), Route.deleteMany({}), Bus.deleteMany({})]);

  async function mkUser(name, email, password, role) {
    const u = new User({ name, email, role });
    await u.setPassword(password);
    await u.save();
    return u;
  }

  const admin = await mkUser('Admin', 'admin@campus.edu', 'admin123', 'admin');
  const driver = await mkUser('Driver Dan', 'driver@campus.edu', 'driver123', 'driver');
  const student = await mkUser('Student Sam', 'student@campus.edu', 'student123', 'student');

  // Demo campus route (IIT Delhi area as example coords)
  // IIT (ISM) Dhanbad campus coordinates
  const route = await Route.create({
    name: 'ISM Campus Loop',
    stops: [
      { name: 'Main Gate',        lat: 23.8143, lng: 86.4412, order: 1 },
      { name: 'Penman Hostel',    lat: 23.8160, lng: 86.4420, order: 2 },
      { name: 'Academic Complex', lat: 23.8175, lng: 86.4408, order: 3 },
      { name: 'Central Library',  lat: 23.8168, lng: 86.4395, order: 4 },
      { name: 'Sports Complex',   lat: 23.8152, lng: 86.4388, order: 5 },
    ],
    polyline: [
      [23.8143, 86.4412], [23.8150, 86.4416], [23.8160, 86.4420],
      [23.8170, 86.4418], [23.8175, 86.4408], [23.8172, 86.4400],
      [23.8168, 86.4395], [23.8160, 86.4390], [23.8152, 86.4388],
      [23.8146, 86.4398], [23.8143, 86.4412],
    ],
  });

  const bus = await Bus.create({
    busNumber: 'BUS-001',
    routeId: route._id,
    driverId: driver._id,
  });

  console.log('[seed] done:', {
    admin: admin.email,
    driver: driver.email,
    student: student.email,
    route: route.name,
    bus: bus.busNumber,
  });
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('[seed] failed', err);
  process.exit(1);
});
