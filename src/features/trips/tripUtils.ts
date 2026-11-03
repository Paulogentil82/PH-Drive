import { Trip } from '@/types';
import { OdometerSource, DistanceSource } from '@/types/odometer';
import { effectiveTripDistance } from '../../utils/tripMetrics';

export const getEffectiveTripDistance = (trip: Trip): { distance: number; source: DistanceSource } => {
  const distance = effectiveTripDistance(trip);
  if (Number.isFinite(trip.gps_distance_km) && trip.gps_distance_km! > 0) {
    return { distance, source: 'GPS' };
  }
  if (Number.isFinite(trip.distance_km) && trip.distance_km! >= 0) {
    return { distance, source: 'ODOMETER' };
  }
  
  return { distance, source: 'UNAVAILABLE' };
};

export const getEffectiveEndOdometer = (trip: Trip): { odometer: number | null; source: OdometerSource } => {
  if (trip.end_odometer_km !== null) {
    return { odometer: trip.end_odometer_km, source: 'RECORDED' };
  }
  
  const { distance, source } = getEffectiveTripDistance(trip);
  if (trip.start_odometer_km !== null && source !== 'UNAVAILABLE') {
    return { odometer: trip.start_odometer_km + distance, source: 'GPS_CALCULATED' };
  }
  
  return { odometer: null, source: 'UNAVAILABLE' };
};
