import { describe, it, expect } from 'vitest';
import { SimulationEngine } from '../engine.js';
import type { SimEvent } from '../types.js';

describe('SimulationEngine', () => {
  it('processes events in time order', async () => {
    const engine = new SimulationEngine(0);
    const processed: number[] = [];

    engine.on('test', (event: SimEvent) => {
      processed.push(event.time);
    });

    // Schedule events out of order
    engine.scheduleEvent({ time: 30, type: 'test', data: {} });
    engine.scheduleEvent({ time: 10, type: 'test', data: {} });
    engine.scheduleEvent({ time: 50, type: 'test', data: {} });
    engine.scheduleEvent({ time: 20, type: 'test', data: {} });
    engine.scheduleEvent({ time: 40, type: 'test', data: {} });

    await engine.run(100);

    expect(processed).toEqual([10, 20, 30, 40, 50]);
  });

  it('calls handlers with correct event data', async () => {
    const engine = new SimulationEngine(0);
    const received: SimEvent[] = [];

    engine.on('produce', (event: SimEvent) => {
      received.push(event);
    });

    engine.scheduleEvent({
      time: 5,
      type: 'produce',
      data: { unitId: 'A', quantity: 10 },
    });
    engine.scheduleEvent({
      time: 15,
      type: 'produce',
      data: { unitId: 'B', quantity: 20 },
    });

    await engine.run(100);

    expect(received).toHaveLength(2);
    expect(received[0].data).toEqual({ unitId: 'A', quantity: 10 });
    expect(received[1].data).toEqual({ unitId: 'B', quantity: 20 });
  });

  it('only calls handlers for matching event types', async () => {
    const engine = new SimulationEngine(0);
    const produceCalls: number[] = [];
    const breakdownCalls: number[] = [];

    engine.on('produce', (event: SimEvent) => {
      produceCalls.push(event.time);
    });
    engine.on('breakdown', (event: SimEvent) => {
      breakdownCalls.push(event.time);
    });

    engine.scheduleEvent({ time: 1, type: 'produce', data: {} });
    engine.scheduleEvent({ time: 2, type: 'breakdown', data: {} });
    engine.scheduleEvent({ time: 3, type: 'produce', data: {} });

    await engine.run(100);

    expect(produceCalls).toEqual([1, 3]);
    expect(breakdownCalls).toEqual([2]);
  });

  it('wildcard handler receives all events', async () => {
    const engine = new SimulationEngine(0);
    const allEvents: string[] = [];

    engine.on('*', (event: SimEvent) => {
      allEvents.push(event.type);
    });

    engine.scheduleEvent({ time: 1, type: 'alpha', data: {} });
    engine.scheduleEvent({ time: 2, type: 'beta', data: {} });
    engine.scheduleEvent({ time: 3, type: 'gamma', data: {} });

    await engine.run(100);

    expect(allEvents).toEqual(['alpha', 'beta', 'gamma']);
  });

  it('does not process events beyond the duration', async () => {
    const engine = new SimulationEngine(0);
    const processed: number[] = [];

    engine.on('test', (event: SimEvent) => {
      processed.push(event.time);
    });

    engine.scheduleEvent({ time: 5, type: 'test', data: {} });
    engine.scheduleEvent({ time: 10, type: 'test', data: {} });
    engine.scheduleEvent({ time: 15, type: 'test', data: {} });

    await engine.run(12);

    expect(processed).toEqual([5, 10]);
    expect(engine.currentTime).toBe(12);
  });

  it('throws when scheduling an event in the past', async () => {
    const engine = new SimulationEngine(0);

    engine.on('test', () => {});

    engine.scheduleEvent({ time: 10, type: 'test', data: {} });
    await engine.run(20);

    expect(() => {
      engine.scheduleEvent({ time: 5, type: 'test', data: {} });
    }).toThrow(/past/);
  });

  it('allows handlers to schedule new events during processing', async () => {
    const engine = new SimulationEngine(0);
    const processed: number[] = [];

    engine.on('ping', (event: SimEvent) => {
      processed.push(event.time);
      if (event.time < 50) {
        engine.scheduleEvent({
          time: event.time + 10,
          type: 'ping',
          data: {},
        });
      }
    });

    engine.scheduleEvent({ time: 10, type: 'ping', data: {} });
    await engine.run(100);

    expect(processed).toEqual([10, 20, 30, 40, 50]);
  });

  it('tracks currentTime correctly', async () => {
    const engine = new SimulationEngine(0);

    expect(engine.currentTime).toBe(0);

    engine.scheduleEvent({ time: 25, type: 'test', data: {} });
    engine.on('test', () => {});

    await engine.run(50);

    expect(engine.currentTime).toBe(50);
  });
});
