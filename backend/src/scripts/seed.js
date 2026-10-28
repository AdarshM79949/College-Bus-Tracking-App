/* Seed demo data: admin, driver, student, 6 MGM College routes, 6 buses with real road geometries */
const mongoose = require('mongoose');
const config = require('../config');
const User = require('../models/User');
const Route = require('../models/Route');
const Bus = require('../models/Bus');

async function getRoadPolyline(stops) {
  try {
    const coordsStr = stops.map((s) => `${s.lng},${s.lat}`).join(';');
    const url = `https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson`;
    const res = await fetch(url, { headers: { 'User-Agent': 'CampusBusTracker/1.0' }, signal: AbortSignal.timeout(10000) });
    const data = await res.json();
    if (data && data.routes && data.routes[0] && data.routes[0].geometry) {
      return data.routes[0].geometry.coordinates.map(([lng, lat]) => [Number(lat.toFixed(5)), Number(lng.toFixed(5))]);
    }
  } catch (err) {
    console.warn('[road] OSRM fetch failed, using fallback:', err.message);
  }
  return stops.map((s) => [s.lat, s.lng]);
}

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

  const admin = await mkUser('Admin', 'admin@mgm.ac.in', 'admin123', 'admin');
  const student = await mkUser('Student', 'student@mgm.ac.in', 'student123', 'student');

  const driverPmna = await mkUser('PMNA BUS MGM', 'pmnabus@mgm.ac.in', 'driver123', 'driver');
  const driverEdappal = await mkUser('EDAPPAL BUS MGM', 'edappalbus@mgm.ac.in', 'driver123', 'driver');
  const driverTirur = await mkUser('TIRUR BUS MGM', 'tirurbus@mgm.ac.in', 'driver123', 'driver');
  const driverKottakkal = await mkUser('KOTTAKKAL BUS MGM', 'kottakkalbus@mgm.ac.in', 'driver123', 'driver');
  const driverKuttippuram = await mkUser('KUTTIPPURAM BUS MGM', 'kuttippurambus@mgm.ac.in', 'driver123', 'driver');

  console.log('[seed] Generating real road polylines for all 6 routes...');

  // 1. Perinthalmanna
  const pmnaStops = [
    { name: 'Manazhi Bus Stand (Perinthalmanna)', lat: 10.9764, lng: 76.2404, order: 1 },
    { name: 'Angadipuram Town', lat: 10.9765, lng: 76.1984, order: 2 },
    { name: 'MES Medical College (Malaparamba)', lat: 10.9628, lng: 76.1852, order: 3 },
    { name: 'Kolathur Junction', lat: 10.9395, lng: 76.1558, order: 4 },
    { name: 'Vengad', lat: 10.9250, lng: 76.1365, order: 5 },
    { name: 'Pookkattiri Junction', lat: 10.9157, lng: 76.1223, order: 6 },
    { name: 'Edayur', lat: 10.9050, lng: 76.1180, order: 7 },
    { name: 'Valiyaparambu / Athippatta', lat: 10.8985, lng: 76.1105, order: 8 },
    { name: 'MGM College Main Gate', lat: 10.8971, lng: 76.1124, order: 9 },
  ];
  const pmnaPoly = await getRoadPolyline(pmnaStops);
  const rPmna = await Route.create({ name: 'Perinthalmanna - MGM College', stops: pmnaStops, polyline: pmnaPoly });

  // 2. Edappal
  const edappalStops = [
    { name: 'Edappal Junction', lat: 10.7618, lng: 75.9793, order: 1 },
    { name: 'Kuthiathode', lat: 10.7950, lng: 75.9990, order: 2 },
    { name: 'Kuttippuram Bridge', lat: 10.8350, lng: 76.0270, order: 3 },
    { name: 'Kuttippuram Town', lat: 10.8440, lng: 76.0335, order: 4 },
    { name: 'Mavandiyur / Kanchippura', lat: 10.8650, lng: 76.0520, order: 5 },
    { name: 'Valanchery Bus Stand', lat: 10.8889, lng: 76.0731, order: 6 },
    { name: 'Moodal / Edayur Road', lat: 10.8930, lng: 76.0910, order: 7 },
    { name: 'Valiyaparambu / Athippatta', lat: 10.8985, lng: 76.1105, order: 8 },
    { name: 'MGM College Main Gate', lat: 10.8971, lng: 76.1124, order: 9 },
  ];
  const edappalPoly = await getRoadPolyline(edappalStops);
  const rEdappal = await Route.create({ name: 'Edappal - MGM College', stops: edappalStops, polyline: edappalPoly });

  // 3. Tirur
  const tirurStops = [
    { name: 'Tirur Bus Stand', lat: 10.9160, lng: 75.9230, order: 1 },
    { name: 'BP Angadi', lat: 10.9080, lng: 75.9450, order: 2 },
    { name: 'Alathiyur Junction', lat: 10.8950, lng: 75.9650, order: 3 },
    { name: 'Thirunavaya Junction', lat: 10.8710, lng: 75.9890, order: 4 },
    { name: 'Kuttippuram Junction', lat: 10.8440, lng: 76.0335, order: 5 },
    { name: 'Valanchery Town', lat: 10.8889, lng: 76.0731, order: 6 },
    { name: 'Moodal / Edayur', lat: 10.8930, lng: 76.0910, order: 7 },
    { name: 'MGM College Main Gate', lat: 10.8971, lng: 76.1124, order: 8 },
  ];
  const tirurPoly = await getRoadPolyline(tirurStops);
  const rTirur = await Route.create({ name: 'Tirur - MGM College', stops: tirurStops, polyline: tirurPoly });

  // 4. Kottakkal
  const kottakkalStops = [
    { name: 'Kottakkal (Changuvetty)', lat: 10.9980, lng: 76.0020, order: 1 },
    { name: 'Edarikode', lat: 10.9780, lng: 76.0090, order: 2 },
    { name: 'Randathani', lat: 10.9490, lng: 76.0240, order: 3 },
    { name: 'Puthanathani Junction', lat: 10.9230, lng: 76.0410, order: 4 },
    { name: 'Vettichira', lat: 10.9060, lng: 76.0550, order: 5 },
    { name: 'Valanchery Town', lat: 10.8889, lng: 76.0731, order: 6 },
    { name: 'MGM College Main Gate', lat: 10.8971, lng: 76.1124, order: 7 },
  ];
  const kottakkalPoly = await getRoadPolyline(kottakkalStops);
  const rKottakkal = await Route.create({ name: 'Kottakkal - MGM College', stops: kottakkalStops, polyline: kottakkalPoly });

  // 5. Kuttippuram
  const kuttippuramStops = [
    { name: 'Kuttippuram Railway Station', lat: 10.8440, lng: 76.0335, order: 1 },
    { name: 'Mavandiyur', lat: 10.8650, lng: 76.0520, order: 2 },
    { name: 'Valanchery Town', lat: 10.8889, lng: 76.0731, order: 3 },
    { name: 'Moodal', lat: 10.8930, lng: 76.0910, order: 4 },
    { name: 'Valiyaparambu', lat: 10.8985, lng: 76.1105, order: 5 },
    { name: 'MGM College Main Gate', lat: 10.8971, lng: 76.1124, order: 6 },
  ];
  const kuttippuramPoly = await getRoadPolyline(kuttippuramStops);
  const rKuttippuram = await Route.create({ name: 'Kuttippuram - MGM College', stops: kuttippuramStops, polyline: kuttippuramPoly });

  // Link buses to drivers & routes (5 regional buses)
  await Bus.create({ busNumber: 'PMNA BUS MGM', routeId: rPmna._id, driverId: driverPmna._id });
  await Bus.create({ busNumber: 'EDAPPAL BUS MGM', routeId: rEdappal._id, driverId: driverEdappal._id });
  await Bus.create({ busNumber: 'TIRUR BUS MGM', routeId: rTirur._id, driverId: driverTirur._id });
  await Bus.create({ busNumber: 'KOTTAKKAL BUS MGM', routeId: rKottakkal._id, driverId: driverKottakkal._id });
  await Bus.create({ busNumber: 'KUTTIPPURAM BUS MGM', routeId: rKuttippuram._id, driverId: driverKuttippuram._id });

  console.log('[seed] All 5 regional MGM College routes & buses created successfully with real road geometries!');
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('[seed] failed:', err);
  process.exit(1);
});
