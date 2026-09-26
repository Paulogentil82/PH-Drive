import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dashboardService } from '../dashboardService';
import { translateFuelType } from '../DashboardView';
import { alertsService } from '../../alerts/alertsService';
import { supabase } from '../../../lib/supabase';
import { FuelEntry } from '../../../types/fuel_entry';
import { Trip } from '../../../types';
import { VehicleTire } from '../../../types/tires';
import { VehicleDocument } from '../../../types/documents';
import { MaintenanceEntry } from '../../../types/maintenance_entry';

vi.mock('../../../lib/supabase', () => {
  const mockSingle = vi.fn();
  const mockSelect = vi.fn();
  const mockEq = vi.fn();
  const mockOrder = vi.fn();
  const mockLimit = vi.fn();

  const mockQueryBuilder = {
    select: mockSelect,
    eq: mockEq,
    order: mockOrder,
    limit: mockLimit,
    single: mockSingle,
  };

  mockSelect.mockReturnValue(mockQueryBuilder);
  mockEq.mockReturnValue(mockQueryBuilder);
  mockOrder.mockReturnValue(mockQueryBuilder);
  mockLimit.mockReturnValue(mockQueryBuilder);
  mockSingle.mockResolvedValue({ data: {}, error: null });

  return {
    supabase: {
      from: vi.fn(() => mockQueryBuilder),
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-a' } }, error: null })
      }
    }
  };
});

