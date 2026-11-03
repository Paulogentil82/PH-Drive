import { describe, expect, it } from 'vitest';
import { effectiveTripDistance, tripMetricDate } from '../tripMetrics';
import { isInPeriod, metricDate, monthKey, periodBounds } from '../metricDates';

describe('shared trip distance and metric dates', () => {
  it('prioritizes GPS without rounding precision', () => {
    expect(effectiveTripDistance({ gps_distance_km: 12.3456789, distance_km: 50 })).toBe(12.3456789);
  });
  it.each([null, undefined, 0, -1, NaN, Infinity])('falls back from unusable GPS %s', gps => {
    expect(effectiveTripDistance({ gps_distance_km: gps, distance_km: 20 })).toBe(20);
  });
  it.each([null, undefined, -1, NaN, Infinity])('returns zero without usable odometer distance %s', distance => {
    expect(effectiveTripDistance({ gps_distance_km: null, distance_km: distance })).toBe(0);
  });
  it('uses completion for COMPLETED and start when completion is absent', () => {
    expect(tripMetricDate({ status: 'COMPLETED', started_at: '2026-10-31', ended_at: '2026-11-01' })).toBe('2026-11-01');
    expect(tripMetricDate({ status: 'COMPLETED', started_at: '2026-10-31', ended_at: null })).toBe('2026-10-31');
  });
  it.each(['IN_PROGRESS', 'CANCELLED'] as const)('preserves the real start date for %s', status => {
    expect(tripMetricDate({ status, started_at: '2026-10-31', ended_at: '2026-11-01' })).toBe('2026-10-31');
  });
  it('preserves a civil date serialized at UTC midnight', () => {
    expect(monthKey('2026-11-01T00:00:00Z', true)).toBe('2026-11');
    expect(metricDate('2026-11-01', true)?.getDate()).toBe(1);
  });
  it('groups trip instants using local time even when UTC falls in another month', () => {
    const local = new Date(2026, 9, 31, 23, 30);
    expect(monthKey(local.toISOString())).toBe('2026-10');
  });
  it('includes both boundary dates and excludes earlier/future civil days', () => {
    const now = new Date(2026, 10, 15, 12);
    expect(periodBounds(30, now).civilStart).toBe('2026-10-17');
    expect(isInPeriod('2026-10-17', 30, now, true)).toBe(true);
    expect(isInPeriod('2026-11-15', 30, now, true)).toBe(true);
    expect(isInPeriod('2026-10-16', 30, now, true)).toBe(false);
    expect(isInPeriod('2026-11-16', 30, now, true)).toBe(false);
  });
  it('handles leap days and invalid dates without NaN groups', () => {
    expect(monthKey('2024-02-29', true)).toBe('2024-02');
    expect(monthKey('2026-02-29', true)).toBeNull();
    expect(monthKey('not-a-date')).toBeNull();
  });
});
