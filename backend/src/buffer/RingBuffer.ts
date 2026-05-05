/**
 * RingBuffer — Fixed-size circular buffer for backpressure management.
 * 
 * When signals arrive faster than the DB can write, they queue here.
 * If the buffer fills, push() returns false → caller returns 429.
 * O(1) push and pop operations.
 */
export class RingBuffer<T> {
  private buf: (T | null)[];
  private head = 0; // next write position
  private tail = 0; // next read position
  private count = 0;
  private _capacity: number;
  private _totalPushed = 0;
  private _totalDropped = 0;

  constructor(capacity: number) {
    this._capacity = capacity;
    this.buf = new Array(capacity).fill(null);
  }

  /**
   * Push an item into the buffer.
   * Returns true if successful, false if buffer is full (backpressure).
   */
  push(item: T): boolean {
    if (this.count >= this._capacity) {
      this._totalDropped++;
      return false; // Buffer full — apply backpressure
    }
    this.buf[this.head] = item;
    this.head = (this.head + 1) % this._capacity;
    this.count++;
    this._totalPushed++;
    return true;
  }

  /**
   * Pop an item from the buffer.
   * Returns null if buffer is empty.
   */
  pop(): T | null {
    if (this.count === 0) return null;
    const item = this.buf[this.tail];
    this.buf[this.tail] = null;
    this.tail = (this.tail + 1) % this._capacity;
    this.count--;
    return item;
  }

  /**
   * Pop up to `maxItems` from the buffer in a single batch.
   */
  popBatch(maxItems: number): T[] {
    const batch: T[] = [];
    const limit = Math.min(maxItems, this.count);
    for (let i = 0; i < limit; i++) {
      const item = this.pop();
      if (item !== null) batch.push(item);
    }
    return batch;
  }

  /** Current number of items in the buffer */
  get size(): number {
    return this.count;
  }

  /** Maximum capacity */
  get capacity(): number {
    return this._capacity;
  }

  /** Usage as a percentage (0–100) */
  get usagePercent(): number {
    return Math.round((this.count / this._capacity) * 100);
  }

  /** Whether the buffer is full */
  get isFull(): boolean {
    return this.count >= this._capacity;
  }

  /** Whether the buffer is empty */
  get isEmpty(): boolean {
    return this.count === 0;
  }

  /** Total items successfully pushed since creation */
  get totalPushed(): number {
    return this._totalPushed;
  }

  /** Total items dropped due to full buffer */
  get totalDropped(): number {
    return this._totalDropped;
  }

  /** Reset the buffer */
  clear(): void {
    this.buf = new Array(this._capacity).fill(null);
    this.head = 0;
    this.tail = 0;
    this.count = 0;
  }
}
