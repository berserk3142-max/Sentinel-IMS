import { describe, it, expect } from 'vitest';
import { RingBuffer } from '../src/buffer/RingBuffer.js';

describe('RingBuffer', () => {
  it('initializes with correct capacity', () => {
    const buf = new RingBuffer<number>(100);
    expect(buf.capacity).toBe(100);
    expect(buf.size).toBe(0);
    expect(buf.isEmpty).toBe(true);
  });

  it('push and pop work correctly', () => {
    const buf = new RingBuffer<string>(5);
    expect(buf.push('a')).toBe(true);
    expect(buf.push('b')).toBe(true);
    expect(buf.size).toBe(2);

    expect(buf.pop()).toBe('a');
    expect(buf.pop()).toBe('b');
    expect(buf.pop()).toBeNull();
  });

  it('returns false when buffer is full', () => {
    const buf = new RingBuffer<number>(3);
    expect(buf.push(1)).toBe(true);
    expect(buf.push(2)).toBe(true);
    expect(buf.push(3)).toBe(true);
    expect(buf.push(4)).toBe(false); // Full!
    expect(buf.isFull).toBe(true);
    expect(buf.totalDropped).toBe(1);
  });

  it('wraps around correctly (circular)', () => {
    const buf = new RingBuffer<number>(3);
    buf.push(1); buf.push(2); buf.push(3);
    buf.pop(); // Remove 1
    expect(buf.push(4)).toBe(true); // Should wrap around
    expect(buf.pop()).toBe(2);
    expect(buf.pop()).toBe(3);
    expect(buf.pop()).toBe(4);
  });

  it('popBatch returns correct items', () => {
    const buf = new RingBuffer<number>(10);
    for (let i = 1; i <= 5; i++) buf.push(i);
    const batch = buf.popBatch(3);
    expect(batch).toEqual([1, 2, 3]);
    expect(buf.size).toBe(2);
  });

  it('popBatch handles empty buffer', () => {
    const buf = new RingBuffer<number>(10);
    expect(buf.popBatch(5)).toEqual([]);
  });

  it('tracks usage percent correctly', () => {
    const buf = new RingBuffer<number>(100);
    for (let i = 0; i < 50; i++) buf.push(i);
    expect(buf.usagePercent).toBe(50);
  });

  it('clear resets the buffer', () => {
    const buf = new RingBuffer<number>(5);
    buf.push(1); buf.push(2);
    buf.clear();
    expect(buf.size).toBe(0);
    expect(buf.isEmpty).toBe(true);
  });

  it('tracks totalPushed correctly', () => {
    const buf = new RingBuffer<number>(2);
    buf.push(1); buf.push(2); buf.push(3); // 3rd is dropped
    expect(buf.totalPushed).toBe(2);
    expect(buf.totalDropped).toBe(1);
  });
});
