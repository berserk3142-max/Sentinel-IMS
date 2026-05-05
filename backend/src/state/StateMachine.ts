/**
 * State Machine — Work Item status transitions with RCA enforcement.
 *
 * Valid transitions:
 *   OPEN → INVESTIGATING
 *   INVESTIGATING → RESOLVED
 *   RESOLVED → CLOSED (requires complete RCA)
 *
 * The CLOSED guard is where mandatory RCA validation lives.
 */

export type WorkItemStatus = 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'CLOSED';

export class InvalidTransitionError extends Error {
  constructor(from: WorkItemStatus, to: WorkItemStatus) {
    super(`Invalid transition: ${from} → ${to}`);
    this.name = 'InvalidTransitionError';
  }
}

export class MissingRCAError extends Error {
  constructor(workItemId: string) {
    super(`Cannot close work item ${workItemId}: RCA record is required`);
    this.name = 'MissingRCAError';
  }
}

/** Allowed transitions lookup table */
const transitions: Record<WorkItemStatus, WorkItemStatus[]> = {
  OPEN: ['INVESTIGATING'],
  INVESTIGATING: ['RESOLVED'],
  RESOLVED: ['CLOSED'],
  CLOSED: [],
};

/**
 * Validate a state transition.
 * @param current - Current work item status
 * @param next - Desired next status
 * @param hasCompleteRCA - Whether a complete RCA record exists
 * @throws InvalidTransitionError if transition is not allowed
 * @throws MissingRCAError if transitioning to CLOSED without RCA
 */
export function validateTransition(
  current: WorkItemStatus,
  next: WorkItemStatus,
  hasCompleteRCA: boolean,
  workItemId: string
): void {
  if (!transitions[current].includes(next)) {
    throw new InvalidTransitionError(current, next);
  }
  if (next === 'CLOSED' && !hasCompleteRCA) {
    throw new MissingRCAError(workItemId);
  }
}

/**
 * Get allowed transitions from a given status.
 */
export function getAllowedTransitions(current: WorkItemStatus): WorkItemStatus[] {
  return [...transitions[current]];
}

/**
 * Calculate MTTR (Mean Time To Resolve) in seconds.
 * @returns seconds between start and end, or null if end is not set
 */
export function calculateMTTR(startTime: Date, endTime: Date | null): number | null {
  if (!endTime) return null;
  return Math.round((endTime.getTime() - startTime.getTime()) / 1000);
}
