import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { Vehicle } from './types';

const mocks = vi.hoisted(() => ({
  user: { id: 'user-a' },
  query: vi.fn(),
  from: vi.fn(),
  modules: { fuel: vi.fn(), maintenance: vi.fn(), expenses: vi.fn(), documents: vi.fn(), tires: vi.fn(), reports: vi.fn() },
}));
vi.mock('./lib/supabase', () => ({ supabase: { from: mocks.from } }));
vi.mock('./features/auth/AuthContext', () => ({
  AuthProvider: ({ children }: any) => children,
  useAuth: () => ({ user: mocks.user, session: {}, loading: false, isConfigured: true }),
}));
vi.mock('./features/profile/PreferencesContext', () => ({
  PreferencesProvider: ({ children }: any) => children,
  usePreferences: () => ({ preferences: {}, formatDistance: (value: number) => `${value} km` }),
}));
vi.mock('./features/alerts/alertsService', () => ({ alertsService: { getAlerts: vi.fn().mockResolvedValue([]) } }));
vi.mock('./layouts/AppLayout', () => ({ AppLayout: ({ children, onSelectTab }: any) => <>
  <nav>{['dashboard', 'vehicles', 'fuel', 'maintenance', 'expenses', 'documents', 'tires', 'reports'].map(tab =>
    <button key={tab} onClick={() => onSelectTab(tab)}>{tab}</button>)}</nav>{children}
</> }));
vi.mock('./features/dashboard/DashboardView', () => ({ DashboardView: () => <div>dashboard content</div> }));
vi.mock('./features/vehicles/VehicleList', () => ({ VehicleList: () => <div>vehicle management</div> }));
vi.mock('./features/trips/TripsView', () => ({ TripsView: () => null }));
vi.mock('./features/map/MapView', () => ({ MapView: () => null }));
vi.mock('./features/profile/ProfileView', () => ({ ProfileView: () => null }));
vi.mock('./features/alerts/AlertsModule', () => ({ AlertsModule: () => null }));
vi.mock('./features/auth/LoginPage', () => ({ LoginPage: () => null }));
vi.mock('./features/auth/SupabaseSetupModal', () => ({ SupabaseSetupModal: () => null }));
vi.mock('./features/fuel/FuelModule', () => ({ FuelModule: (props: any) => {
  mocks.modules.fuel(props); return <output data-module="fuel">{props.vehicleId}</output>;
} }));
vi.mock('./features/maintenance/MaintenanceModule', () => ({ MaintenanceModule: (props: any) => {
  mocks.modules.maintenance(props); return <output data-module="maintenance">{props.vehicle.name}</output>;
} }));
vi.mock('./features/expenses/VehicleExpensesModule', () => ({ VehicleExpensesModule: (props: any) => {
  mocks.modules.expenses(props); return <output data-module="expenses">{props.vehicle.name}</output>;
} }));
vi.mock('./features/documents/DocumentsModule', () => ({ DocumentsModule: (props: any) => {
  mocks.modules.documents(props); return <output data-module="documents">{props.vehicle.name}</output>;
} }));
vi.mock('./features/tires/TiresModule', () => ({ TiresModule: (props: any) => {
  mocks.modules.tires(props); return <output data-module="tires">{props.vehicle.name}</output>;
} }));
vi.mock('./features/reports/ReportsModule', () => ({ ReportsModule: (props: any) => {
  mocks.modules.reports(props); return <output data-module="reports">{props.vehicle.name}</output>;
} }));

const titan: Vehicle = {
  id: 'titan-id', user_id: 'user-a', name: 'Titan 125', type: 'MOTORCYCLE', brand: 'Honda', model: 'CG',
  year: 2005, license_plate: 'ABC1234', odometer_km: 12000, version: null, fuel_type: null,
  tank_capacity_liters: null, average_consumption_km_l: null, image_url: null, bluetooth_name: null,
  active: true, created_at: '', updated_at: '',
};
const verona: Vehicle = { ...titan, id: 'verona-id', name: 'Verona', brand: 'Ford', model: 'Verona', type: 'CAR', license_plate: null };

