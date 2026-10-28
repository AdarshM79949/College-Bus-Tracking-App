const http = require('http');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const config = require('./config');
const { createApp } = require('./app');
const { registerSocketHandlers } = require('./sockets');
const { seedDatabase } = require('./scripts/seedService');

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
  try {
    await seedDatabase(false);
  } catch (err) {
    console.error('[seed] auto-seed error:', err.message);
  }
}

async function start() {
  await connectDb();
  await maybeAutoSeed();

  const app = createApp();
  const server = http.createServer(app);

  const corsOrigin = (!config.clientOrigin || config.clientOrigin === '*')
    ? true
    : [config.clientOrigin, 'http://localhost:5173', 'http://localhost:3000', /\.vercel\.app$/];

  const io = new Server(server, {
    cors: { origin: corsOrigin, credentials: true },
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
