import { describe, it, expect } from 'vitest';
import { haversineDistance, calculateGpsDistance, tripPointSchema, calculateTripComparison } from './tripPointsService';

describe('Haversine & Trip Points Calculations', () => {
  it('calculates distance between two known geographic points correctly', () => {
    // São Paulo (Sé) to Rio de Janeiro (Centro) approx 356-358 km straight line
    const spLat = -23.5505;
    const spLon = -46.6333;
    const rjLat = -22.9068;
    const rjLon = -43.1729;

    const dist = haversineDistance(spLat, spLon, rjLat, rjLon);
    expect(dist).toBeGreaterThan(350);
    expect(dist).toBeLessThan(370);
  });

  it('calculates trip comparison correctly (17 km odometer vs 3.74 km GPS)', () => {
    const result = calculateTripComparison(17.0, 3.74);
    expect(result.hasComparison).toBe(true);
    expect(result.differenceKm).toEqual(13.26);
    expect(result.differencePercent).toEqual(78.0);
  });

  it('returns zero for same point', () => {
    const dist = haversineDistance(-23.55, -46.63, -23.55, -46.63);
    expect(dist).toEqual(0);
  });

  it('calculates total gps distance for an array of points', () => {
    const points = [
      { latitude: -23.5500, longitude: -46.6300 },
      { latitude: -23.5510, longitude: -46.6310 },
      { latitude: -23.5520, longitude: -46.6320 },
    ];
    const total = calculateGpsDistance(points);
    expect(total).toBeGreaterThan(0);
    typeof total === 'number';
  });

  it('validates trip point schema successfully', () => {
    const validPoint = {
      trip_id: '123e4567-e89b-12d3-a456-426614174000',
      latitude: -23.5505,
      longitude: -46.6333,
      accuracy_meters: 5.0,
      speed_kmh: 40.0,
      heading_degrees: 180.0,
      altitude_meters: 750,
      captured_at: new Date().toISOString(),
      sequence_number: 1,
      source: 'MOBILE_GPS' as const,
    };

    const result = tripPointSchema.safeParse(validPoint);
    expect(result.success).toBe(true);
  });

  it('rejects invalid latitude and longitude', () => {
    const invalidPoint = {
      trip_id: '123e4567-e89b-12d3-a456-426614174000',
      latitude: 105.0, // Invalid > 90
      longitude: -46.6333,
      captured_at: new Date().toISOString(),
      sequence_number: 0,
      source: 'MANUAL' as const,
    };

    const result = tripPointSchema.safeParse(invalidPoint);
    expect(result.success).toBe(false);
  });
});
