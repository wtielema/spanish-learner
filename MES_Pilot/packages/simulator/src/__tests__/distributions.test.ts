import { describe, it, expect } from 'vitest';
import {
  SeededRandom,
  normal,
  weibull,
  poisson,
  exponential,
  logNormal,
} from '../distributions.js';

describe('SeededRandom', () => {
  it('produces deterministic sequences from the same seed', () => {
    const rng1 = new SeededRandom(42);
    const rng2 = new SeededRandom(42);

    const seq1 = Array.from({ length: 100 }, () => rng1.next());
    const seq2 = Array.from({ length: 100 }, () => rng2.next());

    expect(seq1).toEqual(seq2);
  });

  it('produces different sequences from different seeds', () => {
    const rng1 = new SeededRandom(42);
    const rng2 = new SeededRandom(99);

    const seq1 = Array.from({ length: 20 }, () => rng1.next());
    const seq2 = Array.from({ length: 20 }, () => rng2.next());

    expect(seq1).not.toEqual(seq2);
  });

  it('produces values in [0, 1)', () => {
    const rng = new SeededRandom(12345);
    for (let i = 0; i < 10000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('normal distribution', () => {
  it('converges to the specified mean and std over many samples', () => {
    const rng = new SeededRandom(42);
    const targetMean = 100;
    const targetStd = 15;
    const n = 10000;

    const samples = Array.from({ length: n }, () => normal(rng, targetMean, targetStd));

    const mean = samples.reduce((a, b) => a + b, 0) / n;
    const variance = samples.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
    const std = Math.sqrt(variance);

    // Allow 2% tolerance for mean and 5% for std
    expect(mean).toBeCloseTo(targetMean, 0);
    expect(Math.abs(mean - targetMean)).toBeLessThan(targetMean * 0.02);
    expect(Math.abs(std - targetStd)).toBeLessThan(targetStd * 0.05);
  });
});

describe('weibull distribution', () => {
  it('produces only positive values', () => {
    const rng = new SeededRandom(42);
    for (let i = 0; i < 1000; i++) {
      const v = weibull(rng, 1.5, 100);
      expect(v).toBeGreaterThan(0);
    }
  });

  it('with shape=1 approximates exponential distribution', () => {
    const rng = new SeededRandom(42);
    const scale = 50;
    const n = 10000;

    const samples = Array.from({ length: n }, () => weibull(rng, 1, scale));
    const mean = samples.reduce((a, b) => a + b, 0) / n;

    // For exponential (Weibull shape=1), mean should equal scale
    expect(Math.abs(mean - scale)).toBeLessThan(scale * 0.05);
  });
});

describe('poisson distribution', () => {
  it('produces non-negative integers', () => {
    const rng = new SeededRandom(42);
    for (let i = 0; i < 1000; i++) {
      const v = poisson(rng, 5);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it('has mean approximately equal to lambda', () => {
    const rng = new SeededRandom(42);
    const lambda = 7;
    const n = 10000;

    const samples = Array.from({ length: n }, () => poisson(rng, lambda));
    const mean = samples.reduce((a, b) => a + b, 0) / n;

    expect(Math.abs(mean - lambda)).toBeLessThan(lambda * 0.05);
  });

  it('returns 0 for lambda <= 0', () => {
    const rng = new SeededRandom(42);
    expect(poisson(rng, 0)).toBe(0);
    expect(poisson(rng, -1)).toBe(0);
  });
});

describe('exponential distribution', () => {
  it('produces positive values', () => {
    const rng = new SeededRandom(42);
    for (let i = 0; i < 1000; i++) {
      const v = exponential(rng, 2);
      expect(v).toBeGreaterThan(0);
    }
  });

  it('has mean approximately equal to 1/rate', () => {
    const rng = new SeededRandom(42);
    const rate = 0.5;
    const n = 10000;

    const samples = Array.from({ length: n }, () => exponential(rng, rate));
    const mean = samples.reduce((a, b) => a + b, 0) / n;

    expect(Math.abs(mean - 1 / rate)).toBeLessThan((1 / rate) * 0.05);
  });
});

describe('logNormal distribution', () => {
  it('produces only positive values', () => {
    const rng = new SeededRandom(42);
    for (let i = 0; i < 1000; i++) {
      const v = logNormal(rng, 2, 0.5);
      expect(v).toBeGreaterThan(0);
    }
  });
});
