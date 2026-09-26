import React, { useState, useEffect, useMemo } from 'react';
import { 
  Car, 
  Bike, 
  Gauge, 
  CreditCard, 
  TrendingUp, 
  AlertTriangle, 
  Calendar, 
  Navigation, 
  Clock, 
  Disc, 
  Wrench, 
  FileText, 
  Plus, 
  ArrowRight, 
  AlertCircle, 
  CheckCircle,
  HelpCircle
} from 'lucide-react';
import { Vehicle, Trip, NavigationTab } from '../../types';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/AuthContext';
import { usePreferences } from '../profile/PreferencesContext';
import { StatCard, LoadingState, ErrorState, PageHeader } from '../../components/common/CommonComponents';
import { dashboardService } from './dashboardService';
import { fuelEntriesService } from '../fuel/fuelEntriesService';
import { alertsService } from '../alerts/alertsService';
import { Alert } from '../../types/alerts';
import { VehicleTire } from '../../types/tires';
import { VehicleDocument } from '../../types/documents';
import { MaintenanceEntry } from '../../types/maintenance_entry';

export const translateFuelType = (type: string | null | undefined): string => {
  if (!type) return '—';
  const mapping: Record<string, string> = {
    GASOLINE: 'Gasolina',
    ETHANOL: 'Etanol',
    DIESEL: 'Diesel',
    FLEX: 'Flex',
    ELECTRIC: 'Elétrico',
    HYBRID: 'Híbrido',
    GNV: 'GNV'
  };
  return mapping[type.toUpperCase()] || type;
};

interface DashboardViewProps {
  onNavigate: (tab: NavigationTab) => void;
  alerts: Alert[];
  criticalAlertCount: number;
}

