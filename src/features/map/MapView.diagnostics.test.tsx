import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MapView } from './MapView';
import { TripDetailModal } from '../trips/TripDetailModal';
import { listTripPoints } from '../trips/tripPointsService';

const mocks = vi.hoisted(() => ({ from: vi.fn(), signOut: vi.fn(), dataError: null as any }));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'current-user' }, signOut: mocks.signOut }) }));
vi.mock('../../lib/supabase', () => ({ supabase: { from: mocks.from } }));
vi.mock('../trips/tripPointsService', () => ({ listTripPoints: vi.fn() }));
vi.mock('../../components/common/TripMap', () => ({ TripMap: ({ points }: any) => <div data-testid="route">{points.length ? `Trajeto confirmado: ${points[0].id}` : 'Nenhum ponto GPS registrado'}</div> }));

const trip = (id: string) => ({ id, vehicle_id: 'titan', status: 'COMPLETED', started_at: '2026-11-01T12:00:00Z', start_odometer_km: 1000, end_odometer_km: null, distance_km: null, gps_distance_km: null, vehicle: { name: 'Titan' } }) as any;
const point = (id: string) => ({ id, trip_id: 'trip-a', sequence_number: 0, accuracy_meters: null }) as any;
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }

describe('map and detail distinguish GPS loading, valid empty result, errors and stale responses', () => {
  let container: HTMLDivElement, root: Root;
  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks(); mocks.dataError = null;
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    mocks.from.mockImplementation((table: string) => {
      const query = { select: () => query, eq: () => query, order: () => query, abortSignal: () => query,
        then: (resolve: any, reject: any) => Promise.resolve({
          data: table === 'vehicles' ? [{ id: 'titan', name: 'Titan' }] : [trip('trip-a'), trip('trip-b')], error: mocks.dataError,
        }).then(resolve, reject) };
      return query;
    });
    vi.mocked(listTripPoints).mockReset().mockResolvedValue([]);
    container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); });
  async function mount() { await act(async () => root.render(<MapView />)); }
  async function click(label: string) {
    const button = [...container.querySelectorAll('button')].find(el => el.textContent?.trim() === label)!;
    expect(button).toBeDefined(); await act(async () => button.click());
  }
  async function selectTrip(id: string) { await act(async () => {
    const select = container.querySelectorAll('select')[1]; select.value = id; select.dispatchEvent(new Event('change', { bubbles: true }));
  }); }

  it('LOADING shows loading route and unknown point count, not an empty GPS route', async () => {
    const pending = deferred<any[]>(); vi.mocked(listTripPoints).mockReturnValue(pending.promise);
    await mount();
    expect(container.textContent).toContain('Carregando trajeto...');
    expect(container.textContent).not.toContain('Nenhum ponto GPS registrado');
    expect(container.textContent).not.toContain('0 pontos');
    await act(async () => pending.resolve([point('point-a')]));
    expect(container.textContent).toContain('Trajeto confirmado: point-a');
    expect(container.textContent).toContain('1 pontos');
  });
  it('SUCCESS_EMPTY shows the explicit empty GPS state only after a successful read', async () => {
    await mount(); expect(container.textContent).toContain('Nenhum ponto GPS registrado');
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });
  it('ERROR shows backend failure instead of an empty route; retry reloads only points', async () => {
    vi.mocked(listTripPoints).mockRejectedValueOnce(new TypeError('network private details')).mockResolvedValue([point('recovered')]);
    await mount();
    expect(container.textContent).toContain('Não foi possível carregar os pontos GPS');
    expect(container.textContent).not.toContain('Nenhum ponto GPS registrado');
    expect(container.textContent).not.toContain('network private details');
    const dataCalls = mocks.from.mock.calls.length;
    await click('Tentar novamente');
    expect(listTripPoints).toHaveBeenCalledTimes(2); expect(mocks.from).toHaveBeenCalledTimes(dataCalls);
    expect(container.textContent).toContain('Trajeto confirmado: recovered');
  });
  it.each([401, 403])('HTTP %s shows auth/permission message; 401 reuses existing signOut/login flow', async status => {
    vi.mocked(listTripPoints).mockRejectedValue({ status }); await mount();
    expect(container.textContent).toContain(status === 401 ? 'Sua sessão não é válida' : 'não tem permissão');
    if (status === 401) { await click('Entrar novamente'); expect(mocks.signOut).toHaveBeenCalledTimes(1); }
    else expect(container.textContent).not.toContain('Entrar novamente');
  });
  it('old success after trip change cannot overwrite the new trip route', async () => {
    const old = deferred<any[]>(); vi.mocked(listTripPoints).mockReturnValueOnce(old.promise).mockResolvedValueOnce([point('current-trip-point')]);
    await mount(); await selectTrip('trip-b');
    await act(async () => old.resolve([point('obsolete-private-point')]));
    expect(container.textContent).toContain('current-trip-point'); expect(container.textContent).not.toContain('obsolete-private-point');
  });
  it('old failure after trip change cannot replace current success', async () => {
    const old = deferred<any[]>(); vi.mocked(listTripPoints).mockReturnValueOnce(old.promise).mockResolvedValueOnce([point('current')]);
    await mount(); await selectTrip('trip-b'); await act(async () => old.reject({ status: 401 }));
    expect(container.textContent).toContain('Trajeto confirmado: current'); expect(container.querySelector('[role="alert"]')).toBeNull();
  });
  it('metadata read failure is an error instead of no trips', async () => {
    mocks.dataError = { status: 403 }; await mount();
    expect(container.textContent).toContain('não tem permissão'); expect(container.textContent).not.toContain('Nenhuma viagem registrada');
  });
  it('detail modal also exposes error/retry and ignores results after close/reopen for another trip', async () => {
    vi.mocked(listTripPoints).mockRejectedValueOnce({ status: 403 });
    await act(async () => root.render(<TripDetailModal isOpen trip={trip('trip-a')} onClose={() => {}} />));
    expect(container.textContent).toContain('Não foi possível carregar os pontos GPS');
    vi.mocked(listTripPoints).mockResolvedValueOnce([point('retry-detail')]); await click('Tentar novamente');
    expect(container.textContent).toContain('retry-detail');
    const old = deferred<any[]>(); vi.mocked(listTripPoints).mockReturnValueOnce(old.promise);
    await act(async () => root.render(<TripDetailModal isOpen trip={trip('trip-b')} onClose={() => {}} />));
    await act(async () => root.render(<TripDetailModal isOpen={false} trip={null} onClose={() => {}} />));
    vi.mocked(listTripPoints).mockResolvedValueOnce([]);
    await act(async () => root.render(<TripDetailModal isOpen trip={trip('trip-a')} onClose={() => {}} />));
    await act(async () => old.resolve([point('old-closed-modal')]));
    expect(container.textContent).toContain('Nenhum ponto GPS registrado'); expect(container.textContent).not.toContain('old-closed-modal');
  });
});
