/**
 * Production simulator that orchestrates work orders on work centers,
 * scheduling production cycles, breakdowns, and repairs through the
 * discrete-event simulation engine.
 */

import type { SimulationConfig, WorkCenterConfig, WorkOrderConfig, SimEvent } from '../types.js';
import { SimulationEngine } from '../engine.js';
import { SimulatedWorkCenter } from './simulated-work-center.js';

interface WorkOrderState {
  config: WorkOrderConfig;
  workCenterConfig: WorkCenterConfig;
  workCenter: SimulatedWorkCenter;
  produced: number;
  rejected: number;
  workOrderId: string;
  started: boolean;
  completed: boolean;
  broken: boolean;
  nextBreakdownTime: number;
}

/**
 * Orchestrates multiple work orders across work centers within a simulation engine.
 */
export class ProductionSimulator {
  readonly engine: SimulationEngine;
  private workOrderStates: WorkOrderState[] = [];
  private simConfig: SimulationConfig;
  private eventLog: SimEvent[] = [];

  constructor(config: SimulationConfig) {
    this.simConfig = config;
    this.engine = new SimulationEngine(0); // run as fast as possible
    this.initializeWorkOrders();
    this.registerHandlers();
  }

  private initializeWorkOrders(): void {
    const lineMap = new Map<string, WorkCenterConfig>();
    for (const line of this.simConfig.lines) {
      lineMap.set(line.workCenterId, line);
    }

    for (let i = 0; i < this.simConfig.workOrders.length; i++) {
      const woConfig = this.simConfig.workOrders[i];
      const workCenterId = woConfig.workCenterId ?? this.simConfig.lines[0].workCenterId;
      const wcConfig = lineMap.get(workCenterId);
      if (!wcConfig) {
        throw new Error(`Work center "${workCenterId}" not found in simulation config`);
      }

      const seed = this.simConfig.seed + i * 1000;
      const workCenter = new SimulatedWorkCenter(wcConfig, seed);

      this.workOrderStates.push({
        config: woConfig,
        workCenterConfig: wcConfig,
        workCenter,
        produced: 0,
        rejected: 0,
        workOrderId: `WO-${String(i + 1).padStart(3, '0')}`,
        started: false,
        completed: false,
        broken: false,
        nextBreakdownTime: 0,
      });
    }
  }

  private registerHandlers(): void {
    this.engine.on('wo-start', (event) => this.handleWorkOrderStart(event));
    this.engine.on('cycle', (event) => this.handleCycle(event));
    this.engine.on('breakdown', (event) => this.handleBreakdown(event));
    this.engine.on('repair-complete', (event) => this.handleRepairComplete(event));
    this.engine.on('wo-complete', (event) => this.handleWorkOrderComplete(event));

    // Log all events
    this.engine.on('*', (event) => {
      this.eventLog.push({ ...event });
    });
  }

  /**
   * Start the simulation. Schedules initial work order starts.
   */
  start(): void {
    for (let i = 0; i < this.workOrderStates.length; i++) {
      this.engine.scheduleEvent({
        time: 0,
        type: 'wo-start',
        data: { woIndex: i },
      });
    }
  }

  /**
   * Run the simulation for the configured shift duration.
   */
  async run(): Promise<SimEvent[]> {
    const durationSec = this.simConfig.shiftDurationHours * 3600;
    this.start();
    await this.engine.run(durationSec);
    return this.eventLog;
  }

  /**
   * Get summary statistics for all work orders.
   */
  getSummary(): Array<{
    workOrderId: string;
    productSku: string;
    targetQty: number;
    produced: number;
    rejected: number;
    completed: boolean;
  }> {
    return this.workOrderStates.map((wo) => ({
      workOrderId: wo.workOrderId,
      productSku: wo.config.productSku,
      targetQty: wo.config.quantity,
      produced: wo.produced,
      rejected: wo.rejected,
      completed: wo.completed,
    }));
  }

