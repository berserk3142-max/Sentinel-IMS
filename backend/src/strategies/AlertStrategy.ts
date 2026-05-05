/**
 * Alert Strategy Pattern — Notification strategies based on severity.
 *
 * P0 (Critical): RDBMS/MCP failures → immediate page (console + high priority log)
 * P1 (High): API failures → standard alert
 * P2 (Low): Cache failures → low priority notification
 *
 * A factory function selects the right strategy based on component type.
 * To swap alert logic later, only touch the factory.
 */
import type { WorkItem } from '../db/schema.js';

export interface AlertStrategy {
  readonly priority: string;
  notify(workItem: WorkItem): Promise<void>;
}

// ─── P0 Critical Alert ──────────────────────────────────────────────────────

export class P0CriticalAlert implements AlertStrategy {
  readonly priority = 'P0';

  async notify(workItem: WorkItem): Promise<void> {
    console.log('\x1b[41m\x1b[37m 🚨 P0 CRITICAL ALERT \x1b[0m');
    console.log(`  Component: ${workItem.componentId}`);
    console.log(`  Status: ${workItem.status}`);
    console.log(`  Signals: ${workItem.signalCount}`);
    console.log(`  Started: ${workItem.startTime.toISOString()}`);
    console.log('  Action: IMMEDIATE PAGE — All hands on deck!');
    console.log('');
    // In production: integrate PagerDuty/Opsgenie API
  }
}

// ─── P1 High Alert ──────────────────────────────────────────────────────────

export class P1HighAlert implements AlertStrategy {
  readonly priority = 'P1';

  async notify(workItem: WorkItem): Promise<void> {
    console.log('\x1b[43m\x1b[30m ⚠️  P1 HIGH ALERT \x1b[0m');
    console.log(`  Component: ${workItem.componentId}`);
    console.log(`  Status: ${workItem.status}`);
    console.log(`  Signals: ${workItem.signalCount}`);
    console.log(`  Started: ${workItem.startTime.toISOString()}`);
    console.log('  Action: Engineering team notified');
    console.log('');
    // In production: Slack #incidents channel
  }
}

// ─── P2 Low Alert ───────────────────────────────────────────────────────────

export class P2LowAlert implements AlertStrategy {
  readonly priority = 'P2';

  async notify(workItem: WorkItem): Promise<void> {
    console.log('\x1b[44m\x1b[37m ℹ️  P2 LOW ALERT \x1b[0m');
    console.log(`  Component: ${workItem.componentId}`);
    console.log(`  Status: ${workItem.status}`);
    console.log(`  Signals: ${workItem.signalCount}`);
    console.log(`  Started: ${workItem.startTime.toISOString()}`);
    console.log('  Action: Logged for review');
    console.log('');
    // In production: Slack message to #monitoring
  }
}

// ─── Alert Factory ──────────────────────────────────────────────────────────

/** Component type → severity mapping */
const componentSeverityMap: Record<string, 'P0' | 'P1' | 'P2'> = {
  RDBMS: 'P0',
  MCP: 'P0',
  PRIMARY_DB: 'P0',
  API: 'P1',
  SERVICE: 'P1',
  GATEWAY: 'P1',
  CACHE: 'P2',
  CDN: 'P2',
  QUEUE: 'P2',
};

/**
 * Determine severity from a component ID.
 * Checks if the component ID starts with any known prefix.
 */
export function determineSeverity(componentId: string): 'P0' | 'P1' | 'P2' {
  const upper = componentId.toUpperCase();
  for (const [prefix, severity] of Object.entries(componentSeverityMap)) {
    if (upper.startsWith(prefix)) return severity;
  }
  return 'P1'; // Default to P1 for unknown components
}

/**
 * Factory — create the right alert strategy for a severity level.
 */
export class AlertFactory {
  static create(severity: 'P0' | 'P1' | 'P2'): AlertStrategy {
    switch (severity) {
      case 'P0': return new P0CriticalAlert();
      case 'P1': return new P1HighAlert();
      case 'P2': return new P2LowAlert();
    }
  }

  /** Convenience: create from component ID */
  static fromComponentId(componentId: string): AlertStrategy {
    return AlertFactory.create(determineSeverity(componentId));
  }
}
