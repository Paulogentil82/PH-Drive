import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TripsView } from './TripsView';
import { MapView } from '../map/MapView';

const mocks = vi.hoisted(() => ({ user: { id: 'user-a' }, vehicles: [] as any[], trips: [] as any[] }));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('../../lib/supabase', () => ({ supabase: { from: (table: string) => {
  const query = {
    abortSignal: () => query, select: () => query, eq: () => query, order: () => query,
    then: (resolve: any, reject: any) => Promise.resolve({ data: table === 'vehicles' ? mocks.vehicles : mocks.trips, error: null }).then(resolve, reject),
  };
  return query;
} } }));
vi.mock('./tripPointsService', () => ({ listTripPoints: vi.fn().mockResolvedValue([]) }));
vi.mock('../../components/common/TripMap', () => ({ TripMap: () => <div>map placeholder</div> }));
vi.mock('./StartTripModal', () => ({ StartTripModal: () => null }));
vi.mock('./EndTripModal', () => ({ EndTripModal: () => null }));
vi.mock('./TripDetailModal', () => ({ TripDetailModal: () => null }));

describe('distance presentation without changing trip operations or vehicle filters', () => {
  let root: Root, container: HTMLDivElement;
  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    mocks.vehicles = [{ id: 'titan', name: 'Titan' }, { id: 'verona', name: 'Verona' }];
    mocks.trips = [
      { id: 'gps', vehicle_id: 'titan', status: 'COMPLETED', started_at: '2026-11-01T12:00:00Z', distance_km: 100, gps_distance_km: 22.5, vehicle: mocks.vehicles[0] },
      { id: 'odo', vehicle_id: 'verona', status: 'IN_PROGRESS', started_at: '2026-11-01T12:00:00Z', distance_km: 8, gps_distance_km: 0, vehicle: mocks.vehicles[1] },
      { id: 'cancelled', vehicle_id: 'titan', status: 'CANCELLED', started_at: '2026-11-01T12:00:00Z', distance_km: null, gps_distance_km: null, vehicle: mocks.vehicles[0] },
    ];
    container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
  it('history shows GPS/fallback/zero and retains the three statuses', async () => {
    await act(async () => root.render(<TripsView />));
    const text = container.querySelector('tbody')!.textContent!;
    expect(text).toContain('22.5 km'); expect(text).toContain('8 km'); expect(text).toContain('0 km');
    expect(text).toContain('Concluída'); expect(text).toContain('Em Andamento'); expect(text).toContain('Cancelada');
  });
  it('history vehicle filter does not mix Titan with Verona', async () => {
    await act(async () => root.render(<TripsView />));
    await act(async () => { const select = container.querySelector('select')!; select.value = 'verona'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(container.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(container.querySelector('tbody')!.textContent).toContain('Verona');
    expect(container.querySelector('tbody')!.textContent).not.toContain('22.5 km');
  });
  it('map selector uses effective distance while keeping separate GPS/odometer values', async () => {
    await act(async () => root.render(<MapView />));
    const selector = container.querySelectorAll('select')[1];
    expect(selector.options[0].text).toContain('22.5 km');
    expect(container.textContent).toContain('Distância Odômetro100 km');
    expect(container.textContent).toContain('Distância GPS22.5 km');
  });
});
