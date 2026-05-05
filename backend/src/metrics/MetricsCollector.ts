/**
 * Metrics Collector — Tracks throughput, buffer usage, and active incidents.
 *
 * Runs a 5-second interval that:
 * 1. Counts signals processed since last tick
 * 2. Logs to console
 * 3. Stores snapshot for frontend charts
 * 4. Emits via Socket.IO for real-time dashboards
 */
import { db } from '../db/index.js';
import { metricsSnapshots, workItems } from '../db/schema.js';
import { eq, or } from 'drizzle-orm';
import type { Server as SocketServer } from 'socket.io';

export interface MetricsData {
  signalsPerSecond: number;
  bufferUsage: number;
  bufferCapacity: number;
  activeIncidents: number;
  totalSignalsProcessed: number;
  uptime: number;
  timestamp: string;
}

export class MetricsCollector {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private signalsSinceLastTick = 0;
  private totalSignals = 0;
  private startTime = Date.now();
  private io: SocketServer | null = null;
  private getBufferUsage: () => { size: number; capacity: number };
  private lastMetrics: MetricsData | null = null;

  constructor(getBufferUsage: () => { size: number; capacity: number }) {
    this.getBufferUsage = getBufferUsage;
  }

  /** Attach Socket.IO server for real-time push */
  setSocketServer(io: SocketServer): void {
    this.io = io;
  }

  /** Call this whenever a signal is processed */
  recordSignal(): void {
    this.signalsSinceLastTick++;
    this.totalSignals++;
  }

  /** Record multiple signals at once */
  recordSignals(count: number): void {
    this.signalsSinceLastTick += count;
    this.totalSignals += count;
  }

  /** Start the metrics collection loop (every 5 seconds) */
  start(intervalMs = 5000): void {
    this.intervalId = setInterval(async () => {
      await this.tick();
    }, intervalMs);
    console.log(`[Metrics] Collector started (${intervalMs}ms interval)`);
  }

  /** Stop the metrics collection loop */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /** Get the latest metrics */
  getLatest(): MetricsData | null {
    return this.lastMetrics;
  }

  /** Single tick of the metrics collector */
  private async tick(): Promise<void> {
    const buffer = this.getBufferUsage();
    const signalsPerSecond = Math.round(this.signalsSinceLastTick / 5);
    this.signalsSinceLastTick = 0;

    // Count active incidents
    let activeIncidents = 0;
    try {
      const result = await db.select()
        .from(workItems)
        .where(
          or(
            eq(workItems.status, 'OPEN'),
            eq(workItems.status, 'INVESTIGATING')
          )
        );
      activeIncidents = result.length;
    } catch {
      // Silently continue if DB query fails
    }

    const metrics: MetricsData = {
      signalsPerSecond,
      bufferUsage: buffer.size,
      bufferCapacity: buffer.capacity,
      activeIncidents,
      totalSignalsProcessed: this.totalSignals,
      uptime: Math.round((Date.now() - this.startTime) / 1000),
      timestamp: new Date().toISOString(),
    };

    this.lastMetrics = metrics;

    // Log to console
    console.log(
      `[Metrics] Signals/sec: ${signalsPerSecond} | Buffer: ${buffer.size}/${buffer.capacity} | Active incidents: ${activeIncidents} | Total: ${this.totalSignals}`
    );

    // Push via Socket.IO
    if (this.io) {
      this.io.emit('metrics', metrics);
    }

    // Store snapshot (fire and forget)
    try {
      await db.insert(metricsSnapshots).values({
        signalsPerSecond,
        bufferUsage: buffer.size,
        bufferCapacity: buffer.capacity,
        activeIncidents,
        totalSignalsProcessed: this.totalSignals,
      });
    } catch {
      // Silently continue
    }
  }
}
