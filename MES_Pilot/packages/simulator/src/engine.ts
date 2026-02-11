/**
 * Discrete-event simulation engine with a min-heap priority queue.
 */

import type { SimEvent } from './types.js';

type EventHandler = (event: SimEvent) => void | Promise<void>;

/**
 * Min-heap priority queue ordered by event time.
 */
class EventQueue {
  private heap: SimEvent[] = [];

  get size(): number {
    return this.heap.length;
  }

  push(event: SimEvent): void {
    this.heap.push(event);
    this.bubbleUp(this.heap.length - 1);
  }

  pop(): SimEvent | undefined {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0];
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.sinkDown(0);
    }
    return top;
  }

  peek(): SimEvent | undefined {
    return this.heap[0];
  }

  private bubbleUp(i: number): void {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.heap[parent].time <= this.heap[i].time) break;
      [this.heap[parent], this.heap[i]] = [this.heap[i], this.heap[parent]];
      i = parent;
    }
  }

  private sinkDown(i: number): void {
    const n = this.heap.length;
    while (true) {
      let smallest = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      if (left < n && this.heap[left].time < this.heap[smallest].time) {
        smallest = left;
      }
      if (right < n && this.heap[right].time < this.heap[smallest].time) {
        smallest = right;
      }
      if (smallest === i) break;
      [this.heap[smallest], this.heap[i]] = [this.heap[i], this.heap[smallest]];
      i = smallest;
    }
  }
}

/**
 * Discrete-event simulation engine.
 *
 * Events are processed in chronological order from a min-heap priority queue.
 * Handlers can be registered per event type. The engine supports both
 * instantaneous and real-time-scaled execution modes.
 */
export class SimulationEngine {
  private queue = new EventQueue();
  private handlers = new Map<string, EventHandler[]>();
  private wildcardHandlers: EventHandler[] = [];
  private _currentTime = 0;
  private _timeScale: number;

  /**
   * @param timeScale - Ratio of simulation seconds to real seconds.
   *   e.g. 60 means 1 real second = 60 sim seconds. 0 = run as fast as possible.
   */
  constructor(timeScale = 0) {
    this._timeScale = timeScale;
  }

  get currentTime(): number {
    return this._currentTime;
  }

  get pendingEvents(): number {
    return this.queue.size;
  }

  /**
   * Schedule an event for future processing.
   */
  scheduleEvent(event: SimEvent): void {
    if (event.time < this._currentTime) {
      throw new Error(
        `Cannot schedule event in the past: event.time=${event.time}, currentTime=${this._currentTime}`
      );
    }
    this.queue.push(event);
  }

  /**
   * Register a handler for a specific event type. Use '*' for wildcard (all events).
   */
  on(eventType: string, handler: EventHandler): void {
    if (eventType === '*') {
      this.wildcardHandlers.push(handler);
      return;
    }
    const existing = this.handlers.get(eventType);
    if (existing) {
      existing.push(handler);
    } else {
      this.handlers.set(eventType, [handler]);
    }
  }

  /**
   * Run the simulation for the given duration (in simulation seconds).
   * If timeScale > 0, introduces real-time delays between events.
   */
  async run(durationSeconds: number): Promise<void> {
    const endTime = this._currentTime + durationSeconds;
    let realTimeAnchor = Date.now();
    let simTimeAnchor = this._currentTime;

    while (this.queue.size > 0) {
      const next = this.queue.peek()!;
      if (next.time > endTime) break;

      // Real-time delay if timeScale is set
      if (this._timeScale > 0) {
        const simElapsed = next.time - simTimeAnchor;
        const realElapsedMs = (simElapsed / this._timeScale) * 1000;
        const targetRealTime = realTimeAnchor + realElapsedMs;
        const waitMs = targetRealTime - Date.now();
        if (waitMs > 1) {
          await new Promise((resolve) => setTimeout(resolve, waitMs));
        }
      }

      const event = this.queue.pop()!;
      this._currentTime = event.time;

      // Dispatch to type-specific handlers
      const typeHandlers = this.handlers.get(event.type);
      if (typeHandlers) {
        for (const handler of typeHandlers) {
          await handler(event);
        }
      }

      // Dispatch to wildcard handlers
      for (const handler of this.wildcardHandlers) {
        await handler(event);
      }
    }

    this._currentTime = endTime;
  }
}
