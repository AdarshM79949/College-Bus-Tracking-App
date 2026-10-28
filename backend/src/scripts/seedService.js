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

async function ensureUser(name, email, password, role) {
  let u = await User.findOne({ email: email.toLowerCase() });
  if (!u) {
    u = new User({ name, email: email.toLowerCase(), role });
    await u.setPassword(password);
    await u.save();
    console.log(`[seed] Created demo user: ${name} (${email})`);
  } else {
    // Ensure password and role are in sync
    await u.setPassword(password);
    u.name = name;
    u.role = role;
    await u.save();
    console.log(`[seed] Updated demo user: ${name} (${email})`);
  }
  return u;
}

async function seedDatabase(force = false) {
  const routeCount = await Route.countDocuments();
  const busCount = await Bus.countDocuments();
  const hasValanchery = await Route.findOne({ name: /valanchery/i });

  // 1. Pre-seed users (Admin, Student, 5 Drivers)
  const admin = await ensureUser('Admin', 'admin@mgm.ac.in', 'admin123', 'admin');
  const student = await ensureUser('Student', 'student@mgm.ac.in', 'student123', 'student');

  const driverPmna = await ensureUser('PMNA BUS MGM', 'pmnabus@mgm.ac.in', 'driver123', 'driver');
  const driverEdappal = await ensureUser('EDAPPAL BUS MGM', 'edappalbus@mgm.ac.in', 'driver123', 'driver');
  const driverTirur = await ensureUser('TIRUR BUS MGM', 'tirurbus@mgm.ac.in', 'driver123', 'driver');
  const driverKottakkal = await ensureUser('KOTTAKKAL BUS MGM', 'kottakkalbus@mgm.ac.in', 'driver123', 'driver');
  const driverKuttippuram = await ensureUser('KUTTIPPURAM BUS MGM', 'kuttippurambus@mgm.ac.in', 'driver123', 'driver');

  // If routes are already properly seeded with 5 routes and no Valanchery Town, skip route re-creation unless force
  if (!force && routeCount === 5 && busCount === 5 && !hasValanchery) {
    console.log('[seed] Database already has 5 valid routes & buses. Demo accounts verified.');
    return {
      users: 7,
      routes: 5,
      buses: 5,
    };
  }

  console.log('[seed] Rebuilding 5 regional routes with real road geometry...');
  await Promise.all([Route.deleteMany({}), Bus.deleteMany({})]);

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
    { name: 'Edappal Junction', lat: 10.7631, lng: 75.9790, order: 1 },
    { name: 'Kattipparuthi', lat: 10.8010, lng: 76.0120, order: 2 },
    { name: 'Kuttippuram Bus Stand', lat: 10.8427, lng: 76.0315, order: 3 },
    { name: 'Perassannur', lat: 10.8650, lng: 76.0580, order: 4 },
    { name: 'Valanchery KSRTC Stand', lat: 10.8889, lng: 76.0731, order: 5 },
    { name: 'MGM College Main Gate', lat: 10.8971, lng: 76.1124, order: 6 },
  ];
  const edappalPoly = await getRoadPolyline(edappalStops);
  const rEdappal = await Route.create({ name: 'Edappal - MGM College', stops: edappalStops, polyline: edappalPoly });

  // 3. Tirur
  const tirurStops = [
    { name: 'Tirur Bus Stand', lat: 10.9145, lng: 75.9234, order: 1 },
    { name: 'Thazhepalam', lat: 10.9110, lng: 75.9320, order: 2 },
    { name: 'Alathiyur', lat: 10.8870, lng: 75.9520, order: 3 },
    { name: 'Chamravattom Junction', lat: 10.8610, lng: 75.9780, order: 4 },
    { name: 'Kuttippuram Bridge', lat: 10.8390, lng: 76.0290, order: 5 },
    { name: 'Valanchery Central', lat: 10.8889, lng: 76.0731, order: 6 },
    { name: 'MGM College Main Gate', lat: 10.8971, lng: 76.1124, order: 7 },
  ];
  const tirurPoly = await getRoadPolyline(tirurStops);
  const rTirur = await Route.create({ name: 'Tirur - MGM College', stops: tirurStops, polyline: tirurPoly });

  // 4. Kottakkal
  const kottakkalStops = [
    { name: 'Kottakkal Arya Vaidya Sala', lat: 11.0012, lng: 75.9967, order: 1 },
    { name: 'Changuvetty Junction', lat: 10.9930, lng: 76.0020, order: 2 },
    { name: 'Randathani', lat: 10.9490, lng: 76.0240, order: 3 },
    { name: 'Puthanathani Junction', lat: 10.9230, lng: 76.0410, order: 4 },
    { name: 'Vettichira', lat: 10.9060, lng: 76.0550, order: 5 },
    { name: 'Valanchery Bus Stand', lat: 10.8889, lng: 76.0731, order: 6 },
    { name: 'MGM College Main Gate', lat: 10.8971, lng: 76.1124, order: 7 },
  ];
  const kottakkalPoly = await getRoadPolyline(kottakkalStops);
  const rKottakkal = await Route.create({ name: 'Kottakkal - MGM College', stops: kottakkalStops, polyline: kottakkalPoly });

  // 5. Kuttippuram
  const kuttippuramStops = [
    { name: 'Kuttippuram Railway Station', lat: 10.8440, lng: 76.0335, order: 1 },
    { name: 'Mavandiyur', lat: 10.8650, lng: 76.0520, order: 2 },
    { name: 'Valanchery Bus Stand', lat: 10.8889, lng: 76.0731, order: 3 },
    { name: 'Moodal', lat: 10.8930, lng: 76.0910, order: 4 },
    { name: 'Valiyaparambu', lat: 10.8985, lng: 76.1105, order: 5 },
    { name: 'MGM College Main Gate', lat: 10.8971, lng: 76.1124, order: 6 },
  ];
  const kuttippuramPoly = await getRoadPolyline(kuttippuramStops);
  const rKuttippuram = await Route.create({ name: 'Kuttippuram - MGM College', stops: kuttippuramStops, polyline: kuttippuramPoly });

  // Link buses to drivers & routes (5 buses)
  await Bus.create({ busNumber: 'PMNA BUS MGM', routeId: rPmna._id, driverId: driverPmna._id });
  await Bus.create({ busNumber: 'EDAPPAL BUS MGM', routeId: rEdappal._id, driverId: driverEdappal._id });
  await Bus.create({ busNumber: 'TIRUR BUS MGM', routeId: rTirur._id, driverId: driverTirur._id });
  await Bus.create({ busNumber: 'KOTTAKKAL BUS MGM', routeId: rKottakkal._id, driverId: driverKottakkal._id });
  await Bus.create({ busNumber: 'KUTTIPPURAM BUS MGM', routeId: rKuttippuram._id, driverId: driverKuttippuram._id });

  console.log('[seed] All 5 regional routes and demo accounts successfully pre-seeded!');
  return {
    users: 7,
    routes: 5,
    buses: 5,
  };
}

module.exports = { seedDatabase, getRoadPolyline, ensureUser };