  private handleWorkOrderStart(event: SimEvent): void {
    const woIndex = event.data.woIndex as number;
    const wo = this.workOrderStates[woIndex];
    wo.started = true;

    // Schedule first breakdown
    const breakdown = wo.workCenter.nextBreakdown();
    wo.nextBreakdownTime = event.time + breakdown.timeTillBreakdown;

    // Schedule first production cycle
    this.scheduleCycle(woIndex, event.time);
  }

  private handleCycle(event: SimEvent): void {
    const woIndex = event.data.woIndex as number;
    const wo = this.workOrderStates[woIndex];

    if (wo.completed || wo.broken) return;

    const result = wo.workCenter.produceCycle();

    if (result.isReject) {
      wo.rejected++;
      this.engine.scheduleEvent({
        time: event.time,
        type: 'reject',
        data: {
          woIndex,
          workOrderId: wo.workOrderId,
          quality: result.qualityMeasurements,
        },
      });
    } else {
      wo.produced++;
      this.engine.scheduleEvent({
        time: event.time,
        type: 'good-unit',
        data: {
          woIndex,
          workOrderId: wo.workOrderId,
          produced: wo.produced,
          quality: result.qualityMeasurements,
        },
      });
    }

    // Check if work order is complete
    if (wo.produced >= wo.config.quantity) {
      this.engine.scheduleEvent({
        time: event.time,
        type: 'wo-complete',
        data: { woIndex },
      });
      return;
    }

    // Check if breakdown should occur
    const nextCycleTime = event.time + result.cycleDurationSec;
    if (nextCycleTime >= wo.nextBreakdownTime) {
      this.engine.scheduleEvent({
        time: wo.nextBreakdownTime,
        type: 'breakdown',
        data: { woIndex },
      });
      return;
    }

    // Check for minor stop
    if (wo.workCenter.checkMinorStop(result.cycleDurationSec)) {
      const minorStopDuration = 30 + Math.random() * 90; // 30-120 seconds
      this.engine.scheduleEvent({
        time: event.time + result.cycleDurationSec,
        type: 'minor-stop',
        data: {
          woIndex,
          workOrderId: wo.workOrderId,
          durationSec: minorStopDuration,
        },
      });
      this.scheduleCycle(woIndex, nextCycleTime + minorStopDuration);
      return;
    }

    // Schedule next cycle
    this.scheduleCycle(woIndex, nextCycleTime);
  }

  private handleBreakdown(event: SimEvent): void {
    const woIndex = event.data.woIndex as number;
    const wo = this.workOrderStates[woIndex];
    wo.broken = true;

    const breakdown = wo.workCenter.nextBreakdown();
    const repairEnd = event.time + breakdown.repairDurationSec;

    this.engine.scheduleEvent({
      time: event.time,
      type: 'breakdown-start',
      data: {
        woIndex,
        workOrderId: wo.workOrderId,
        repairDurationSec: breakdown.repairDurationSec,
      },
    });

    this.engine.scheduleEvent({
      time: repairEnd,
      type: 'repair-complete',
      data: {
        woIndex,
        nextBreakdownTimeDelta: breakdown.timeTillBreakdown,
      },
    });
  }

  private handleRepairComplete(event: SimEvent): void {
    const woIndex = event.data.woIndex as number;
    const wo = this.workOrderStates[woIndex];
    wo.broken = false;

    // Schedule next breakdown
    const nextBreakdownDelta = event.data.nextBreakdownTimeDelta as number;
    wo.nextBreakdownTime = event.time + nextBreakdownDelta;

    if (!wo.completed) {
      this.scheduleCycle(woIndex, event.time);
    }
  }

  private handleWorkOrderComplete(event: SimEvent): void {
    const woIndex = event.data.woIndex as number;
    const wo = this.workOrderStates[woIndex];
    wo.completed = true;
  }

  private scheduleCycle(woIndex: number, time: number): void {
    this.engine.scheduleEvent({
      time,
      type: 'cycle',
      data: { woIndex },
    });
  }
}
