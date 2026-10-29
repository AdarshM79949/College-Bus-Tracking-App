const { verifyToken } = require('../middleware/auth');
const Bus = require('../models/Bus');
const Route = require('../models/Route');
const Trip = require('../models/Trip');
const { computeEtas } = require('../utils/etaCalculator');
const config = require('../config');

const DELAY_THRESHOLD_MS = 30_000;

function registerSocketHandlers(io) {
  io.use((socket, next) => {
    const token = socket.handshake.auth && socket.handshake.auth.token;
    if (!token) return next(new Error('Missing auth token'));
    try {
      const payload = verifyToken(token);
      socket.user = { id: payload.sub, role: payload.role, email: payload.email };
      next();
    } catch (_err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    // Monitoring: client joins a per-route room to get broadcasts for that route.
    socket.on('subscribe:route', ({ routeId } = {}) => {
      if (!routeId) return;
      socket.join(`route:${routeId}`);
    });

    socket.on('unsubscribe:route', ({ routeId } = {}) => {
      if (!routeId) return;
      socket.leave(`route:${routeId}`);
    });

    socket.on('subscribe:all', () => {
      if (socket.user.role !== 'admin') return;
      socket.join('admin:all');
    });

    // Driver-only events
    socket.on('trip:start', async ({ busId } = {}, ack) => {
      try {
        if (socket.user.role !== 'driver') throw new Error('Driver only');
        const bus = await Bus.findById(busId);
        if (!bus) throw new Error('Bus not found');
        const trip = await Trip.create({
          busId: bus._id,
          routeId: bus.routeId,
          driverId: socket.user.id,
        });
        bus.status = 'active';
        await bus.save();
        socket.data.activeTripId = trip._id;
        socket.data.activeBusId = bus._id.toString();
        socket.data.activeRouteId = bus.routeId.toString();
        socket.join(`bus:${bus._id}`);
        io.to(`route:${bus.routeId}`).emit('bus:status', { busId: bus._id, status: 'active' });
        io.to('admin:all').emit('bus:status', { busId: bus._id, status: 'active' });
        if (ack) ack({ ok: true, tripId: trip._id });
      } catch (err) {
        if (ack) ack({ ok: false, message: err.message });
      }
    });

    socket.on('trip:end', async ({ busId } = {}, ack) => {
      try {
        if (socket.user.role !== 'driver') throw new Error('Driver only');
        const bus = await Bus.findById(busId);
        if (!bus) throw new Error('Bus not found');
        const tripId = socket.data.activeTripId;
        if (tripId) {
          await Trip.findByIdAndUpdate(tripId, { endedAt: new Date() });
        }
        bus.status = 'idle';
        await bus.save();
        io.to(`route:${bus.routeId}`).emit('bus:status', { busId: bus._id, status: 'idle' });
        io.to('admin:all').emit('bus:status', { busId: bus._id, status: 'idle' });
        socket.data.activeTripId = null;
        if (ack) ack({ ok: true });
      } catch (err) {
        if (ack) ack({ ok: false, message: err.message });
      }
    });

    socket.on('location:update', async ({ busId, lat, lng, speed } = {}) => {
      try {
        if (socket.user.role !== 'driver') return;
        if (typeof lat !== 'number' || typeof lng !== 'number') return;
        const bus = await Bus.findById(busId);
        if (!bus) return;

        const now = new Date();
        const prevTs = bus.currentLocation && bus.currentLocation.updatedAt;
        bus.currentLocation = { lat, lng, speed: speed || 0, updatedAt: now };

        // Delay detection: if too long since last update while active
        if (bus.status === 'active' && prevTs && now - prevTs > DELAY_THRESHOLD_MS) {
          bus.status = 'delayed';
          io.to(`route:${bus.routeId}`).emit('bus:delay', {
            busId: bus._id,
            reason: 'No updates in 30s',
          });
          io.to('admin:all').emit('bus:delay', { busId: bus._id, reason: 'No updates in 30s' });
        } else if (bus.status === 'delayed') {
          bus.status = 'active';
        }
        await bus.save();

        if (socket.data.activeTripId) {
          await Trip.updateOne(
            { _id: socket.data.activeTripId },
            { $push: { locations: { lat, lng, speed: speed || 0, ts: now } } }
          );
        }

        // Compute ETAs
        const route = await Route.findById(bus.routeId);
        const etas = route
          ? computeEtas({ lat, lng }, route.stops, config.avgBusSpeedKmh)
          : [];

        const payload = {
          busId: bus._id,
          busNumber: bus.busNumber,
          routeId: bus.routeId,
          lat,
          lng,
          speed: speed || 0,
          status: bus.status,
          etas,
          ts: now,
        };
        io.to(`route:${bus.routeId}`).emit('bus:location', payload);
        io.to('admin:all').emit('bus:location', payload);
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    socket.on('status:delay', async ({ busId, reason } = {}) => {
      try {
        if (socket.user.role !== 'driver') return;
        const bus = await Bus.findById(busId);
        if (!bus) return;
        bus.status = 'delayed';
        await bus.save();
        io.to(`route:${bus.routeId}`).emit('bus:delay', {
          busId: bus._id,
          reason: reason || 'Driver flagged delay',
        });
        io.to('admin:all').emit('bus:delay', { busId: bus._id, reason });
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });
  });
}

module.exports = { registerSocketHandlers };