describe('Vehicle selection in the six existing modules', () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    mocks.user = { id: 'user-a' };
    mocks.query.mockResolvedValue({ data: [titan, verona], error: null });
    mocks.from.mockReturnValue({ select: () => ({ eq: mocks.query }) });
    container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
  async function mount() { await act(async () => root.render(<App />)); }
  async function click(label: string) {
    const button = Array.from(container.querySelectorAll('button')).find(button =>
      button.textContent?.trim() === label || button.getAttribute('aria-label') === label);
    expect(button, `Button ${label}`).toBeDefined();
    await act(async () => button!.click());
  }
  const output = () => container.querySelector('output');

  it('zero vehicles shows the empty state and navigates to vehicle management', async () => {
    mocks.query.mockResolvedValue({ data: [], error: null });
    await mount(); await click('fuel');
    expect(container.textContent).toContain('Nenhum veículo cadastrado');
    expect(container.textContent).not.toContain('Em Desenvolvimento');
    await click('IR PARA VEÍCULOS'); expect(container.textContent).toContain('vehicle management');
  });
  it.each(['fuel', 'maintenance', 'expenses', 'documents', 'tires', 'reports'] as const)(
    'one vehicle opens %s directly with its expected prop type', async tab => {
      mocks.query.mockResolvedValue({ data: [titan], error: null });
      await mount(); await click(tab);
      expect(output()?.getAttribute('data-module')).toBe(tab);
      const props = mocks.modules[tab].mock.calls.at(-1)![0];
      expect(props).toEqual(tab === 'fuel' ? { vehicleId: titan.id } : { vehicle: titan });
      expect(container.textContent).not.toContain('Escolha um veículo');
    });
  it.each(['fuel', 'maintenance', 'expenses', 'documents', 'tires', 'reports'] as const)(
    'multiple vehicles use selection and the existing %s module', async tab => {
      await mount(); await click(tab); expect(output()).toBeNull();
      expect(container.textContent).toContain('Escolha um veículo');
      await click('Selecionar Titan 125');
      expect(mocks.modules[tab].mock.calls.at(-1)![0]).toEqual(tab === 'fuel' ? { vehicleId: titan.id } : { vehicle: titan });
      await click('Trocar veículo'); expect(output()).toBeNull();
      await click('Selecionar Verona');
      expect(mocks.modules[tab].mock.calls.at(-1)![0]).toEqual(tab === 'fuel' ? { vehicleId: verona.id } : { vehicle: verona });
    });
  it('cards show identifying details and allow going back', async () => {
    await mount(); await click('fuel');
    expect(container.textContent).toContain('Honda · CG · 2005');
    expect(container.textContent).toContain('Placa: ABC1234');
    expect(container.textContent).toContain('Odômetro: 12000 km');
    await click('Voltar para Visão Geral'); expect(container.textContent).toContain('dashboard content');
  });
  it('selection does not leak into another module or back into the previous module', async () => {
    await mount(); await click('fuel'); await click('Selecionar Titan 125');
    await click('maintenance'); expect(output()).toBeNull();
    await click('Selecionar Verona'); await click('fuel'); expect(output()).toBeNull();
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });
  it('a removed vehicle is invalidated after returning from vehicle management', async () => {
    const third = { ...verona, id: 'third-id', name: 'Terceiro' };
    mocks.query.mockResolvedValue({ data: [titan, verona, third], error: null });
    await mount(); await click('fuel'); await click('Selecionar Titan 125'); await click('vehicles');
    mocks.query.mockResolvedValue({ data: [verona, third], error: null });
    await click('fuel'); expect(output()).toBeNull();
    expect(container.querySelector('[aria-label="Selecionar Titan 125"]')).toBeNull();
    expect(mocks.query).toHaveBeenCalledTimes(2);
  });
  it('edited vehicles are reloaded and the module receives the current object', async () => {
    await mount(); await click('maintenance'); await click('Selecionar Titan 125'); await click('vehicles');
    const updated = { ...titan, name: 'Titan atualizada', odometer_km: 12500 };
    mocks.query.mockResolvedValue({ data: [updated, verona], error: null });
    await click('maintenance'); await click('Selecionar Titan atualizada');
    expect(mocks.modules.maintenance.mock.calls.at(-1)![0]).toEqual({ vehicle: updated });
  });
  it('loading is not confused with zero vehicles', async () => {
    let resolve!: (value: any) => void;
    mocks.query.mockReturnValue(new Promise(done => { resolve = done; }));
    await mount(); await click('fuel');
    expect(container.textContent).toContain('Carregando veículos');
    expect(container.textContent).not.toContain('Nenhum veículo cadastrado');
    await act(async () => resolve({ data: [titan], error: null })); expect(output()?.textContent).toBe(titan.id);
  });
  it('remote query errors show retry rather than an empty or development state', async () => {
    mocks.query.mockResolvedValue({ data: null, error: { message: 'failure' } });
    await mount(); await click('fuel'); expect(container.textContent).toContain('Não foi possível carregar');
    expect(container.textContent).not.toContain('Nenhum veículo cadastrado');
    mocks.query.mockResolvedValue({ data: [titan], error: null });
    await click('Tentar novamente'); expect(output()?.textContent).toBe(titan.id);
  });
  it('rejected requests show the same recoverable error state', async () => {
    mocks.query.mockRejectedValue(new Error('network failure'));
    await mount(); await click('fuel'); expect(container.textContent).toContain('Não foi possível carregar');
  });
  it('vehicles and selection from a previous user cannot be used by the new user', async () => {
    await mount(); await click('fuel'); await click('Selecionar Titan 125');
    mocks.user = { id: 'user-b' };
    mocks.query.mockResolvedValue({ data: [titan, verona], error: null });
    await mount(); expect(output()).toBeNull();
    expect(container.textContent).toContain('Nenhum veículo cadastrado');
    expect(mocks.query).toHaveBeenLastCalledWith('user_id', 'user-b');
  });
  it('late responses from another user are ignored', async () => {
    let resolve!: (value: any) => void;
    mocks.query.mockReturnValueOnce(new Promise(done => { resolve = done; }));
    await mount(); await click('fuel');
    const other = { ...verona, user_id: 'user-b', id: 'other-id' };
    mocks.user = { id: 'user-b' }; mocks.query.mockResolvedValue({ data: [other], error: null });
    await mount(); expect(output()?.textContent).toBe(other.id);
    await act(async () => resolve({ data: [titan], error: null }));
    expect(output()?.textContent).toBe(other.id);
  });
});
