/**
 * Database Schema — Drizzle ORM definitions for Neon PostgreSQL.
 * 
 * Tables:
 * - work_items: Incident work items with state machine status
 * - signals: Raw signal storage with JSONB payload
 * - rca_records: Root Cause Analysis records (1:1 with work items)
 * - metrics_snapshots: Periodic throughput metrics for dashboard charts
 */
import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  jsonb,
  pgEnum,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

// ─── Enums ──────────────────────────────────────────────────────────────────

export const workItemStatusEnum = pgEnum('work_item_status', [
  'OPEN',
  'INVESTIGATING',
  'RESOLVED',
  'CLOSED',
]);

export const severityEnum = pgEnum('severity_level', [
  'P0',
  'P1',
  'P2',
]);

export const rootCauseCategoryEnum = pgEnum('root_cause_category', [
  'Network',
  'Database',
  'Memory',
  'Config',
  'ExternalDependency',
]);

// ─── Work Items Table ───────────────────────────────────────────────────────

export const workItems = pgTable('work_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  componentId: varchar('component_id', { length: 255 }).notNull(),
  status: workItemStatusEnum('status').notNull().default('OPEN'),
  severity: severityEnum('severity').notNull(),
  startTime: timestamp('start_time', { withTimezone: true }).notNull().defaultNow(),
  endTime: timestamp('end_time', { withTimezone: true }),
  mttrSeconds: integer('mttr_seconds'),
  windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
  signalCount: integer('signal_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('uq_component_window').on(table.componentId, table.windowStart),
  index('idx_work_items_status').on(table.status),
  index('idx_work_items_severity').on(table.severity),
  index('idx_work_items_component').on(table.componentId),
]);

// ─── Signals Table ──────────────────────────────────────────────────────────

export const signals = pgTable('signals', {
  id: uuid('id').primaryKey().defaultRandom(),
  workItemId: uuid('work_item_id').notNull().references(() => workItems.id, { onDelete: 'cascade' }),
  componentId: varchar('component_id', { length: 255 }).notNull(),
  errorType: varchar('error_type', { length: 255 }).notNull(),
  severity: varchar('severity', { length: 10 }).notNull(),
  rawPayload: jsonb('raw_payload'),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_signals_work_item_ts').on(table.workItemId, table.timestamp),
  index('idx_signals_component').on(table.componentId),
]);

// ─── RCA Records Table ──────────────────────────────────────────────────────

export const rcaRecords = pgTable('rca_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  workItemId: uuid('work_item_id').notNull().references(() => workItems.id, { onDelete: 'cascade' }).unique(),
  rootCauseCategory: rootCauseCategoryEnum('root_cause_category').notNull(),
  fixApplied: text('fix_applied').notNull(),
  preventionSteps: text('prevention_steps').notNull(),
  submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── Metrics Snapshots Table ────────────────────────────────────────────────

export const metricsSnapshots = pgTable('metrics_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  signalsPerSecond: integer('signals_per_second').notNull(),
  bufferUsage: integer('buffer_usage').notNull(),
  bufferCapacity: integer('buffer_capacity').notNull(),
  activeIncidents: integer('active_incidents').notNull(),
  totalSignalsProcessed: integer('total_signals_processed').notNull(),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_metrics_ts').on(table.timestamp),
]);

// ─── Type exports ───────────────────────────────────────────────────────────

export type WorkItem = typeof workItems.$inferSelect;
export type NewWorkItem = typeof workItems.$inferInsert;
export type Signal = typeof signals.$inferSelect;
export type NewSignal = typeof signals.$inferInsert;
export type RcaRecord = typeof rcaRecords.$inferSelect;
export type NewRcaRecord = typeof rcaRecords.$inferInsert;
export type MetricsSnapshot = typeof metricsSnapshots.$inferSelect;
