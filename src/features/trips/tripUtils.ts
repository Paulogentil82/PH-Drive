import { Trip } from '@/types';
import { OdometerSource, DistanceSource } from '@/types/odometer';
import { haversineDistance } from './tripPointsService';

export const getEffectiveTripDistance = (trip: Trip): { distance: number | null; source: DistanceSource } => {
  if (trip.gps_distance_km != null && trip.gps_distance_km > 0) {
    return { distance: trip.gps_distance_km as number, source: 'GPS' };
  }
  if (trip.distance_km != null && trip.distance_km >= 0) {
    return { distance: trip.distance_km, source: 'ODOMETER' };
  }
  
  if (trip.trip_points && trip.trip_points.length >= 2) {
    let haversineDist = 0;
    for (let i = 0; i < trip.trip_points.length - 1; i++) {
        haversineDist += haversineDistance(
            trip.trip_points[i].latitude,
            trip.trip_points[i].longitude,
            trip.trip_points[i + 1].latitude,
            trip.trip_points[i + 1].longitude
        );
    }
    return { distance: haversineDist, source: 'HAVERSINE' };
  }
  
  return { distance: null, source: 'UNAVAILABLE' };
};

export const getEffectiveEndOdometer = (trip: Trip): { odometer: number | null; source: OdometerSource } => {
  if (trip.end_odometer_km !== null) {
    return { odometer: trip.end_odometer_km, source: 'RECORDED' };
  }
  
  const { distance } = getEffectiveTripDistance(trip);
  if (trip.start_odometer_km !== null && distance !== null) {
    return { odometer: trip.start_odometer_km + distance, source: 'GPS_CALCULATED' };
  }
  
  return { odometer: null, source: 'UNAVAILABLE' };
};
