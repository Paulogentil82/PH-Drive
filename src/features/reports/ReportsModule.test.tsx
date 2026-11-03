import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReportsModule } from './ReportsModule';
import { reportsService } from './reportsService';
import type { ReportData } from '../../types/reports';
import type { Vehicle } from '../../types';

vi.mock('./reportsService', () => ({ reportsService: { getConsolidatedData: vi.fn() } }));
vi.mock('recharts', () => {
  const Wrapper = ({ children }: any) => <div>{children}</div>;
  return Object.fromEntries(['PieChart', 'Pie', 'Cell', 'ResponsiveContainer', 'Tooltip', 'Legend', 'BarChart', 'Bar', 'XAxis', 'YAxis', 'CartesianGrid'].map(key => [key, Wrapper]));
});
const data = (vehicleId: string, days?: number, km = 10): ReportData => ({
  vehicleId, days, consolidated: [], fuel: [], maintenance: [], expenses: [],
  trips: [{ id: vehicleId, vehicle_id: vehicleId, status: 'COMPLETED', started_at: '2026-11-01T12:00:00Z', ended_at: null, gps_distance_km: km }] as any,
});
const vehicle = (id: string) => ({ id, name: id } as Vehicle);

describe('reports UI scope and empty financial state', () => {
  let root: Root, container: HTMLDivElement;
  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    vi.resetAllMocks(); container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
  it('shows trips even when no expenses exist and uses a dash if distance is zero', async () => {
    vi.mocked(reportsService.getConsolidatedData).mockResolvedValue(data('Titan', undefined, 0));
    await act(async () => root.render(<ReportsModule vehicle={vehicle('Titan')} />));
    expect(container.textContent).toContain('Distância (Km)');
    expect(container.textContent).toContain('—');
    expect(container.textContent).not.toMatch(/NaN|Infinity|Não há dados suficientes/);
  });
  it('ignores a late Titan response after switching to Verona', async () => {
    let resolveTitan!: (value: ReportData) => void;
    vi.mocked(reportsService.getConsolidatedData).mockImplementation(id => id === 'Titan' ? new Promise(resolve => { resolveTitan = resolve; }) : Promise.resolve(data('Verona', undefined, 22)));
    await act(async () => root.render(<ReportsModule vehicle={vehicle('Titan')} />));
    await act(async () => root.render(<ReportsModule vehicle={vehicle('Verona')} />));
    await act(async () => resolveTitan(data('Titan', undefined, 999)));
    expect(container.textContent).toContain('Relatórios — Verona');
    expect(container.textContent).toContain('percorreu 22 km');
    expect(container.textContent).not.toContain('999');
  });
  it('requests the selected 30-day period and updates displayed metrics', async () => {
    let resolveAll!: (value: ReportData) => void;
    vi.mocked(reportsService.getConsolidatedData).mockImplementation((id, days) => days === undefined ? new Promise(resolve => { resolveAll = resolve; }) : Promise.resolve(data(id, days, 30)));
    await act(async () => root.render(<ReportsModule vehicle={vehicle('Titan')} />));
    await act(async () => resolveAll(data('Titan', undefined, 999)));
    await act(async () => { const select = container.querySelector('select')!; select.value = '30'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(reportsService.getConsolidatedData).toHaveBeenLastCalledWith('Titan', 30);
    expect(container.textContent).toContain('percorreu 30 km');
  });
  it('clears an old error when retry succeeds', async () => {
    vi.mocked(reportsService.getConsolidatedData).mockRejectedValueOnce(new Error('offline')).mockResolvedValue(data('Titan'));
    await act(async () => root.render(<ReportsModule vehicle={vehicle('Titan')} />));
    expect(container.textContent).toContain('offline');
    await act(async () => container.querySelector('button')!.click());
    expect(container.textContent).toContain('Relatórios — Titan'); expect(container.textContent).not.toContain('offline');
  });
});
