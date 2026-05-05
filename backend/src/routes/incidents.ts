/**
 * Incidents Routes — CRUD, state transitions, and RCA management.
 */
import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { workItems, signals, rcaRecords } from '../db/schema.js';
import { eq, desc, or, sql, asc } from 'drizzle-orm';
import {
  validateTransition,
  calculateMTTR,
  getAllowedTransitions,
  type WorkItemStatus,
} from '../state/StateMachine.js';
import type { Server as SocketServer } from 'socket.io';

export function registerIncidentRoutes(app: FastifyInstance, io: SocketServer): void {

  // ─── GET /api/incidents — Paginated list ────────────────────────────────────

  app.get<{
    Querystring: { page?: string; limit?: string; status?: string }
  }>('/api/incidents', async (request) => {
    const page = parseInt(request.query.page || '1');
    const limit = Math.min(parseInt(request.query.limit || '50'), 100);
    const offset = (page - 1) * limit;
    const statusFilter = request.query.status as WorkItemStatus | undefined;

    let query = db.select().from(workItems);

    if (statusFilter) {
      query = query.where(eq(workItems.status, statusFilter)) as any;
    }

    const items = await query
      .orderBy(
        sql`CASE ${workItems.severity} WHEN 'P0' THEN 0 WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 END`,
        desc(workItems.createdAt)
      )
      .limit(limit)
      .offset(offset);

    // Get total count
    const countResult = await db.select({ count: sql<number>`count(*)::int` })
      .from(workItems);
    const total = countResult[0]?.count || 0;

    return {
      incidents: items.map(item => ({
        ...item,
        allowedTransitions: getAllowedTransitions(item.status as WorkItemStatus),
        age: Math.round((Date.now() - new Date(item.startTime).getTime()) / 1000),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  });

  // ─── GET /api/incidents/:id — Detail with signals ──────────────────────────

  app.get<{ Params: { id: string } }>('/api/incidents/:id', async (request, reply) => {
    const { id } = request.params;

    const [incident] = await db.select().from(workItems).where(eq(workItems.id, id));
    if (!incident) {
      return reply.status(404).send({ error: 'Incident not found' });
    }

    const incidentSignals = await db.select()
      .from(signals)
      .where(eq(signals.workItemId, id))
      .orderBy(asc(signals.timestamp));

    const [rca] = await db.select()
      .from(rcaRecords)
      .where(eq(rcaRecords.workItemId, id));

    return {
      incident: {
        ...incident,
        allowedTransitions: getAllowedTransitions(incident.status as WorkItemStatus),
        age: Math.round((Date.now() - new Date(incident.startTime).getTime()) / 1000),
      },
      signals: incidentSignals,
      rca: rca || null,
      signalCount: incidentSignals.length,
    };
  });

  // ─── POST /api/incidents/:id/transition — State change ─────────────────────

  app.post<{
    Params: { id: string };
    Body: { next: WorkItemStatus };
  }>('/api/incidents/:id/transition', async (request, reply) => {
    const { id } = request.params;
    const { next } = request.body;

    if (!next) {
      return reply.status(400).send({ error: 'Missing "next" status in body' });
    }

    const [incident] = await db.select().from(workItems).where(eq(workItems.id, id));
    if (!incident) {
      return reply.status(404).send({ error: 'Incident not found' });
    }

    // Check if RCA exists (needed for CLOSED transition)
    const [rca] = await db.select()
      .from(rcaRecords)
      .where(eq(rcaRecords.workItemId, id));
    const hasCompleteRCA = !!rca && !!rca.fixApplied && !!rca.preventionSteps;

    try {
      validateTransition(incident.status as WorkItemStatus, next, hasCompleteRCA, id);
    } catch (error: any) {
      return reply.status(400).send({
        error: error.message,
        type: error.name,
        currentStatus: incident.status,
        requestedStatus: next,
        allowedTransitions: getAllowedTransitions(incident.status as WorkItemStatus),
      });
    }

    // Calculate MTTR when resolving
    const updates: Record<string, any> = {
      status: next,
      updatedAt: new Date(),
    };

    if (next === 'RESOLVED') {
      updates.endTime = new Date();
      updates.mttrSeconds = calculateMTTR(new Date(incident.startTime), new Date());
    }

    await db.update(workItems)
      .set(updates)
      .where(eq(workItems.id, id));

    const [updated] = await db.select().from(workItems).where(eq(workItems.id, id));

    // Emit real-time update
    io.emit('incident:updated', {
      ...updated,
      allowedTransitions: getAllowedTransitions(updated.status as WorkItemStatus),
    });

    return {
      success: true,
      incident: {
        ...updated,
        allowedTransitions: getAllowedTransitions(updated.status as WorkItemStatus),
      },
    };
  });

  // ─── POST /api/incidents/:id/rca — Submit RCA ──────────────────────────────

  app.post<{
    Params: { id: string };
    Body: {
      root_cause_category: string;
      fix_applied: string;
      prevention_steps: string;
    };
  }>('/api/incidents/:id/rca', async (request, reply) => {
    const { id } = request.params;
    const { root_cause_category, fix_applied, prevention_steps } = request.body;

    // Validate required fields
    if (!root_cause_category || !fix_applied || !prevention_steps) {
      return reply.status(400).send({
        error: 'All RCA fields are required: root_cause_category, fix_applied, prevention_steps',
      });
    }

    const validCategories = ['Network', 'Database', 'Memory', 'Config', 'ExternalDependency'];
    if (!validCategories.includes(root_cause_category)) {
      return reply.status(400).send({
        error: `Invalid root cause category. Must be one of: ${validCategories.join(', ')}`,
      });
    }

    const [incident] = await db.select().from(workItems).where(eq(workItems.id, id));
    if (!incident) {
      return reply.status(404).send({ error: 'Incident not found' });
    }

    if (incident.status !== 'RESOLVED') {
      return reply.status(400).send({
        error: 'RCA can only be submitted for incidents in RESOLVED status',
        currentStatus: incident.status,
      });
    }

    // Check if RCA already exists
    const [existingRca] = await db.select()
      .from(rcaRecords)
      .where(eq(rcaRecords.workItemId, id));

    if (existingRca) {
      // Update existing RCA
      await db.update(rcaRecords)
        .set({
          rootCauseCategory: root_cause_category as any,
          fixApplied: fix_applied,
          preventionSteps: prevention_steps,
          submittedAt: new Date(),
        })
        .where(eq(rcaRecords.workItemId, id));
    } else {
      // Insert new RCA
      await db.insert(rcaRecords).values({
        workItemId: id,
        rootCauseCategory: root_cause_category as any,
        fixApplied: fix_applied,
        preventionSteps: prevention_steps,
      });
    }

    const [rca] = await db.select()
      .from(rcaRecords)
      .where(eq(rcaRecords.workItemId, id));

    io.emit('incident:rca', { workItemId: id, rca });

    return { success: true, rca };
  });

  // ─── GET /api/dashboard — Cached summary ───────────────────────────────────

  app.get('/api/dashboard', async () => {
    // Active incidents (OPEN or INVESTIGATING)
    const activeItems = await db.select()
      .from(workItems)
      .where(
        or(
          eq(workItems.status, 'OPEN'),
          eq(workItems.status, 'INVESTIGATING'),
          eq(workItems.status, 'RESOLVED')
        )
      )
      .orderBy(
        sql`CASE ${workItems.severity} WHEN 'P0' THEN 0 WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 END`,
        desc(workItems.createdAt)
      )
      .limit(50);

    // Summary counts
    const allItems = await db.select().from(workItems);
    const counts = {
      total: allItems.length,
      open: allItems.filter(i => i.status === 'OPEN').length,
      investigating: allItems.filter(i => i.status === 'INVESTIGATING').length,
      resolved: allItems.filter(i => i.status === 'RESOLVED').length,
      closed: allItems.filter(i => i.status === 'CLOSED').length,
      p0: allItems.filter(i => i.severity === 'P0').length,
      p1: allItems.filter(i => i.severity === 'P1').length,
      p2: allItems.filter(i => i.severity === 'P2').length,
    };

    // Average MTTR for closed incidents
    const closedWithMttr = allItems.filter(i => i.mttrSeconds !== null && i.mttrSeconds > 0);
    const avgMttr = closedWithMttr.length > 0
      ? Math.round(closedWithMttr.reduce((sum, i) => sum + (i.mttrSeconds || 0), 0) / closedWithMttr.length)
      : null;

    return {
      incidents: activeItems.map(item => ({
        ...item,
        allowedTransitions: getAllowedTransitions(item.status as WorkItemStatus),
        age: Math.round((Date.now() - new Date(item.startTime).getTime()) / 1000),
      })),
      counts,
      avgMttr,
      timestamp: new Date().toISOString(),
    };
  });

  // ─── GET /api/metrics — Metrics snapshots ──────────────────────────────────

  app.get<{
    Querystring: { limit?: string }
  }>('/api/metrics', async (request) => {
    const limit = Math.min(parseInt(request.query.limit || '100'), 500);

    const snapshots = await db.select()
      .from(
        await import('../db/schema.js').then(m => m.metricsSnapshots)
      )
      .orderBy(desc(sql`timestamp`))
      .limit(limit);

    return { metrics: snapshots.reverse() };
  });
}
