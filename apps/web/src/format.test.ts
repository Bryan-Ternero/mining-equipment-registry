import { describe, expect, it } from 'vitest';
import { cycleProgress, formatHours, fromLocalInput, parseHours, toLocalInput } from './format';

describe('date and time input', () => {
  it('fills the input with the local date and time, to the minute', () => {
    const date = new Date(2026, 10, 8, 9, 5, 42);
    expect(toLocalInput(date)).toBe('2026-11-08T09:05');
  });

  it('turns the input back into an ISO instant, and rejects an empty or invalid value', () => {
    expect(fromLocalInput('2026-11-08T09:05')).toBe(new Date(2026, 10, 8, 9, 5).toISOString());
    expect(fromLocalInput('')).toBeNull();
    expect(fromLocalInput('nope')).toBeNull();
  });
});

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

  it('accepts the same format the app displays, with a thousands separator', () => {
    expect(parseHours('1.234,5')).toBe(1234.5);
    expect(parseHours('12.000')).toBe(12000);
  });

  it('returns null for an empty or non numeric input', () => {
    expect(parseHours('')).toBeNull();
    expect(parseHours('abc')).toBeNull();
  });
});
