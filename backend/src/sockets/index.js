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
    socket.on('trip:start', async ({ busId, isReturn } = {}, ack) => {
      try {
        if (socket.user.role !== 'driver') throw new Error('Driver only');
        const bus = await Bus.findById(busId);
        if (!bus) throw new Error('Bus not found');
        if (bus.driverId && bus.driverId.toString() !== socket.user.id) {
          throw new Error('You are only authorized to operate your assigned bus');
        }
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
        socket.data.isReturn = Boolean(isReturn);
        socket.join(`bus:${bus._id}`);
        io.to(`route:${bus.routeId}`).emit('bus:status', { busId: bus._id, status: 'active', isReturn: Boolean(isReturn) });
        io.to('admin:all').emit('bus:status', { busId: bus._id, status: 'active', isReturn: Boolean(isReturn) });
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
        if (bus.driverId && bus.driverId.toString() !== socket.user.id) {
          throw new Error('You are only authorized to operate your assigned bus');
        }
        const tripId = socket.data.activeTripId;
        if (tripId) {
          await Trip.findByIdAndUpdate(tripId, { endedAt: new Date() });
        }
        bus.status = 'idle';
        await bus.save();
        io.to(`route:${bus.routeId}`).emit('bus:status', { busId: bus._id, status: 'idle' });
        io.to('admin:all').emit('bus:status', { busId: bus._id, status: 'idle' });
        socket.data.activeTripId = null;
        socket.data.isReturn = false;
        if (ack) ack({ ok: true });
      } catch (err) {
        if (ack) ack({ ok: false, message: err.message });
      }
    });

    socket.on('location:update', async ({ busId, lat, lng, speed, isReturn } = {}) => {
      try {
        if (socket.user.role !== 'driver') return;
        if (typeof lat !== 'number' || typeof lng !== 'number') return;
        const bus = await Bus.findById(busId);
        if (!bus) return;
        if (bus.driverId && bus.driverId.toString() !== socket.user.id) return;

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

        const currentIsReturn = isReturn !== undefined ? Boolean(isReturn) : Boolean(socket.data.isReturn);
        socket.data.isReturn = currentIsReturn;

        // Compute ETAs - if return trip, evaluate in reverse stop order
        const route = await Route.findById(bus.routeId);
        let stopsToUse = [];
        if (route && Array.isArray(route.stops)) {
          const sorted = [...route.stops].sort((a, b) => a.order - b.order);
          stopsToUse = currentIsReturn ? [...sorted].reverse() : sorted;
        }
        const etas = route
          ? computeEtas({ lat, lng }, stopsToUse, config.avgBusSpeedKmh)
          : [];

        const payload = {
          busId: bus._id,
          busNumber: bus.busNumber,
          routeId: bus.routeId,
          lat,
          lng,
          speed: speed || 0,
          status: bus.status,
          isReturn: currentIsReturn,
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
