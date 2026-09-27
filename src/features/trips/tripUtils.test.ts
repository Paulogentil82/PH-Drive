import { describe, it, expect } from 'vitest';
import { getEffectiveEndOdometer } from './tripUtils';
import { Trip } from '@/types';

describe('tripUtils', () => {
  it('A. calculates end odometer from start and gps', () => {
    const trip = { start_odometer_km: 12304, gps_distance_km: 14.375, end_odometer_km: null } as Trip;
    const { odometer } = getEffectiveEndOdometer(trip);
    expect(odometer).toBe(12318.375);
  });

  it('B. prefers recorded end odometer', () => {
    const trip = { start_odometer_km: 12304, gps_distance_km: 14.375, end_odometer_km: 12320 } as Trip;
    const { odometer, source } = getEffectiveEndOdometer(trip);
    expect(odometer).toBe(12320);
    expect(source).toBe('RECORDED');
  });

  it('C. calculates end odometer from start and distance_km', () => {
    const trip = { start_odometer_km: 12304, gps_distance_km: null, distance_km: 10, end_odometer_km: null } as Trip;
    const { odometer } = getEffectiveEndOdometer(trip);
    expect(odometer).toBe(12314);
  });

  it('D. returns null if no distance available', () => {
    const trip = { start_odometer_km: 12304, gps_distance_km: null, distance_km: null, end_odometer_km: null } as Trip;
    const { odometer } = getEffectiveEndOdometer(trip);
    expect(odometer).toBeNull();
  });
});
