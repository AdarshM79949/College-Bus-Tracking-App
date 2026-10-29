const express = require('express');
const cors = require('cors');
const config = require('./config');

const authRoutes = require('./routes/auth');
const routeRoutes = require('./routes/routes');
const busRoutes = require('./routes/buses');
const userRoutes = require('./routes/users');
const tripRoutes = require('./routes/trips');

function createApp() {
  const app = express();

  app.use(cors({ origin: config.clientOrigin, credentials: true }));
  app.use(express.json());

  app.get('/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

  app.use('/api/auth', authRoutes);
  app.use('/api/routes', routeRoutes);
  app.use('/api/buses', busRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/trips', tripRoutes);

  // 404
  app.use((req, res) => res.status(404).json({ message: 'Not found' }));

  // error handler
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    const status = err.status || 500;
    res.status(status).json({ message: err.message || 'Server error' });
  });

  return app;
}

module.exports = { createApp };
