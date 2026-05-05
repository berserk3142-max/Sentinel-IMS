/**
 * Debounce Engine — Aggregates many signals into single Work Items.
 *
 * Maintains a Map<componentId, { workItemId, signals[], timer }>.
 * When a signal arrives for a component:
 *   1. No entry → create Work Item in Postgres, start 10s timer
 *   2. Entry exists → append signal to batch, increment counter
 *   3. Timer fires → flush the batch, clear the entry
 *
 * Uses a (component_id, window_start) unique constraint for idempotency.
 */
import { db } from '../db/index.js';
import { workItems, signals, type NewSignal } from '../db/schema.js';
import { AlertFactory, determineSeverity } from '../strategies/AlertStrategy.js';
import { eq, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export interface RawSignal {
  component_id: string;
  error_type: string;
  severity: string;
  metadata?: Record<string, unknown>;
  timestamp?: string;
}

interface DebounceEntry {
  workItemId: string;
  componentId: string;
  severity: 'P0' | 'P1' | 'P2';
  windowStart: Date;
  pendingSignals: RawSignal[];
  timer: ReturnType<typeof setTimeout>;
  signalCount: number;
}

export class DebounceEngine {
  private entries = new Map<string, DebounceEntry>();
  private windowMs: number;
  private flushBatchSize = 50;
  private _totalProcessed = 0;

  constructor(windowMs: number = 10_000) {
    this.windowMs = windowMs;
  }

  /**
   * Process an incoming signal — either create a new Work Item or append to existing.
   */
  async process(signal: RawSignal): Promise<void> {
    const key = signal.component_id;
    const existing = this.entries.get(key);

    if (existing) {
      // Entry exists — append signal, increment counter
      existing.pendingSignals.push(signal);
      existing.signalCount++;

      // Flush in batches if pending signals are large
      if (existing.pendingSignals.length >= this.flushBatchSize) {
        await this.flushSignals(existing);
      }
    } else {
      // No entry — create new Work Item
      await this.createNewEntry(signal);
    }

    this._totalProcessed++;
  }

  /**
   * Create a new debounce entry and Work Item in the database.
   */
  private async createNewEntry(signal: RawSignal): Promise<void> {
    const windowStart = new Date();
    const severity = determineSeverity(signal.component_id);
    const workItemId = uuidv4();

    try {
      // Insert work item into Postgres
      await db.insert(workItems).values({
        id: workItemId,
        componentId: signal.component_id,
        status: 'OPEN',
        severity,
        startTime: windowStart,
        windowStart,
        signalCount: 1,
      });

      // Insert the first signal
      await db.insert(signals).values({
        workItemId,
        componentId: signal.component_id,
        errorType: signal.error_type,
        severity: signal.severity,
        rawPayload: signal.metadata || {},
        timestamp: signal.timestamp ? new Date(signal.timestamp) : new Date(),
      });

      // Fire alert
      const alertStrategy = AlertFactory.create(severity);
      await alertStrategy.notify({
        id: workItemId,
        componentId: signal.component_id,
        status: 'OPEN',
        severity,
        startTime: windowStart,
        endTime: null,
        mttrSeconds: null,
        windowStart,
        signalCount: 1,
        createdAt: windowStart,
        updatedAt: windowStart,
      });

      // Set up timer for flush
      const timer = setTimeout(() => {
        this.flushAndClear(signal.component_id);
      }, this.windowMs);

      this.entries.set(signal.component_id, {
        workItemId,
        componentId: signal.component_id,
        severity,
        windowStart,
        pendingSignals: [],
        timer,
        signalCount: 1,
      });
    } catch (error: any) {
      // Handle unique constraint violation (concurrent creation)
      if (error.code === '23505') {
        console.log(`[Debounce] Duplicate window for ${signal.component_id}, skipping`);
      } else {
        throw error;
      }
    }
  }

  /**
   * Flush pending signals to the database.
   */
  private async flushSignals(entry: DebounceEntry): Promise<void> {
    if (entry.pendingSignals.length === 0) return;

    const batch = entry.pendingSignals.splice(0);
    const signalRows: NewSignal[] = batch.map(s => ({
      workItemId: entry.workItemId,
      componentId: s.component_id,
      errorType: s.error_type,
      severity: s.severity,
      rawPayload: s.metadata || {},
      timestamp: s.timestamp ? new Date(s.timestamp) : new Date(),
    }));

    try {
      // Batch insert signals
      if (signalRows.length > 0) {
        await db.insert(signals).values(signalRows);
      }

      // Update signal count on work item
      await db.update(workItems)
        .set({
          signalCount: sql`${workItems.signalCount} + ${batch.length}`,
          updatedAt: new Date(),
        })
        .where(eq(workItems.id, entry.workItemId));
    } catch (error) {
      console.error(`[Debounce] Failed to flush signals for ${entry.componentId}:`, error);
      // Re-add failed signals for retry
      entry.pendingSignals.unshift(...batch);
    }
  }

  /**
   * Timer callback — flush remaining signals and clear the entry.
   */
  private async flushAndClear(componentId: string): Promise<void> {
    const entry = this.entries.get(componentId);
    if (!entry) return;

    await this.flushSignals(entry);
    this.entries.delete(componentId);
    console.log(`[Debounce] Window closed for ${componentId} (${entry.signalCount} signals → 1 work item)`);
  }

  /** Get number of active debounce windows */
  get activeWindows(): number {
    return this.entries.size;
  }

  /** Total signals processed */
  get totalProcessed(): number {
    return this._totalProcessed;
  }

  /** Get active component IDs */
  get activeComponents(): string[] {
    return Array.from(this.entries.keys());
  }

  /** Shutdown — flush all and clear timers */
  async shutdown(): Promise<void> {
    for (const [componentId, entry] of this.entries) {
      clearTimeout(entry.timer);
      await this.flushSignals(entry);
    }
    this.entries.clear();
  }
}
