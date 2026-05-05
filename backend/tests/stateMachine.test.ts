import { describe, it, expect } from 'vitest';
import { validateTransition, getAllowedTransitions, calculateMTTR, InvalidTransitionError, MissingRCAError } from '../src/state/StateMachine.js';

describe('StateMachine', () => {
  describe('validateTransition', () => {
    it('allows OPEN → INVESTIGATING', () => {
      expect(() => validateTransition('OPEN', 'INVESTIGATING', false, 'test-id')).not.toThrow();
    });

    it('allows INVESTIGATING → RESOLVED', () => {
      expect(() => validateTransition('INVESTIGATING', 'RESOLVED', false, 'test-id')).not.toThrow();
    });

    it('allows RESOLVED → CLOSED with RCA', () => {
      expect(() => validateTransition('RESOLVED', 'CLOSED', true, 'test-id')).not.toThrow();
    });

    it('rejects OPEN → RESOLVED (skip)', () => {
      expect(() => validateTransition('OPEN', 'RESOLVED', false, 'test-id')).toThrow(InvalidTransitionError);
    });

    it('rejects OPEN → CLOSED (skip)', () => {
      expect(() => validateTransition('OPEN', 'CLOSED', false, 'test-id')).toThrow(InvalidTransitionError);
    });

    it('rejects CLOSED → anything', () => {
      expect(() => validateTransition('CLOSED', 'OPEN', false, 'test-id')).toThrow(InvalidTransitionError);
    });

    it('rejects INVESTIGATING → OPEN (backward)', () => {
      expect(() => validateTransition('INVESTIGATING', 'OPEN', false, 'test-id')).toThrow(InvalidTransitionError);
    });

    it('rejects RESOLVED → CLOSED without RCA', () => {
      expect(() => validateTransition('RESOLVED', 'CLOSED', false, 'test-id')).toThrow(MissingRCAError);
    });
  });

  describe('getAllowedTransitions', () => {
    it('returns INVESTIGATING for OPEN', () => {
      expect(getAllowedTransitions('OPEN')).toEqual(['INVESTIGATING']);
    });

    it('returns RESOLVED for INVESTIGATING', () => {
      expect(getAllowedTransitions('INVESTIGATING')).toEqual(['RESOLVED']);
    });

    it('returns CLOSED for RESOLVED', () => {
      expect(getAllowedTransitions('RESOLVED')).toEqual(['CLOSED']);
    });

    it('returns empty for CLOSED', () => {
      expect(getAllowedTransitions('CLOSED')).toEqual([]);
    });
  });

  describe('calculateMTTR', () => {
    it('calculates correct MTTR in seconds', () => {
      const start = new Date('2025-01-01T00:00:00Z');
      const end = new Date('2025-01-01T00:05:30Z');
      expect(calculateMTTR(start, end)).toBe(330); // 5 min 30 sec = 330s
    });

    it('returns null when endTime is null', () => {
      expect(calculateMTTR(new Date(), null)).toBeNull();
    });

    it('handles same timestamps (0 seconds)', () => {
      const now = new Date();
      expect(calculateMTTR(now, now)).toBe(0);
    });

    it('handles large MTTR (hours)', () => {
      const start = new Date('2025-01-01T00:00:00Z');
      const end = new Date('2025-01-01T03:30:00Z');
      expect(calculateMTTR(start, end)).toBe(12600); // 3.5 hours
    });
  });
});
