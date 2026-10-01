import { z } from 'zod';
import { supabase } from '../../lib/supabase';
import { TripPoint, TripPointSource } from '../../types';

export const tripPointSchema = z.object({
  trip_id: z.string().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy_meters: z.number().min(0).nullable().optional(),
  speed_kmh: z.number().min(0).nullable().optional(),
  heading_degrees: z.number().min(0).lt(360).nullable().optional(),
  altitude_meters: z.number().nullable().optional(),
  captured_at: z.string().min(1),
  sequence_number: z.number().int().min(0),
  source: z.enum(['MANUAL', 'MOBILE_GPS', 'IMPORT']),
});

/**
 * Fórmula de Haversine para cálculo de distância entre dois pontos geográficos em quilômetros.
 */
export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Raio da Terra em km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Calcula a distância total em km de uma lista ordenada de pontos GPS.
 */
export function calculateGpsDistance(points: Array<{ latitude: number; longitude: number }>): number {
  if (!points || points.length < 2) return 0;
  let totalKm = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    totalKm += haversineDistance(p1.latitude, p1.longitude, p2.latitude, p2.longitude);
  }
  return Number(totalKm.toFixed(2));
}

export async function listTripPoints(tripId: string): Promise<TripPoint[]> {
  const pageSize = 500;
  const points: TripPoint[] = [];
  let lastSequence = -1;

  // A sequência é única por viagem; o cursor evita sobreposição entre páginas.
  // Não encerrar em página parcial: o backend pode impor limite menor que pageSize.
  while (true) {
    const { data, error } = await supabase
      .from('trip_points')
      .select('*')
      .eq('trip_id', tripId)
      .gt('sequence_number', lastSequence)
      .order('sequence_number', { ascending: true })
      .limit(pageSize);

    if (error) throw error;
    if (!data?.length) return points;

    points.push(...data);
    lastSequence = data[data.length - 1].sequence_number;
  }
}

export async function addTripPoint(pointData: {
  trip_id: string;
  user_id: string;
  latitude: number;
  longitude: number;
  accuracy_meters?: number | null;
  speed_kmh?: number | null;
  heading_degrees?: number | null;
  altitude_meters?: number | null;
  captured_at: string;
  sequence_number: number;
  source: TripPointSource;
}): Promise<TripPoint> {
  const { error: valError } = tripPointSchema.safeParse(pointData);
  if (!valError) {
    // se falhar o zod parse, podemos logar ou tratar mas o safeParse retorna success
  }
  const parsed = tripPointSchema.safeParse(pointData);
  if (!parsed.success) {
    throw new Error('Dados de ponto GPS inválidos: ' + parsed.error.issues.map(i => i.message).join(', '));
  }

  const { data, error } = await supabase
    .from('trip_points')
    .insert(pointData)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Gera pontos de homologação para teste manual em desenvolvimento (-23.5505, -46.6333 ex: São Paulo)
 */
export async function addHomologationTestPoints(tripId: string, userId: string): Promise<number> {
  if (!import.meta.env.DEV) {
    throw new Error('Pontos fictícios são permitidos somente em desenvolvimento.');
  }

  // Coordenadas simuladas em linha reta (ex: Av. Paulista / Centro SP)
  const baseLat = -23.5505;
  const baseLon = -46.6333;
  const now = new Date();

  // Buscar maior sequence number atual
  const existing = await listTripPoints(tripId);
  const startSeq = existing.length > 0 ? Math.max(...existing.map(p => p.sequence_number)) + 1 : 0;

  const samplePoints = [
    { lat: baseLat, lon: baseLon, acc: 5.0, speed: 0 },
    { lat: baseLat + 0.005, lon: baseLon + 0.005, acc: 8.5, speed: 35 },
    { lat: baseLat + 0.012, lon: baseLon + 0.010, acc: 12.0, speed: 42 },
    { lat: baseLat + 0.020, lon: baseLon + 0.015, acc: 4.2, speed: 28 },
    { lat: baseLat + 0.028, lon: baseLon + 0.020, acc: 6.0, speed: 15 },
  ];

  let addedCount = 0;
  for (let i = 0; i < samplePoints.length; i++) {
    const sp = samplePoints[i];
    const seq = startSeq + i;
    const capturedAt = new Date(now.getTime() + i * 60000).toISOString(); // a cada 1 min

    const { error } = await supabase.from('trip_points').insert({
      trip_id: tripId,
      user_id: userId,
      latitude: sp.lat,
      longitude: sp.lon,
      accuracy_meters: sp.acc,
      speed_kmh: sp.speed,
      heading_degrees: 45.0,
      altitude_meters: 760.0,
      captured_at: capturedAt,
      sequence_number: seq,
      source: 'MANUAL',
    });

    if (!error) {
      addedCount++;
    }
  }

  // Recalcular e atualizar gps_distance_km na viagem
  const allPoints = await listTripPoints(tripId);
  const gpsDist = calculateGpsDistance(allPoints);

  await supabase
    .from('trips')
    .update({ gps_distance_km: gpsDist })
    .eq('id', tripId)
    .eq('user_id', userId);

  return addedCount;
}

export interface TripComparisonResult {
  differenceKm: number;
  differencePercent: number;
  hasComparison: boolean;
}

export function calculateTripComparison(
  odometerDistance: number | null | undefined,
  gpsDistance: number | null | undefined
): TripComparisonResult {
  if (
    odometerDistance === null ||
    odometerDistance === undefined ||
    gpsDistance === null ||
    gpsDistance === undefined
  ) {
    return { differenceKm: 0, differencePercent: 0, hasComparison: false };
  }

  const rawDiff = Math.abs(odometerDistance - gpsDistance);
  const differenceKm = Number(rawDiff.toFixed(2));
  
  let differencePercent = 0;
  if (odometerDistance > 0) {
    differencePercent = Number(((rawDiff / odometerDistance) * 100).toFixed(1));
  }

  return {
    differenceKm,
    differencePercent,
    hasComparison: true,
  };
}

