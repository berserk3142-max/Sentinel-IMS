/**
 * Async Worker Pool — Manages concurrent DB write operations with retry logic.
 *
 * Wraps every DB write in exponential backoff retry (3 attempts: 100ms, 200ms, 400ms).
 * Controls concurrency to prevent overwhelming the database.
 */

export interface WorkerTask<T = void> {
  execute: () => Promise<T>;
  label?: string;
}

export class WorkerPool {
  private active = 0;
  private queue: WorkerTask[] = [];
  private maxConcurrency: number;
  private maxRetries: number;
  private baseDelayMs: number;

  constructor(maxConcurrency = 10, maxRetries = 3, baseDelayMs = 100) {
    this.maxConcurrency = maxConcurrency;
    this.maxRetries = maxRetries;
    this.baseDelayMs = baseDelayMs;
  }

  /**
   * Submit a task to the worker pool.
   */
  async submit<T>(task: WorkerTask<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const wrappedTask: WorkerTask = {
        label: task.label,
        execute: async () => {
          try {
            const result = await this.executeWithRetry(task.execute, task.label);
            resolve(result);
          } catch (error) {
            reject(error);
          }
        },
      };

      if (this.active < this.maxConcurrency) {
        this.active++;
        wrappedTask.execute().finally(() => {
          this.active--;
          this.processQueue();
        });
      } else {
        this.queue.push(wrappedTask);
      }
    });
  }

  /**
   * Execute a function with exponential backoff retry.
   */
  private async executeWithRetry<T>(
    fn: () => Promise<T>,
    label?: string,
    attempt = 1
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= this.maxRetries) {
        console.error(`[WorkerPool] ${label || 'Task'} failed after ${this.maxRetries} attempts:`, error);
        throw error;
      }

      const delay = this.baseDelayMs * Math.pow(2, attempt - 1); // 100, 200, 400ms
      console.warn(`[WorkerPool] ${label || 'Task'} attempt ${attempt} failed, retrying in ${delay}ms...`);
      await this.sleep(delay);
      return this.executeWithRetry(fn, label, attempt + 1);
    }
  }

  private processQueue(): void {
    if (this.queue.length > 0 && this.active < this.maxConcurrency) {
      const task = this.queue.shift()!;
      this.active++;
      task.execute().finally(() => {
        this.active--;
        this.processQueue();
      });
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /** Number of currently executing tasks */
  get activeCount(): number {
    return this.active;
  }

  /** Number of tasks waiting in queue */
  get queueLength(): number {
    return this.queue.length;
  }
}
