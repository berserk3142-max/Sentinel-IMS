/**
 * Drain Loop — Pops signals from the ring buffer and feeds them
 * through the debounce engine.
 *
 * Runs every 100ms, pops up to 100 items per tick.
 * Completely decouples ingestion (fast) from persistence (slower).
 */
import type { RingBuffer } from '../buffer/RingBuffer.js';
import { DebounceEngine, type RawSignal } from '../debounce/DebounceEngine.js';
import type { MetricsCollector } from '../metrics/MetricsCollector.js';

export class DrainLoop {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private buffer: RingBuffer<RawSignal>;
  private debounce: DebounceEngine;
  private metrics: MetricsCollector;
  private batchSize: number;
  private intervalMs: number;

  constructor(
    buffer: RingBuffer<RawSignal>,
    debounce: DebounceEngine,
    metrics: MetricsCollector,
    batchSize = 100,
    intervalMs = 100
  ) {
    this.buffer = buffer;
    this.debounce = debounce;
    this.metrics = metrics;
    this.batchSize = batchSize;
    this.intervalMs = intervalMs;
  }

  /** Start the drain loop */
  start(): void {
    this.intervalId = setInterval(() => {
      this.tick();
    }, this.intervalMs);
    console.log(`[DrainLoop] Started (${this.intervalMs}ms interval, ${this.batchSize} items/tick)`);
  }

  /** Stop the drain loop */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[DrainLoop] Stopped');
    }
  }

  /** Single tick — pop batch from buffer, process through debounce */
  private tick(): void {
    const batch = this.buffer.popBatch(this.batchSize);
    if (batch.length === 0) return;

    // Process each signal through the debounce engine (fire and forget)
    for (const signal of batch) {
      this.debounce.process(signal).catch(err => {
        console.error('[DrainLoop] Error processing signal:', err);
      });
    }
  }
}
