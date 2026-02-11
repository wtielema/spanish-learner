/**
 * Seeded PRNG and statistical distribution functions for deterministic simulation.
 */

/**
 * Mulberry32 seeded PRNG. Produces deterministic sequences from a given seed.
 */
export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed | 0;
  }

  /**
   * Returns a pseudo-random float in [0, 1).
   */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

/**
 * Normal (Gaussian) distribution using Box-Muller transform.
 */
export function normal(rng: SeededRandom, mean: number, std: number): number {
  const u1 = rng.next();
  const u2 = rng.next();
  // Avoid log(0)
  const safeU1 = u1 === 0 ? Number.EPSILON : u1;
  const z = Math.sqrt(-2 * Math.log(safeU1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * std;
}

/**
 * Weibull distribution for time-between-failures modeling.
 * CDF inverse: x = scale * (-ln(1-u))^(1/shape)
 */
export function weibull(rng: SeededRandom, shape: number, scale: number): number {
  const u = rng.next();
  const safeU = u === 0 ? Number.EPSILON : u;
  return scale * Math.pow(-Math.log(safeU), 1 / shape);
}

/**
 * Poisson distribution for event counts.
 * Uses Knuth's algorithm (suitable for small lambda).
 */
export function poisson(rng: SeededRandom, lambda: number): number {
  if (lambda <= 0) return 0;
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rng.next();
  } while (p > L);
  return k - 1;
}

/**
 * Exponential distribution for inter-arrival times.
 */
export function exponential(rng: SeededRandom, rate: number): number {
  const u = rng.next();
  const safeU = u === 0 ? Number.EPSILON : u;
  return -Math.log(safeU) / rate;
}

/**
 * Log-normal distribution for repair times.
 * If X ~ Normal(mu, sigma), then e^X ~ LogNormal.
 * Parameters are the mean and std of the underlying normal distribution.
 */
export function logNormal(rng: SeededRandom, mean: number, std: number): number {
  return Math.exp(normal(rng, mean, std));
}
