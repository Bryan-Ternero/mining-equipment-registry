import { describe, expect, it } from 'vitest';
import { cycleProgress, formatHours, parseHours } from './format';

describe('formatHours', () => {
  it('formats with thousands separator and at most one decimal', () => {
    expect(formatHours(1234.5)).toBe('1.234,5 h');
    expect(formatHours(250)).toBe('250 h');
  });
});

describe('cycleProgress', () => {
  it('is the share of the interval used in the current cycle, capped at 100', () => {
    expect(cycleProgress({ hoursSinceService: 125, intervalHours: 250 })).toBe(50);
    expect(cycleProgress({ hoursSinceService: 400, intervalHours: 250 })).toBe(100);
    expect(cycleProgress({ hoursSinceService: 0, intervalHours: 250 })).toBe(0);
  });
});

describe('parseHours', () => {
  it('accepts a decimal comma or point', () => {
    expect(parseHours('120,5')).toBe(120.5);
    expect(parseHours(' 300 ')).toBe(300);
  });

  it('returns null for an empty or non numeric input', () => {
    expect(parseHours('')).toBeNull();
    expect(parseHours('abc')).toBeNull();
  });
});
