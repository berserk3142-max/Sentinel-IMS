/**
 * Health Route — GET /health
 *
 * Returns system health status including DB connectivity,
 * buffer usage, uptime, and metrics.
 */
import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { sql } from 'drizzle-orm';
import type { RingBuffer } from '../buffer/RingBuffer.js';
import type { MetricsCollector } from '../metrics/MetricsCollector.js';

export function registerHealthRoutes(
  app: FastifyInstance,
  buffer: RingBuffer<any>,
  metrics: MetricsCollector,
  startTime: number
): void {

  app.get('/health', async (request, reply) => {
    let dbStatus = 'connected';
    let dbLatencyMs = 0;

    try {
      const start = Date.now();
      await db.execute(sql`SELECT 1`);
      dbLatencyMs = Date.now() - start;
    } catch (error) {
      dbStatus = 'disconnected';
    }

    const status = dbStatus === 'connected' ? 'healthy' : 'degraded';
    const httpStatus = status === 'healthy' ? 200 : 503;
    const latestMetrics = metrics.getLatest();

    return reply.status(httpStatus).send({
      status,
      uptime: Math.round((Date.now() - startTime) / 1000),
      timestamp: new Date().toISOString(),
      buffer: {
        size: buffer.size,
        capacity: buffer.capacity,
        usagePercent: buffer.usagePercent,
        totalPushed: buffer.totalPushed,
        totalDropped: buffer.totalDropped,
      },
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
      },
      metrics: latestMetrics ? {
        signalsPerSecond: latestMetrics.signalsPerSecond,
        activeIncidents: latestMetrics.activeIncidents,
        totalSignalsProcessed: latestMetrics.totalSignalsProcessed,
      } : null,
    });
  });
}
