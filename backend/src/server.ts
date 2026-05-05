/**
 * SentinelIMS Backend Server
 *
 * Main entry point that wires together:
 * - Fastify HTTP server with rate limiting
 * - Ring buffer for backpressure
 * - Drain loop for async processing
 * - Debounce engine for signal aggregation
 * - Socket.IO for real-time dashboard updates
 * - All REST API routes
 */
import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { Server as SocketServer } from 'socket.io';
import 'dotenv/config';

import { RingBuffer } from './buffer/RingBuffer.js';
import { DebounceEngine } from './debounce/DebounceEngine.js';
import { DrainLoop } from './ingestion/drainLoop.js';
import { MetricsCollector } from './metrics/MetricsCollector.js';
import { registerIngestionRoutes } from './routes/ingestion.js';
import { registerIncidentRoutes } from './routes/incidents.js';
import { registerHealthRoutes } from './routes/health.js';

const PORT = parseInt(process.env.PORT || '3001');
const HOST = process.env.HOST || '0.0.0.0';
const BUFFER_CAPACITY = parseInt(process.env.BUFFER_CAPACITY || '50000');
const DRAIN_INTERVAL_MS = parseInt(process.env.DRAIN_INTERVAL_MS || '100');
const DEBOUNCE_WINDOW_MS = parseInt(process.env.DEBOUNCE_WINDOW_MS || '10000');
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX || '5000');
const CORS_ORIGINS = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'];
const START_TIME = Date.now();

async function main() {
  // ─── Create Fastify instance ────────────────────────────────────────────────
  const app = Fastify({
    logger: {
      level: 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      },
    },
  });

  // ─── Register plugins ──────────────────────────────────────────────────────
  await app.register(cors, {
    origin: CORS_ORIGINS,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
  });

  await app.register(rateLimit, {
    max: RATE_LIMIT_MAX,
    timeWindow: '1 second',
    keyGenerator: (request) => request.ip,
    errorResponseBuilder: () => ({
      statusCode: 429,
      error: 'Too Many Requests',
      message: `Rate limit exceeded (${RATE_LIMIT_MAX} req/sec)`,
    }),
  });

  // ─── Initialize core engine ─────────────────────────────────────────────────
  const buffer = new RingBuffer<any>(BUFFER_CAPACITY);
  const debounceEngine = new DebounceEngine(DEBOUNCE_WINDOW_MS);
  const metricsCollector = new MetricsCollector(() => ({
    size: buffer.size,
    capacity: buffer.capacity,
  }));
  const drainLoop = new DrainLoop(buffer, debounceEngine, metricsCollector);

  // ─── Create a deferred Socket.IO reference ─────────────────────────────────
  // We pass a proxy io object to routes. Socket.IO attaches after listen().
  let io: SocketServer;
  const ioProxy = new Proxy({} as SocketServer, {
    get(_target, prop) {
      if (!io) return () => {};
      return (io as any)[prop];
    },
  });

  // ─── Register routes BEFORE listen ─────────────────────────────────────────
  registerIngestionRoutes(app, buffer, metricsCollector);
  registerIncidentRoutes(app, ioProxy);
  registerHealthRoutes(app, buffer, metricsCollector, START_TIME);

  // ─── Start HTTP server ─────────────────────────────────────────────────────
  await app.listen({ port: PORT, host: HOST });

  // ─── Attach Socket.IO to Fastify's HTTP server (after listen) ──────────────
  io = new SocketServer(app.server, {
    cors: {
      origin: CORS_ORIGINS,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}`);
    socket.on('disconnect', () => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
    });
  });

  metricsCollector.setSocketServer(io);

  // ─── Start background processes ─────────────────────────────────────────────
  drainLoop.start();
  metricsCollector.start(5000);

  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║                 🛡️  SentinelIMS Backend                 ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║  Server:     http://${HOST}:${PORT}                      ║`);
  console.log(`║  Buffer:     ${BUFFER_CAPACITY} slots                           ║`);
  console.log(`║  Rate Limit: ${RATE_LIMIT_MAX} req/sec                          ║`);
  console.log(`║  Debounce:   ${DEBOUNCE_WINDOW_MS / 1000}s window                            ║`);
  console.log(`║  Drain:      ${DRAIN_INTERVAL_MS}ms interval                          ║`);
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');

  // ─── Graceful shutdown ──────────────────────────────────────────────────────
  const shutdown = async () => {
    console.log('\n[Server] Shutting down gracefully...');
    drainLoop.stop();
    metricsCollector.stop();
    await debounceEngine.shutdown();
    io.close();
    await app.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
