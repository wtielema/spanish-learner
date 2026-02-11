/**
 * Simulated work center that models production cycles, breakdowns, and quality.
 */

import type { WorkCenterConfig } from '../types.js';
import { SeededRandom, normal, weibull, logNormal } from '../distributions.js';

export interface CycleResult {
  cycleDurationSec: number;
  isReject: boolean;
  qualityMeasurements: Record<string, number>;
}

export interface BreakdownResult {
  timeTillBreakdown: number; // seconds until next breakdown
  repairDurationSec: number;
}

/**
 * Models a single work center / production line with stochastic behavior.
 */
export class SimulatedWorkCenter {
  readonly config: WorkCenterConfig;
  private rng: SeededRandom;

  constructor(config: WorkCenterConfig, seed: number) {
    this.config = config;
    this.rng = new SeededRandom(seed);
  }

  /**
   * Generate a single production cycle result.
   * Cycle time follows a normal distribution around the ideal cycle time
   * with variance determined by speedVariancePct.
   */
  produceCycle(): CycleResult {
    // Cycle time with normal variance
    const stdDev = this.config.idealCycleTimeSec * (this.config.speedVariancePct / 100);
    let cycleDuration = normal(this.rng, this.config.idealCycleTimeSec, stdDev);
    // Cycle time cannot be negative
    cycleDuration = Math.max(cycleDuration, this.config.idealCycleTimeSec * 0.1);

    // Reject check (Bernoulli)
    const isReject = this.rng.next() < this.config.rejectRate;

    // Quality measurements
    const qualityMeasurements: Record<string, number> = {};
    for (const [param, spec] of Object.entries(this.config.qualityParams)) {
      qualityMeasurements[param] = normal(this.rng, spec.mean, spec.std);
    }

    return { cycleDurationSec: cycleDuration, isReject, qualityMeasurements };
  }

  /**
   * Determine the next breakdown timing and repair duration.
   * Time-between-failures uses Weibull (shape=1 => exponential, typical for random failures).
   * Repair duration uses log-normal distribution.
   */
  nextBreakdown(): BreakdownResult {
    const mtbfSeconds = this.config.breakdownMtbfHours * 3600;
    // Weibull with shape=1 is exponential (memoryless), scale=MTBF
    const timeTillBreakdown = weibull(this.rng, 1, mtbfSeconds);

    // Repair time: log-normal based on MTTR parameters
    // Convert minutes to seconds for the result
    const { mean, std } = this.config.breakdownMttrMin;
    // For log-normal, we need to convert the desired mean/std in minutes
    // to the underlying normal parameters (mu, sigma)
    const variance = std * std;
    const mu = Math.log((mean * mean) / Math.sqrt(variance + mean * mean));
    const sigma = Math.sqrt(Math.log(1 + variance / (mean * mean)));
    const repairMinutes = logNormal(this.rng, mu, sigma);
    const repairDurationSec = Math.max(repairMinutes * 60, 60); // at least 1 minute

    return { timeTillBreakdown, repairDurationSec };
  }

  /**
   * Check if a minor stop occurs (based on rate per hour).
   * @param intervalSec - the time window in seconds to check for minor stops
   * @returns true if a minor stop occurs in this interval
   */
  checkMinorStop(intervalSec: number): boolean {
    const ratePerSec = this.config.minorStopRatePerHour / 3600;
    const probability = 1 - Math.exp(-ratePerSec * intervalSec);
    return this.rng.next() < probability;
  }
}
