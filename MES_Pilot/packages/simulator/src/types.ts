/**
 * Simulation configuration types for the MES Plant Simulator.
 */

export interface SimulationConfig {
  name: string;
  timeScale: number; // e.g. 60 = 1 real second = 60 sim seconds
  seed: number;
  shiftDurationHours: number;
  lines: WorkCenterConfig[];
  workOrders: WorkOrderConfig[];
}

export interface WorkCenterConfig {
  workCenterId: string;
  idealCycleTimeSec: number;
  speedVariancePct: number;
  breakdownMtbfHours: number;
  breakdownMttrMin: { mean: number; std: number };
  rejectRate: number;
  minorStopRatePerHour: number;
  qualityParams: Record<string, { mean: number; std: number }>;
}

export interface WorkOrderConfig {
  productSku: string;
  quantity: number;
  workCenterId?: string;
}

export interface SimEvent {
  time: number;
  type: string;
  data: Record<string, unknown>;
}
