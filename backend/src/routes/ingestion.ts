/**
 * Ingestion Route — POST /api/signals
 *
 * Accepts signals, pushes to ring buffer, returns 202 immediately.
 * Rate limited at 5,000 req/sec per IP.
 */
import type { FastifyInstance } from 'fastify';
import type { RingBuffer } from '../buffer/RingBuffer.js';
import type { MetricsCollector } from '../metrics/MetricsCollector.js';
import type { RawSignal } from '../debounce/DebounceEngine.js';

// JSON Schema for signal validation
const signalSchema = {
  type: 'object',
  required: ['component_id', 'error_type', 'severity'],
  properties: {
    component_id: { type: 'string', minLength: 1 },
    error_type: { type: 'string', minLength: 1 },
    severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
    metadata: { type: 'object' },
    timestamp: { type: 'string' },
  },
};

const batchSignalSchema = {
  type: 'object',
  required: ['signals'],
  properties: {
    signals: {
      type: 'array',
      items: signalSchema,
      maxItems: 500,
    },
  },
};

export function registerIngestionRoutes(
  app: FastifyInstance,
  buffer: RingBuffer<RawSignal>,
  metrics: MetricsCollector
): void {

  // ─── Single Signal Ingestion ────────────────────────────────────────────────

  app.post<{ Body: RawSignal }>(
    '/api/signals',
    {
      schema: { body: signalSchema },
    },
    async (request, reply) => {
      const signal = request.body;

      // Try to push to ring buffer
      const pushed = buffer.push(signal);
      if (!pushed) {
        return reply.status(429).send({
          error: 'Buffer full — backpressure applied',
          bufferUsage: `${buffer.size}/${buffer.capacity}`,
        });
      }

      metrics.recordSignal();

      return reply.status(202).send({
        status: 'accepted',
        bufferUsage: `${buffer.size}/${buffer.capacity}`,
      });
    }
  );

  // ─── Batch Signal Ingestion ─────────────────────────────────────────────────

  app.post<{ Body: { signals: RawSignal[] } }>(
    '/api/signals/batch',
    {
      schema: { body: batchSignalSchema },
    },
    async (request, reply) => {
      const { signals } = request.body;
      let accepted = 0;
      let dropped = 0;

      for (const signal of signals) {
        if (buffer.push(signal)) {
          accepted++;
        } else {
          dropped++;
        }
      }

      metrics.recordSignals(accepted);

      const status = dropped > 0 ? 207 : 202;
      return reply.status(status).send({
        status: dropped > 0 ? 'partial' : 'accepted',
        accepted,
        dropped,
        bufferUsage: `${buffer.size}/${buffer.capacity}`,
      });
    }
  );

  // ─── Buffer Status ─────────────────────────────────────────────────────────

  app.get('/api/buffer/status', async () => {
    return {
      size: buffer.size,
      capacity: buffer.capacity,
      usagePercent: buffer.usagePercent,
      isFull: buffer.isFull,
      totalPushed: buffer.totalPushed,
      totalDropped: buffer.totalDropped,
    };
  });
}
