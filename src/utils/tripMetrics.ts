import type { Trip } from '../types';

type DistanceFields = Partial<Pick<Trip, 'gps_distance_km' | 'distance_km'>>;

export function effectiveTripDistance(trip: DistanceFields): number {
  if (Number.isFinite(trip.gps_distance_km) && trip.gps_distance_km! > 0) return trip.gps_distance_km!;
  if (Number.isFinite(trip.distance_km) && trip.distance_km! >= 0) return trip.distance_km!;
  return 0;
}

/** Completed metrics belong to the completion instant, with the real start as fallback. */
export function tripMetricDate(trip: Pick<Trip, 'status' | 'started_at' | 'ended_at'>): string {
  return trip.status === 'COMPLETED' ? (trip.ended_at || trip.started_at) : trip.started_at;
}