export function DashboardView({ onNavigate, alerts: initialAlerts, criticalAlertCount: initialCriticalCount }: DashboardViewProps) {
  const { user } = useAuth();
  const { preferences, formatDistance, formatCurrency, formatAppDate } = usePreferences();
  
  // Data States
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [dashboardData, setDashboardData] = useState<{
    trips: Trip[];
    fuelEntries: any[];
    maintenanceEntries: MaintenanceEntry[];
    expenses: any[];
    documents: VehicleDocument[];
    tires: VehicleTire[];
  } | null>(null);
  
  const [vehicleAlerts, setVehicleAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 1. Fetch all vehicles first
  const fetchVehicles = async () => {
    if (!user) return;
    try {
      setLoading(true);
      setError(null);
      const { data, error: vError } = await supabase
        .from('vehicles')
        .select('*')
        .eq('user_id', user.id)
        .order('name', { ascending: true });
      
      if (vError) throw vError;
      
      const vehicleList = data || [];
      setVehicles(vehicleList);

      if (vehicleList.length > 0) {
        // Use default vehicle from preferences if set and valid, otherwise fallback
        const hasDefault = preferences.default_vehicle_id && vehicleList.some(v => v.id === preferences.default_vehicle_id);
        const toSelect = hasDefault 
          ? preferences.default_vehicle_id! 
          : (vehicleList.length === 1 ? vehicleList[0].id : (vehicleList.find(v => v.active)?.id || vehicleList[0].id));
        setSelectedVehicleId(toSelect);
      } else {
        setLoading(false);
      }
    } catch (err: any) {
      console.error('Error fetching vehicles:', err);
      setError(err.message || 'Erro ao carregar veículos.');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVehicles();
  }, [user]);

  // 2. Fetch specific vehicle consolidated data when selection changes
  const fetchSelectedVehicleData = async (vehicleId: string) => {
    try {
      setLoading(true);
      setError(null);

      // Fetch parallel dashboard data and actual alerts
      const [data, allAlerts] = await Promise.all([
        dashboardService.getDashboardData(vehicleId),
        alertsService.getAlerts()
      ]);

      setDashboardData(data);
      
      // Filter alerts specifically for this vehicle and respect preferences
      const filteredAlerts = allAlerts.filter(a => {
        if (a.vehicleId !== vehicleId) return false;
        if (a.severity === 'PRÓXIMO' && !preferences.alert_upcoming_enabled) return false;
        if (a.severity === 'URGENTE' && !preferences.alert_urgent_enabled) return false;
        if (a.severity === 'VENCIDO' && !preferences.alert_overdue_enabled) return false;
        return true;
      });
      setVehicleAlerts(filteredAlerts);
    } catch (err: any) {
      console.error('Error fetching dashboard vehicle data:', err);
      setError(err.message || 'Erro ao consolidar dados do painel.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedVehicleId) {
      fetchSelectedVehicleData(selectedVehicleId);
    }
  }, [selectedVehicleId]);

  // Selected vehicle helper
  const selectedVehicle = useMemo(() => {
    return vehicles.find(v => v.id === selectedVehicleId) || null;
  }, [vehicles, selectedVehicleId]);

  // Safe timezone friendly date formatter
  const formatCivilDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '—';
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  // Helper: check if a date string is in the current month (civil date friendly)
  const isCurrentMonthCivil = (dateStr: string | null | undefined): boolean => {
    if (!dateStr) return false;
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length >= 2) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // 0-indexed
      const today = new Date();
      return year === today.getFullYear() && month === today.getMonth();
    }
    return false;
  };

  // Metrics calculations
  const metrics = useMemo(() => {
    if (!dashboardData || !selectedVehicle) {
      return {
        odometer: 0,
        tripsMonth: 0,
        kmMonth: 0,
        spentMonth: 0,
        criticalAlertsCount: 0,
        recurrentAlertsCount: 0,
        spentByCategory: { fuel: 0, maintenance: 0, general: 0 },
        recentMonthsDistances: [] as { label: string; distance: number }[],
        summaryText: '',
        lastTrip: null as Trip | null,
        lastFuel: null as any | null,
        avgConsumption: null as number | null,
        lastMaintenance: null as MaintenanceEntry | null,
        nextMaintenance: null as MaintenanceEntry | null,
        nextMaintenanceStatus: 'OK' as 'OK' | 'PRÓXIMA' | 'URGENTE' | 'VENCIDA',
        tiresSummary: { active: 0, proximo: 0, urgente: 0, vencido: 0 },
        tiresPositions: [] as { position: string; label: string; activeTire: any | null; statusLabel: string; severity: string }[],
        docsSummary: { pending: 0, proximo: 0, vencido: 0, mostRelevant: null as VehicleDocument | null }
      };
    }

    const { trips, fuelEntries, maintenanceEntries, expenses, documents, tires } = dashboardData;

    // 1. Month-based calculations
    const completedTrips = trips.filter(t => t.status === 'COMPLETED');
    const tripsThisMonth = completedTrips.filter(t => isCurrentMonthCivil(t.started_at));
    const tripsMonthCount = tripsThisMonth.length;

    // Km percorridos no mês: use gps_distance_km if available and > 0, else distance_km
    const kmMonth = tripsThisMonth.reduce((sum, t) => {
      const dist = t.gps_distance_km && t.gps_distance_km > 0 ? t.gps_distance_km : (t.distance_km || 0);
      return sum + Number(dist);
    }, 0);

    // Gastos no mês: abastecimentos + manutenções + despesas gerais do mês corrente
    const fuelMonthSpent = fuelEntries
      .filter(f => isCurrentMonthCivil(f.filled_at))
      .reduce((sum, f) => sum + Number(f.total_amount || 0), 0);

    const maintMonthSpent = maintenanceEntries
      .filter(m => isCurrentMonthCivil(m.performed_at))
      .reduce((sum, m) => sum + Number(m.cost_amount || 0), 0);

    const expenseMonthSpent = expenses
      .filter(e => isCurrentMonthCivil(e.expense_date))
      .reduce((sum, e) => sum + Number(e.amount || 0), 0);

    const spentMonth = fuelMonthSpent + maintMonthSpent + expenseMonthSpent;

    const spentByCategory = {
      fuel: fuelMonthSpent,
      maintenance: maintMonthSpent,
      general: expenseMonthSpent
    };

    // 2. Alertas críticos (VENCIDO + URGENTE)
    const criticalAlertsCount = vehicleAlerts.filter(a => a.severity === 'VENCIDO' || a.severity === 'URGENTE').length;

    // 3. Última viagem
    const lastTrip = completedTrips[0] || null;

    // 4. Combustível
    const sortedFuelEntries = [...fuelEntries].sort((a, b) => {
      const timeA = new Date(a.filled_at).getTime();
      const timeB = new Date(b.filled_at).getTime();
      if (timeA !== timeB) return timeB - timeA;
      const createdA = new Date(a.created_at || 0).getTime();
      const createdB = new Date(b.created_at || 0).getTime();
      return createdB - createdA;
    });
    const lastFuel = sortedFuelEntries[0] || null;
    const consumptionStats = fuelEntriesService.calculateConsumption(fuelEntries);
    const avgConsumption = consumptionStats.averageConsumption;

    // 5. Manutenções
    const lastMaintenance = maintenanceEntries[0] || null;
    
    // Encontrar próxima manutenção agendada e calcular pior status dela
    let nextMaintenance: MaintenanceEntry | null = null;
    let nextMaintenanceStatus: 'OK' | 'PRÓXIMA' | 'URGENTE' | 'VENCIDA' = 'OK';

    // Filter maintenance alerts for this vehicle
    const maintAlerts = vehicleAlerts.filter(a => a.sourceType === 'maintenance');
    const worstMaintAlert = maintAlerts[0] || null; // sorted by priority in service

    if (worstMaintAlert) {
      nextMaintenance = maintenanceEntries.find(m => m.id === worstMaintAlert.sourceId) || null;
      if (worstMaintAlert.severity === 'VENCIDO') nextMaintenanceStatus = 'VENCIDA';
      else if (worstMaintAlert.severity === 'URGENTE') nextMaintenanceStatus = 'URGENTE';
      else if (worstMaintAlert.severity === 'PRÓXIMO') nextMaintenanceStatus = 'PRÓXIMA';
    } else {
      // Find the one with nearest next_due date or odometer
      const upcoming = maintenanceEntries.filter(m => m.next_due_date || m.next_due_odometer_km);
      if (upcoming.length > 0) {
        nextMaintenance = upcoming[0];
      }
    }

    // 6. Documentos
    const pendingDocs = documents.filter(d => d.status === 'PENDING');
    let docsVencido = 0;
    let docsProximo = 0;
    let mostRelevantDoc: VehicleDocument | null = null;

    pendingDocs.forEach(d => {
      if (d.due_date) {
        const diffDays = alertsService.getDaysDifference(d.due_date);
        if (diffDays <= 0) {
          docsVencido++;
        } else if (diffDays <= 30) {
          docsProximo++;
        }
      }
    });

    if (pendingDocs.length > 0) {
      // Sort pending docs to find the most relevant (expired first, then closest to expire)
      const sortedPending = [...pendingDocs].sort((a, b) => {
        const ad = a.due_date ? alertsService.getDaysDifference(a.due_date) : 999999;
        const bd = b.due_date ? alertsService.getDaysDifference(b.due_date) : 999999;
        return ad - bd;
      });
      mostRelevantDoc = sortedPending[0];
    }

    const docsSummary = {
      pending: pendingDocs.length,
      proximo: docsProximo,
      vencido: docsVencido,
      mostRelevant: mostRelevantDoc
    };

    // 7. Pneus
    let tiresActive = 0;
    let tiresProximo = 0;
    let tiresUrgente = 0;
    let tiresVencido = 0;

    tires.forEach(t => {
      if (t.status === 'ACTIVE') {
        tiresActive++;
        if (t.expected_life_km) {
          const kmUsed = selectedVehicle.odometer_km - t.installed_odometer_km;
          const kmRestantes = t.expected_life_km - kmUsed;
          if (kmRestantes <= 0) tiresVencido++;
          else if (kmRestantes <= 500) tiresUrgente++;
          else if (kmRestantes <= 1500) tiresProximo++;
        }
      }
    });

    // Posições de pneus para exibição rápida baseada no tipo de veículo
    const positionsToRender = selectedVehicle.type === 'MOTORCYCLE' 
      ? [
          { position: 'FRONT', label: 'Dianteiro' },
          { position: 'REAR', label: 'Traseiro' }
        ]
      : [
          { position: 'FRONT_LEFT', label: 'Dian. Esq.' },
          { position: 'FRONT_RIGHT', label: 'Dian. Dir.' },
          { position: 'REAR_LEFT', label: 'Tras. Esq.' },
          { position: 'REAR_RIGHT', label: 'Tras. Dir.' }
        ];

    const tiresPositions = positionsToRender.map(pos => {
      const activeTire = tires.find(t => t.position === pos.position && t.status === 'ACTIVE') || null;
      let statusLabel = 'Não cadastrado';
      let severity = 'NONE';

      if (activeTire) {
        statusLabel = 'OK';
        severity = 'OK';
        if (activeTire.expected_life_km) {
          const kmUsed = selectedVehicle.odometer_km - activeTire.installed_odometer_km;
          const kmRestantes = activeTire.expected_life_km - kmUsed;
          if (kmRestantes <= 0) {
            statusLabel = 'Vencido';
            severity = 'VENCIDO';
          } else if (kmRestantes <= 500) {
            statusLabel = 'Urgente';
            severity = 'URGENTE';
          } else if (kmRestantes <= 1500) {
            statusLabel = 'Próximo';
            severity = 'PROXIMO';
          }
        } else {
          statusLabel = 'Ativo (Sem previs.)';
          severity = 'SEM_PREVISAO';
        }
      }

      return {
        position: pos.position,
        label: pos.label,
        activeTire,
        statusLabel,
        severity
      };
    });

    // 8. Distâncias dos últimos 6 meses (Gráfico Compacto)
    const monthLabels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const today = new Date();
    const recentMonthsDistances = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const mYear = d.getFullYear();
      const mMonth = d.getMonth();
      
      // Filter trips in this month
      const monthTrips = completedTrips.filter(t => {
        if (!t.started_at) return false;
        const td = new Date(t.started_at);
        return td.getFullYear() === mYear && td.getMonth() === mMonth;
      });

      const distSum = monthTrips.reduce((sum, t) => {
        const dist = t.gps_distance_km && t.gps_distance_km > 0 ? t.gps_distance_km : (t.distance_km || 0);
        return sum + Number(dist);
      }, 0);

      recentMonthsDistances.push({
        label: monthLabels[mMonth],
        distance: distSum
      });
    }

    // 9. Resumo Textual factual e elegante
    let summaryText = '';
    const name = selectedVehicle.name;
    const formattedKm = formatDistance(kmMonth);
    const formattedCost = formatCurrency(spentMonth);

    if (kmMonth > 0 && spentMonth > 0) {
      summaryText = `Neste mês, o ${name} percorreu ${formattedKm} e gerou ${formattedCost} em custos.`;
    } else if (kmMonth > 0) {
      summaryText = `Neste mês, o ${name} percorreu ${formattedKm} e não registrou custos adicionais.`;
    } else if (spentMonth > 0) {
      summaryText = `Neste mês, o ${name} gerou ${formattedCost} em custos operacionais acumulados.`;
    } else {
      summaryText = `Neste mês, o ${name} ainda não possui viagens ou gastos registrados.`;
    }

    return {
      odometer: selectedVehicle.odometer_km,
      tripsMonth: tripsMonthCount,
      kmMonth,
      spentMonth,
      criticalAlertsCount,
      spentByCategory,
      recentMonthsDistances,
      summaryText,
      lastTrip,
      lastFuel,
      avgConsumption,
      lastMaintenance,
      nextMaintenance,
      nextMaintenanceStatus,
      tiresSummary: { active: tiresActive, proximo: tiresProximo, urgente: tiresUrgente, vencido: tiresVencido },
      tiresPositions,
      docsSummary
    };
  }, [dashboardData, selectedVehicle, vehicleAlerts]);

  // Loading global state
  if (loading && vehicles.length === 0) {
    return <LoadingState message="Carregando visão geral do PH Drive..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={fetchVehicles} />;
  }

  // Entirely empty state if user has no vehicles
  if (vehicles.length === 0) {
    return (
      <div>
        <PageHeader 
          title="Visão Geral" 
          subtitle="Seu painel pessoal de status de veículos" 
        />
        <div className="p-12 text-center border border-slate-800 rounded-3xl bg-slate-900/40 flex flex-col items-center justify-center max-w-2xl mx-auto mt-12 shadow-2xl">
          <Car className="w-16 h-16 text-slate-500 mb-5 animate-pulse" />
          <h3 className="text-xl font-bold text-white">Nenhum veículo cadastrado</h3>
          <p className="text-slate-400 text-sm max-w-md mt-2 mb-8 leading-relaxed">
            Bem-vindo ao PH Drive! Para começar a acompanhar consumos, viagens, pneus e manutenção, cadastre seu primeiro veículo (carro ou motocicleta).
          </p>
          <button 
            onClick={() => onNavigate('vehicles')}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm rounded-xl transition shadow-lg shadow-blue-600/20"
          >
            <Plus className="w-4 h-4" /> Cadastrar meu primeiro veículo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      
      {/* Top Selector and Selected Vehicle Info */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
        {/* Background gradient decorative element */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-blue-500">Veículo Selecionado</span>
            {selectedVehicle ? (
              <div className="mt-1">
                <h1 className="text-3xl font-black text-white flex items-center gap-2">
                  {selectedVehicle.name}
                  {selectedVehicle.type === 'CAR' ? <Car className="w-6 h-6 text-slate-400 shrink-0" /> : <Bike className="w-6 h-6 text-slate-400 shrink-0" />}
                </h1>
                <p className="text-sm text-slate-400 mt-1">
                  {selectedVehicle.brand || 'Marca não informada'} {selectedVehicle.model} {selectedVehicle.year ? `· Ano ${selectedVehicle.year}` : ''}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-300">
                    <Gauge className="w-3.5 h-3.5 text-slate-500" />
                    Odômetro: {formatDistance(selectedVehicle.odometer_km)}
                  </span>
                  {selectedVehicle.license_plate && (
                    <span className="inline-flex items-center px-3 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-300">
                      Placa: {selectedVehicle.license_plate}
                    </span>
                  )}
                  {selectedVehicle.fuel_type && (
                    <span className="inline-flex items-center px-3 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 font-medium">
                      Combustível: {translateFuelType(selectedVehicle.fuel_type)}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400 mt-1">Nenhum veículo selecionado</p>
            )}
          </div>

          {/* Selector dropdown (only shown if user has more than 1 vehicle) */}
          {vehicles.length > 1 && (
            <div className="w-full md:w-auto shrink-0">
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Trocar veículo</label>
              <select
                value={selectedVehicleId}
                onChange={(e) => setSelectedVehicleId(e.target.value)}
                className="w-full md:w-64 p-3 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer transition hover:border-slate-700"
              >
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>{v.name} ({v.brand || 'N/D'} {v.model || ''})</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Real-time Factual Text Summary (Etapa 4A.8 requirement) */}
      {metrics.summaryText && (
        <div className="p-4 bg-blue-950/25 border border-blue-900/30 rounded-2xl flex items-center gap-3">
          <TrendingUp className="w-5 h-5 text-blue-400 shrink-0" />
          <p className="text-sm font-semibold text-slate-200">{metrics.summaryText}</p>
        </div>
      )}

      {/* Stat Cards Grid (Odômetro, Viagens, Km, Gastos, Alertas) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col justify-between">
          <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Odômetro Atual</span>
          <div>
            <span className="text-xl md:text-2xl font-black text-white mt-3 font-mono block tabular-nums">
              {formatDistance(metrics.odometer)}
            </span>
            <span className="text-[10px] text-slate-500 mt-1 block">Acumulado total</span>
          </div>
        </div>

        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col justify-between">
          <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Viagens no Mês</span>
          <div>
            <span className="text-xl md:text-2xl font-black text-white mt-3 font-mono block tabular-nums">
              {metrics.tripsMonth}
            </span>
            <span className="text-[10px] text-slate-500 mt-1 block">Viagens concluídas</span>
          </div>
        </div>

        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col justify-between">
          <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Km Percorridos no Mês</span>
          <div>
            <span className="text-xl md:text-2xl font-black text-white mt-3 font-mono block tabular-nums">
              {formatDistance(metrics.kmMonth)}
            </span>
            <span className="text-[10px] text-slate-500 mt-1 block">Distância rodada</span>
          </div>
        </div>

        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col justify-between">
          <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Gastos no Mês</span>
          <div>
            <span className="text-xl md:text-2xl font-black text-emerald-400 mt-3 font-mono block tabular-nums">
              {formatCurrency(metrics.spentMonth)}
            </span>
            <span className="text-[10px] text-slate-500 mt-1 block">Abast + Manut + Desp</span>
          </div>
        </div>

        <div className={`p-5 border rounded-2xl flex flex-col justify-between col-span-2 lg:col-span-1 ${
          metrics.criticalAlertsCount > 0 
            ? 'bg-red-950/20 border-red-900/40 text-red-100' 
            : 'bg-slate-900 border-slate-800 text-slate-100'
        }`}>
          <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Alertas Críticos</span>
          <div>
            <span className="text-xl md:text-2xl font-black mt-3 font-mono block tabular-nums">
              {metrics.criticalAlertsCount}
            </span>
            <span className="text-[10px] text-slate-500 mt-1 block">Vencidos ou Urgentes</span>
          </div>
        </div>
      </div>

      {/* Quick Action Area (Etapa 4A.8 requirement) */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
        <h3 className="text-base font-bold text-white mb-4">Ações Rápidas</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <button 
            onClick={() => onNavigate('fuel')}
            className="p-3 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl text-left font-semibold text-xs text-slate-200 transition flex items-center gap-2.5"
          >
            <span className="p-1.5 bg-blue-600/10 text-blue-400 rounded-lg">
              <Plus className="w-3.5 h-3.5" />
            </span>
            <span>Abastecimento</span>
          </button>
          <button 
            onClick={() => onNavigate('maintenance')}
            className="p-3 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl text-left font-semibold text-xs text-slate-200 transition flex items-center gap-2.5"
          >
            <span className="p-1.5 bg-yellow-600/10 text-yellow-400 rounded-lg">
              <Wrench className="w-3.5 h-3.5" />
            </span>
            <span>Manutenção</span>
          </button>
          <button 
            onClick={() => onNavigate('expenses')}
            className="p-3 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl text-left font-semibold text-xs text-slate-200 transition flex items-center gap-2.5"
          >
            <span className="p-1.5 bg-emerald-600/10 text-emerald-400 rounded-lg">
              <CreditCard className="w-3.5 h-3.5" />
            </span>
            <span>Despesa</span>
          </button>
          <button 
            onClick={() => onNavigate('documents')}
            className="p-3 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl text-left font-semibold text-xs text-slate-200 transition flex items-center gap-2.5"
          >
            <span className="p-1.5 bg-purple-600/10 text-purple-400 rounded-lg">
              <FileText className="w-3.5 h-3.5" />
            </span>
            <span>Documento</span>
          </button>
          <button 
            onClick={() => onNavigate('tires')}
            className="p-3 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl text-left font-semibold text-xs text-slate-200 transition flex items-center gap-2.5 col-span-2 md:col-span-1"
          >
            <span className="p-1.5 bg-indigo-600/10 text-indigo-400 rounded-lg">
              <Disc className="w-3.5 h-3.5" />
            </span>
            <span>Cadastrar Pneu</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Left Side detailed metrics, Right Side mini charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT/MID MAIN CONTENT MODULES */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Alertas Ativos Block */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-white text-base">Alertas Ativos</h3>
              </div>
              <button 
                onClick={() => onNavigate('alerts')}
                className="text-xs text-blue-400 hover:text-blue-300 font-bold transition flex items-center gap-1"
              >
                Ver todos <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {vehicleAlerts.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-2">Tudo em dia! Nenhum alerta ativo para este veículo.</p>
            ) : (
              <div className="space-y-3">
                {vehicleAlerts.slice(0, 3).map(alert => (
                  <div 
                    key={alert.id} 
                    className={`p-3.5 rounded-xl border flex items-start gap-3 transition ${
                      alert.severity === 'VENCIDO' 
                        ? 'bg-red-950/20 border-red-900/30 text-red-200' 
                        : alert.severity === 'URGENTE' 
                        ? 'bg-orange-950/20 border-orange-900/30 text-orange-200' 
                        : 'bg-yellow-950/20 border-yellow-900/30 text-yellow-200'
                    }`}
                  >
                    <AlertCircle className={`w-4 h-4 shrink-0 mt-0.5 ${
                      alert.severity === 'VENCIDO' ? 'text-red-400' : alert.severity === 'URGENTE' ? 'text-orange-400' : 'text-yellow-400'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-white">{alert.title}</h4>
                      <p className="text-[11px] text-slate-300 mt-0.5">{alert.message}</p>
                    </div>
                    <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 bg-slate-950 border border-slate-800 rounded-md text-slate-300 shrink-0">
                      {alert.severity}
                    </span>
                  </div>
                ))}
                {vehicleAlerts.length > 3 && (
                  <p className="text-[10px] text-slate-500 font-medium text-center mt-2">
                    + {vehicleAlerts.length - 3} outros alertas ativos. Clique em "Ver todos" para gerenciar.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Última Viagem Block */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Navigation className="w-5 h-5 text-blue-500" />
                <h3 className="font-bold text-white text-base">Última Viagem</h3>
              </div>
              <button 
                onClick={() => onNavigate('trips')}
                className="text-xs text-blue-400 hover:text-blue-300 font-bold transition flex items-center gap-1"
              >
                Ver detalhes <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {metrics.lastTrip ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span className="font-semibold text-slate-300">
                      {formatAppDate(metrics.lastTrip.started_at)}
                    </span>
                    <span className="text-slate-600">·</span>
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span>
                      {new Date(metrics.lastTrip.started_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  
                  {metrics.lastTrip.duration_seconds && (
                    <span className="bg-slate-950 border border-slate-800 px-2.5 py-1 rounded-lg font-medium text-slate-300">
                      Duração: {Math.round(metrics.lastTrip.duration_seconds / 60)} min
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 bg-slate-950/40 p-3.5 rounded-xl border border-slate-850/60">
                  <div>
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Origem</span>
                    <span className="text-xs font-bold text-slate-200 mt-0.5 block truncate">
                      {metrics.lastTrip.origin_label || 'Partida manual'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Destino</span>
                    <span className="text-xs font-bold text-slate-200 mt-0.5 block truncate">
                      {metrics.lastTrip.destination_label || 'Destino manual'}
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs pt-2">
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className="text-blue-400 w-4 h-4 shrink-0" />
                    <span className="text-slate-400">Distância:</span>
                    <span className="font-bold text-white font-mono">
                      {formatDistance(metrics.lastTrip.gps_distance_km && metrics.lastTrip.gps_distance_km > 0 
                        ? metrics.lastTrip.gps_distance_km 
                        : (metrics.lastTrip.distance_km || 0))}
                    </span>
                  </div>

                  {metrics.lastTrip.start_odometer_km && metrics.lastTrip.end_odometer_km && (
                    <div className="text-[11px] text-slate-500 font-mono">
                      {formatDistance(metrics.lastTrip.start_odometer_km)} → {formatDistance(metrics.lastTrip.end_odometer_km)}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic py-4 text-center">Nenhuma viagem registrada para este veículo.</p>
            )}
          </div>

          {/* Combustível & Manutenção Block */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Combustível Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-blue-600/15 text-blue-400 rounded-lg">
                      <Gauge className="w-4 h-4" />
                    </span>
                    <h3 className="font-bold text-white text-sm">Resumo de Combustível</h3>
                  </div>
                  <button 
                    onClick={() => onNavigate('fuel')}
                    className="text-[10px] text-blue-400 hover:text-blue-300 font-bold transition flex items-center gap-0.5"
                  >
                    Abastecer
                  </button>
                </div>

                {metrics.lastFuel ? (
                  <div className="space-y-2.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Último Abastecimento:</span>
                      <span className="text-slate-300 font-medium">{formatAppDate(metrics.lastFuel.filled_at)}</span>
                    </div>
                    <div className="flex justify-between font-mono text-[11px] bg-slate-950/20 p-2 rounded-lg border border-slate-850/40">
                      <div>
                        <span className="text-[9px] text-slate-500 block">Total</span>
                        <span className="font-bold text-white">{formatCurrency(metrics.lastFuel.total_amount)}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-500 block">Litros</span>
                        <span className="font-semibold text-slate-300">{metrics.lastFuel.liters.toLocaleString('pt-BR')} L</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-500 block">Preço/L</span>
                        <span className="font-semibold text-slate-300">{formatCurrency(metrics.lastFuel.price_per_liter)}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic py-2">Nenhum abastecimento registrado.</p>
                )}
              </div>

              <div className="border-t border-slate-800 pt-3 mt-4 flex items-center justify-between">
                <span className="text-[11px] text-slate-500">Consumo Médio:</span>
                <span className={`text-xs font-bold font-mono ${metrics.avgConsumption ? 'text-emerald-400' : 'text-slate-400'}`}>
                  {metrics.avgConsumption ? `${metrics.avgConsumption.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${preferences.distance_unit === 'MI' ? 'mi/l' : 'km/l'}` : 'Dado insuficiente'}
                </span>
              </div>
            </div>

            {/* Manutenção Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-yellow-600/15 text-yellow-400 rounded-lg">
                      <Wrench className="w-4 h-4" />
                    </span>
                    <h3 className="font-bold text-white text-sm">Status de Manutenção</h3>
                  </div>
                  <button 
                    onClick={() => onNavigate('maintenance')}
                    className="text-[10px] text-blue-400 hover:text-blue-300 font-bold transition flex items-center gap-0.5"
                  >
                    Histórico
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Última manutenção realizada:</span>
                    {metrics.lastMaintenance ? (
                      <span className="font-bold text-slate-200 mt-0.5 block truncate">
                        {metrics.lastMaintenance.service_type} <span className="text-[10px] text-slate-500 font-mono font-normal">({formatAppDate(metrics.lastMaintenance.performed_at)})</span>
                      </span>
                    ) : (
                      <span className="text-slate-500 italic block mt-0.5">Nenhuma manutenção realizada.</span>
                    )}
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 block">Próxima manutenção agendada:</span>
                    {metrics.nextMaintenance ? (
                      <span className="font-bold text-slate-200 mt-0.5 block truncate">
                        {metrics.nextMaintenance.service_type}
                      </span>
                    ) : (
                      <span className="text-slate-500 italic block mt-0.5">Sem agendamentos futuros.</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-800 pt-3 mt-4 flex items-center justify-between">
                <span className="text-[11px] text-slate-500">Status Geral:</span>
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${
                  metrics.nextMaintenanceStatus === 'VENCIDA' ? 'bg-red-950/60 text-red-400 border border-red-900/30' :
                  metrics.nextMaintenanceStatus === 'URGENTE' ? 'bg-orange-950/60 text-orange-400 border border-orange-900/30' :
                  metrics.nextMaintenanceStatus === 'PRÓXIMA' ? 'bg-yellow-950/60 text-yellow-400 border border-yellow-900/30' :
                  'bg-emerald-950/60 text-emerald-400 border border-emerald-900/30'
                }`}>
                  {metrics.nextMaintenanceStatus}
                </span>
              </div>
            </div>

          </div>

        </div>

        {/* RIGHT SIDE SUMMARY MODULES (CHARTS, TIRES, DOCUMENTS) */}
        <div className="space-y-6">

          {/* Gráfico de Gastos por Categoria */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
            <h3 className="font-bold text-white text-sm mb-4">Gráfico — Gastos do Mês</h3>
            
            {metrics.spentMonth === 0 ? (
              <div className="py-6 text-center text-slate-500 italic text-xs">
                Nenhum custo registrado neste mês.
              </div>
            ) : (
              <div className="space-y-4">
                {/* Horizontal Stacked Percentage Bar */}
                <div className="h-4 w-full bg-slate-950 rounded-full overflow-hidden flex">
                  {metrics.spentByCategory.fuel > 0 && (
                    <div 
                      style={{ width: `${(metrics.spentByCategory.fuel / metrics.spentMonth) * 100}%` }}
                      className="bg-blue-500 h-full"
                      title={`Combustível: R$ ${metrics.spentByCategory.fuel}`}
                    />
                  )}
                  {metrics.spentByCategory.maintenance > 0 && (
                    <div 
                      style={{ width: `${(metrics.spentByCategory.maintenance / metrics.spentMonth) * 100}%` }}
                      className="bg-yellow-500 h-full"
                      title={`Manutenção: R$ ${metrics.spentByCategory.maintenance}`}
                    />
                  )}
                  {metrics.spentByCategory.general > 0 && (
                    <div 
                      style={{ width: `${(metrics.spentByCategory.general / metrics.spentMonth) * 100}%` }}
                      className="bg-emerald-500 h-full"
                      title={`Geral: R$ ${metrics.spentByCategory.general}`}
                    />
                  )}
                </div>

                {/* Legend with absolute costs */}
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1.5 text-slate-300">
                      <span className="w-2.5 h-2.5 bg-blue-500 rounded-sm shrink-0" />
                      <span>Combustível</span>
                    </div>
                    <span className="font-mono text-slate-200">{formatCurrency(metrics.spentByCategory.fuel)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1.5 text-slate-300">
                      <span className="w-2.5 h-2.5 bg-yellow-500 rounded-sm shrink-0" />
                      <span>Manutenção</span>
                    </div>
                    <span className="font-mono text-slate-200">{formatCurrency(metrics.spentByCategory.maintenance)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1.5 text-slate-300">
                      <span className="w-2.5 h-2.5 bg-emerald-500 rounded-sm shrink-0" />
                      <span>Geral</span>
                    </div>
                    <span className="font-mono text-slate-200">{formatCurrency(metrics.spentByCategory.general)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Gráfico de Km percorridos (Últimos 6 meses) */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
            <h3 className="font-bold text-white text-sm mb-4">Distância Rodada — Últimos 6 meses</h3>
            
            {metrics.recentMonthsDistances.length === 0 || metrics.recentMonthsDistances.every(m => m.distance === 0) ? (
              <div className="py-8 text-center text-slate-500 italic text-xs">
                Nenhuma viagem registrada recentemente.
              </div>
            ) : (
              <div>
                {/* CSS/Tailwind Mini Vertical Bar Chart */}
                <div className="h-28 flex items-end justify-between gap-2.5 px-1.5 bg-slate-950/40 border border-slate-850/60 p-3 rounded-2xl">
                  {metrics.recentMonthsDistances.map((m, idx) => {
                    // Calculate height percentage relative to max distance
                    const maxDist = Math.max(...metrics.recentMonthsDistances.map(md => md.distance), 1);
                    const percent = Math.min((m.distance / maxDist) * 100, 100);
                    
                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer">
                        <div className="text-[9px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity absolute -translate-y-8 bg-slate-900 border border-slate-800 px-1 py-0.5 rounded font-mono z-10 whitespace-nowrap">
                          {formatDistance(m.distance)}
                        </div>
                        <div 
                          style={{ height: `${percent}%` }}
                          className={`w-full rounded-t-md transition-all ${
                            m.distance > 0 ? 'bg-blue-600 hover:bg-blue-500' : 'bg-slate-800/40'
                          }`}
                        />
                        <span className="text-[10px] text-slate-500 font-semibold mt-1.5 shrink-0 block">{m.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Card de Pneus */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-indigo-600/15 text-indigo-400 rounded-lg">
                    <Disc className="w-4 h-4" />
                  </span>
                  <h3 className="font-bold text-white text-sm">Pneus por Posição</h3>
                </div>
                <button 
                  onClick={() => onNavigate('tires')}
                  className="text-[10px] text-blue-400 hover:text-blue-300 font-bold transition flex items-center gap-0.5"
                >
                  Gerenciar
                </button>
              </div>

              {/* Individual tires layout */}
              <div className="space-y-2 text-xs">
                {metrics.tiresPositions.map(pos => (
                  <div key={pos.position} className="flex justify-between items-center p-2 bg-slate-950/20 border border-slate-850/40 rounded-xl">
                    <span className="font-semibold text-slate-300">{pos.label}:</span>
                    {pos.activeTire ? (
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 font-mono text-[11px] truncate max-w-[90px] md:max-w-[130px]">
                          {pos.activeTire.brand || 'Ativo'}
                        </span>
                        <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${
                          pos.severity === 'VENCIDO' ? 'bg-red-950 text-red-400 border border-red-900/30' :
                          pos.severity === 'URGENTE' ? 'bg-orange-950 text-orange-400 border border-orange-900/30' :
                          pos.severity === 'PROXIMO' ? 'bg-yellow-950 text-yellow-400 border border-yellow-900/30' :
                          'bg-emerald-950 text-emerald-400 border border-emerald-900/30'
                        }`}>
                          {pos.statusLabel.toUpperCase()}
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-500 text-[10px] italic">Não cadastrado</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-800 pt-3 mt-4 flex justify-between items-center text-[10px] text-slate-500">
              <span>Ativos: {metrics.tiresSummary.active}</span>
              {metrics.tiresSummary.vencido > 0 && <span className="text-red-400 font-bold">Vencidos: {metrics.tiresSummary.vencido}</span>}
              {metrics.tiresSummary.urgente > 0 && <span className="text-orange-400 font-bold">Urgentes: {metrics.tiresSummary.urgente}</span>}
            </div>
          </div>

          {/* Card de Documentos */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-purple-600/15 text-purple-400 rounded-lg">
                    <FileText className="w-4 h-4" />
                  </span>
                  <h3 className="font-bold text-white text-sm">Resumo de Documentos</h3>
                </div>
                <button 
                  onClick={() => onNavigate('documents')}
                  className="text-[10px] text-blue-400 hover:text-blue-300 font-bold transition flex items-center gap-0.5"
                >
                  Ver todos
                </button>
              </div>

              {metrics.docsSummary.mostRelevant ? (
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Próximo vencimento relevante:</span>
                    <span className="font-bold text-slate-200 block truncate mt-0.5">
                      {metrics.docsSummary.mostRelevant.title}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[11px] bg-slate-950/40 p-2 rounded-xl border border-slate-850/60 mt-2">
                    <span className="text-slate-400">Vencimento:</span>
                    <span className={`font-bold ${
                      alertsService.getDaysDifference(metrics.docsSummary.mostRelevant.due_date!) <= 0 
                        ? 'text-red-400' 
                        : 'text-slate-200'
                    }`}>
                      {formatAppDate(metrics.docsSummary.mostRelevant.due_date)}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic py-2">Nenhum documento pendente.</p>
              )}
            </div>

            <div className="border-t border-slate-800 pt-3 mt-4 flex items-center justify-between text-[10px] text-slate-500 font-medium">
              <span>Pendentes: {metrics.docsSummary.pending}</span>
              {metrics.docsSummary.vencido > 0 && <span className="text-red-400 font-bold">Vencidos: {metrics.docsSummary.vencido}</span>}
              {metrics.docsSummary.proximo > 0 && <span className="text-yellow-400 font-bold">Próximos: {metrics.docsSummary.proximo}</span>}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
