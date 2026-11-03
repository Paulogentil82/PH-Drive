import { useEffect, useState } from 'react';
import { TripPoint } from '../../types';
import { BackendErrorInfo, classifyBackendError } from '../../lib/backendDiagnostics';
import { listTripPoints } from './tripPointsService';

export type TripPointsState = {
  status: 'IDLE' | 'LOADING' | 'SUCCESS_WITH_POINTS' | 'SUCCESS_EMPTY' | 'ERROR';
  points: TripPoint[];
  error: BackendErrorInfo | null;
};
const idle: TripPointsState = { status: 'IDLE', points: [], error: null };

export function useTripPoints(tripId: string | null, userId?: string) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string | null; attempt: number; state: TripPointsState }>({ key: null, attempt: 0, state: idle });
  const key = tripId ? `${userId ?? ''}:${tripId}` : null;
  useEffect(() => {
    let cancelled = false;
    if (!tripId) return;
    setResult({ key, attempt, state: { status: 'LOADING', points: [], error: null } });
    listTripPoints(tripId).then(points => {
      if (!cancelled) setResult({ key, attempt, state: {
        status: points.length ? 'SUCCESS_WITH_POINTS' : 'SUCCESS_EMPTY', points, error: null,
      } });
    }).catch(error => {
      if (!cancelled) setResult({ key, attempt, state: { status: 'ERROR', points: [], error: classifyBackendError(error) } });
    });
    return () => { cancelled = true; };
  }, [tripId, userId, key, attempt]);
  const state = !tripId ? idle : result.key === key && result.attempt === attempt ? result.state
    : { status: 'LOADING' as const, points: [], error: null };
  return { ...state, retry: () => setAttempt(value => value + 1) };
}