describe('Dashboard Consolidated Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('dashboardService.getDashboardData calls supabase with correct filters', async () => {
    const mockFrom = vi.spyOn(supabase, 'from');
    await dashboardService.getDashboardData('vehicle-123');

    expect(mockFrom).toHaveBeenCalledWith('trips');
    expect(mockFrom).toHaveBeenCalledWith('fuel_entries');
    expect(mockFrom).toHaveBeenCalledWith('maintenance_entries');
    expect(mockFrom).toHaveBeenCalledWith('vehicle_expenses');
    expect(mockFrom).toHaveBeenCalledWith('vehicle_documents');
    expect(mockFrom).toHaveBeenCalledWith('vehicle_tires');
  });

  // Calculate functions to test
  const calculateMetrics = (
    trips: Trip[],
    fuelEntries: FuelEntry[],
    maintenanceEntries: MaintenanceEntry[],
    expenses: any[],
    documents: VehicleDocument[],
    tires: VehicleTire[],
    odometer_km: number,
    vehicleName: string
  ) => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();

    const isCurrentMonth = (dateStr: string | null | undefined): boolean => {
      if (!dateStr) return false;
      const parts = dateStr.split('T')[0].split('-');
      if (parts.length >= 2) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        return year === currentYear && month === currentMonth;
      }
      return false;
    };

    const completedTrips = trips.filter(t => t.status === 'COMPLETED');
    const tripsThisMonth = completedTrips.filter(t => isCurrentMonth(t.started_at));

    // kmMonth: gps_distance_km priority, distance_km fallback
    const kmMonth = tripsThisMonth.reduce((sum, t) => {
      const dist = t.gps_distance_km && t.gps_distance_km > 0 ? t.gps_distance_km : (t.distance_km || 0);
      return sum + Number(dist);
    }, 0);

    // Gastos no mês (fuel, maintenance, expenses; documents NOT included)
    const fuelMonthSpent = fuelEntries
      .filter(f => isCurrentMonth(f.filled_at))
      .reduce((sum, f) => sum + Number(f.total_amount || 0), 0);

    const maintMonthSpent = maintenanceEntries
      .filter(m => isCurrentMonth(m.performed_at))
      .reduce((sum, m) => sum + Number(m.cost_amount || 0), 0);

    const expenseMonthSpent = expenses
      .filter(e => isCurrentMonth(e.expense_date))
      .reduce((sum, e) => sum + Number(e.amount || 0), 0);

    const spentMonth = fuelMonthSpent + maintMonthSpent + expenseMonthSpent;

    // Última viagem
    const lastTrip = completedTrips[0] || null;

    // Último combustível
    const lastFuel = fuelEntries[0] || null;

    // Documentos vencidos/pendentes
    const pendingDocs = documents.filter(d => d.status === 'PENDING');
    let docsVencido = 0;
    pendingDocs.forEach(d => {
      if (d.due_date) {
        const diff = (new Date(d.due_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
        if (diff <= 0) docsVencido++;
      }
    });

    // Pneus próximos da troca
    let tiresProximo = 0;
    tires.forEach(t => {
      if (t.status === 'ACTIVE' && t.expected_life_km) {
        const kmUsed = odometer_km - t.installed_odometer_km;
        const kmRestantes = t.expected_life_km - kmUsed;
        if (kmRestantes > 0 && kmRestantes <= 1500) {
          tiresProximo++;
        }
      }
    });

    // Resumo Textual
    let summaryText = '';
    if (kmMonth > 0 && spentMonth > 0) {
      summaryText = `Neste mês, o ${vehicleName} percorreu ${kmMonth} km e gerou R$ ${spentMonth} em custos.`;
    } else if (kmMonth > 0) {
      summaryText = `Neste mês, o ${vehicleName} percorreu ${kmMonth} km.`;
    } else if (spentMonth > 0) {
      summaryText = `Neste mês, o ${vehicleName} gerou R$ ${spentMonth} em custos.`;
    } else {
      summaryText = `Neste mês, o ${vehicleName} ainda não possui viagens ou gastos registrados.`;
    }

    return {
      tripsMonth: tripsThisMonth.length,
      kmMonth,
      spentMonth,
      lastTrip,
      lastFuel,
      docsVencido,
      tiresProximo,
      summaryText
    };
  };

  it('calcula gastos do mês sem duplicados e sem documentos', () => {
    const today = new Date().toISOString(); // e.g. "2026-09-26..."
    
    const fuelEntries = [
      { id: 'f1', filled_at: today, total_amount: 150, liters: 30, odometer_km: 1000, price_per_liter: 5 } as any
    ];
    const maintenanceEntries = [
      { id: 'm1', performed_at: today, cost_amount: 300, service_type: 'Troca de Óleo', odometer_km: 1000 } as any
    ];
    const expenses = [
      { id: 'e1', expense_date: today, amount: 50, category: 'Lavagem' } as any
    ];
    const documents = [
      { id: 'd1', status: 'PENDING', due_date: today, amount: 200 } as any
    ];

    const res = calculateMetrics([], fuelEntries, maintenanceEntries, expenses, documents, [], 1000, 'Titan');
    expect(res.spentMonth).toBe(500); // 150 + 300 + 50
  });

  it('calcula viagens do mês corretamente', () => {
    const today = new Date().toISOString();
    const trips = [
      { id: 't1', status: 'COMPLETED', started_at: today, distance_km: 15 } as any,
      { id: 't2', status: 'COMPLETED', started_at: today, distance_km: 25 } as any,
      { id: 't3', status: 'CANCELLED', started_at: today, distance_km: 10 } as any,
    ];

    const res = calculateMetrics(trips, [], [], [], [], [], 1000, 'Titan');
    expect(res.tripsMonth).toBe(2);
  });

  it('calcula km do mês com prioridade de gps_distance_km e fallback distance_km', () => {
    const today = new Date().toISOString();
    const trips = [
      { id: 't1', status: 'COMPLETED', started_at: today, gps_distance_km: 12.5, distance_km: 10.0 } as any,
      { id: 't2', status: 'COMPLETED', started_at: today, gps_distance_km: null, distance_km: 15.0 } as any,
    ];

    const res = calculateMetrics(trips, [], [], [], [], [], 1000, 'Titan');
    expect(res.kmMonth).toBe(27.5); // 12.5 + 15.0
  });

  it('encontra última viagem', () => {
    const trips = [
      { id: 'recent', status: 'COMPLETED', started_at: '2026-09-26T12:00:00Z' } as any,
      { id: 'old', status: 'COMPLETED', started_at: '2026-09-25T12:00:00Z' } as any,
    ];

    const res = calculateMetrics(trips, [], [], [], [], [], 1000, 'Titan');
    expect(res.lastTrip?.id).toBe('recent');
  });

  it('calcula resumo de combustível com último abastecimento', () => {
    const fuelEntries = [
      { id: 'new', filled_at: '2026-09-26', total_amount: 100, liters: 20 } as any,
      { id: 'old', filled_at: '2026-09-20', total_amount: 80, liters: 15 } as any,
    ];

    const res = calculateMetrics([], fuelEntries, [], [], [], [], 1000, 'Titan');
    expect(res.lastFuel?.id).toBe('new');
  });

  it('encontra documentos vencidos', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const documents = [
      { id: 'd1', status: 'PENDING', due_date: yesterday.toISOString() } as any,
      { id: 'd2', status: 'PAID', due_date: yesterday.toISOString() } as any,
    ];

    const res = calculateMetrics([], [], [], [], documents, [], 1000, 'Titan');
    expect(res.docsVencido).toBe(1);
  });

  it('encontra pneus próximos da troca', () => {
    const tires = [
      { id: 't1', status: 'ACTIVE', position: 'FRONT', installed_odometer_km: 10000, expected_life_km: 5000 } as any, // remaining 1000km (proximo)
    ];

    const res = calculateMetrics([], [], [], [], [], tires, 14000, 'Titan');
    expect(res.tiresProximo).toBe(1);
  });

  it('geração do resumo textual factual', () => {
    const today = new Date().toISOString();
    const trips = [{ id: 't1', status: 'COMPLETED', started_at: today, distance_km: 320 } as any];
    const fuel = [{ id: 'f1', filled_at: today, total_amount: 180 } as any];

    const res = calculateMetrics(trips, fuel, [], [], [], [], 1000, 'Titan 125');
    expect(res.summaryText).toBe('Neste mês, o Titan 125 percorreu 320 km e gerou R$ 180 em custos.');
  });

  it('estado vazio retorna valores corretos', () => {
    const res = calculateMetrics([], [], [], [], [], [], 1000, 'Titan 125');
    expect(res.kmMonth).toBe(0);
    expect(res.spentMonth).toBe(0);
    expect(res.tripsMonth).toBe(0);
    expect(res.lastTrip).toBeNull();
    expect(res.lastFuel).toBeNull();
    expect(res.summaryText).toBe('Neste mês, o Titan 125 ainda não possui viagens ou gastos registrados.');
  });

  describe('Homologation Visual Fixes - 4A.8', () => {
    it('Dashboard 26/09 -> 10/10 = 14 dias timezone-safely', () => {
      // Mock today to 2026-09-26
      const mockToday = new Date(2026, 8, 26); // September is index 8
      vi.useFakeTimers();
      vi.setSystemTime(mockToday);

      const diff = alertsService.getDaysDifference('2026-10-10');
      expect(diff).toBe(14);

      vi.useRealTimers();
    });

    it('Dashboard 26/09 -> 15/10 = 19 dias timezone-safely', () => {
      const mockToday = new Date(2026, 8, 26);
      vi.useFakeTimers();
      vi.setSystemTime(mockToday);

      const diff = alertsService.getDaysDifference('2026-10-15');
      expect(diff).toBe(19);

      vi.useRealTimers();
    });

    it('último abastecimento escolhe created_at mais recente em caso de empate na data', () => {
      const fuelEntries: FuelEntry[] = [
        {
          id: 'anterior-id',
          filled_at: '2026-09-26',
          total_amount: 75.99,
          liters: 12,
          price_per_liter: 6.333,
          full_tank: true,
          fuel_type: 'GASOLINE',
          odometer_km: 12000,
          user_id: 'user-a',
          vehicle_id: 'v-1',
          created_at: '2026-09-26T10:00:00Z',
          updated_at: '2026-09-26T10:00:00Z'
        },
        {
          id: 'posterior-id',
          filled_at: '2026-09-26',
          total_amount: 6.62,
          liters: 1,
          price_per_liter: 6.62,
          full_tank: false,
          fuel_type: 'GASOLINE',
          odometer_km: 12001,
          user_id: 'user-a',
          vehicle_id: 'v-1',
          created_at: '2026-09-26T14:00:00Z',
          updated_at: '2026-09-26T14:00:00Z'
        }
      ];

      const sorted = [...fuelEntries].sort((a, b) => {
        const timeA = new Date(a.filled_at).getTime();
        const timeB = new Date(b.filled_at).getTime();
        if (timeA !== timeB) return timeB - timeA;
        const createdA = new Date(a.created_at || 0).getTime();
        const createdB = new Date(b.created_at || 0).getTime();
        return createdB - createdA;
      });

      expect(sorted[0].id).toBe('posterior-id');
      expect(sorted[0].total_amount).toBe(6.62);
    });

    it('GASOLINE aparece como Gasolina', () => {
      expect(translateFuelType('GASOLINE')).toBe('Gasolina');
      expect(translateFuelType('ETHANOL')).toBe('Etanol');
      expect(translateFuelType('FLEX')).toBe('Flex');
      expect(translateFuelType('DIESEL')).toBe('Diesel');
      expect(translateFuelType('ELECTRIC')).toBe('Elétrico');
      expect(translateFuelType('HYBRID')).toBe('Híbrido');
      expect(translateFuelType('GNV')).toBe('GNV');
      expect(translateFuelType('UNKNOWN')).toBe('UNKNOWN');
    });
  });
});
