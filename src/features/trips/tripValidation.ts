import { z } from 'zod';

export const startTripSchema = z.object({
  vehicle_id: z.string().min(1, 'Selecione um veículo.'),
  start_odometer_km: z.number().min(0, 'O odômetro não pode ser negativo.'),
  origin_label: z.string().optional(),
  notes: z.string().optional(),
});

export const endTripSchema = z.object({
  end_odometer_km: z.number().min(0, 'O odômetro final não pode ser negativo.'),
  destination_label: z.string().optional(),
  distance_km: z.number().min(0, 'A distância não pode ser negativa.').optional(),
});

export function calculateTripMetrics(startedAt: string, endedAt: string, startOdometer: number | null, endOdometer: number | null) {
  const start = new Date(startedAt).getTime();
  const end = new Date(endedAt).getTime();
  const durationSeconds = Math.max(0, Math.floor((end - start) / 1000));
  
  let distanceKm = 0;
  if (startOdometer !== null && endOdometer !== null && endOdometer >= startOdometer) {
    distanceKm = Number((endOdometer - startOdometer).toFixed(2));
  }

  return {
    durationSeconds,
    distanceKm,
  };
}
