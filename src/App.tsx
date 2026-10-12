/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { FuelModule } from './features/fuel/FuelModule';
import { MaintenanceModule } from './features/maintenance/MaintenanceModule';
import { VehicleExpensesModule } from './features/expenses/VehicleExpensesModule';
import { DocumentsModule } from './features/documents/DocumentsModule';
import { ReportsModule } from './features/reports/ReportsModule';
import { AlertsModule } from './features/alerts/AlertsModule';
import { TiresModule } from './features/tires/TiresModule';
import { Alert } from './types/alerts';
import { alertsService } from './features/alerts/alertsService';
import { Vehicle } from './types';
import { supabase } from './lib/supabase';
import React, { useState, useEffect, useMemo } from 'react';
import { AuthProvider, useAuth } from './features/auth/AuthContext';
import { PreferencesProvider, usePreferences } from './features/profile/PreferencesContext';
import { LoginPage } from './features/auth/LoginPage';
import { SupabaseSetupModal } from './features/auth/SupabaseSetupModal';
import { AppLayout } from './layouts/AppLayout';
import { DashboardView } from './features/dashboard/DashboardView';
import { VehicleList } from './features/vehicles/VehicleList';
import { TripsView } from './features/trips/TripsView';
import { MapView } from './features/map/MapView';
import { ProfileView } from './features/profile/ProfileView';
import { VehicleSelector } from './features/vehicles/VehicleSelector';
import { Car } from 'lucide-react';
import { NavigationTab } from './types';
import { EmptyState, ErrorState, LoadingState } from './components/common/CommonComponents';

function MainAppContent() {
  const { session, loading, isConfigured, user } = useAuth();
  const { preferences } = usePreferences();
  const [currentTab, setCurrentTab] = useState<NavigationTab>('dashboard');
  const [vehicleLoad, setVehicleLoad] = useState<{
    userId: string | null; vehicles: Vehicle[]; loading: boolean; error: boolean;
  }>({ userId: null, vehicles: [], loading: true, error: false });
  const [vehicleRefresh, setVehicleRefresh] = useState(0);
  const [moduleSelection, setModuleSelection] = useState<{
    tab: NavigationTab; userId: string; vehicleId: string;
  } | null>(null);
  const userId = user?.id;
  const vehicles = vehicleLoad.userId === userId ? vehicleLoad.vehicles : [];
  const [rawAlerts, setRawAlerts] = useState<Alert[]>([]);
  const [showSetupModal, setShowSetupModal] = useState(false);

  useEffect(() => {
    if (user) {
      alertsService.getAlerts().then(setRawAlerts);
    }
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    setModuleSelection(null);
    setVehicleLoad({ userId: userId ?? null, vehicles: [], loading: true, error: false });
    if (userId) {
      const loadVehicles = async () => {
        try {
          const { data, error } = await supabase.from('vehicles').select('*').eq('user_id', userId);
          if (error) throw error;
          if (!cancelled) setVehicleLoad({ userId,
            vehicles: (data || []).filter(vehicle => vehicle.user_id === userId), loading: false, error: false });
        } catch {
          if (!cancelled) setVehicleLoad({ userId, vehicles: [], loading: false, error: true });
        }
      };
      void loadVehicles();
    }
    return () => { cancelled = true; };
  }, [userId, vehicleRefresh]);

  useEffect(() => {
    if (moduleSelection && (moduleSelection.userId !== userId ||
      !vehicles.some(vehicle => vehicle.id === moduleSelection.vehicleId))) setModuleSelection(null);
  }, [moduleSelection, userId, vehicleLoad]);

  const refreshVehicles = () => {
    setModuleSelection(null);
    setVehicleLoad(value => ({ ...value, vehicles: [], loading: true, error: false }));
    setVehicleRefresh(value => value + 1);
  };

  const navigate = (tab: NavigationTab) => {
    if (tab !== currentTab) {
      setModuleSelection(null);
      // Reload once after managing vehicles, so additions/edits/deletions are reflected.
      if (currentTab === 'vehicles') refreshVehicles();
      setCurrentTab(tab);
    }
  };

  const renderVehicleModule = (title: string, render: (vehicle: Vehicle) => React.ReactNode) => {
    if (vehicleLoad.userId !== userId || vehicleLoad.loading) return <LoadingState message="Carregando veículos..." />;
    if (vehicleLoad.error) return <ErrorState title="Não foi possível carregar os veículos"
      message="Tente novamente para selecionar um veículo." onRetry={refreshVehicles} />;
    if (!vehicles.length) return <EmptyState icon={Car} title="Nenhum veículo cadastrado"
      description="Cadastre um veículo para usar este módulo." actionLabel="IR PARA VEÍCULOS" onAction={() => navigate('vehicles')} />;
    const selectedVehicle = vehicles.length === 1 ? vehicles[0] :
      moduleSelection?.tab === currentTab && moduleSelection.userId === userId ?
        vehicles.find(vehicle => vehicle.id === moduleSelection.vehicleId) : undefined;
    if (!selectedVehicle) return <VehicleSelector vehicles={vehicles}
      onSelect={vehicle => setModuleSelection({ tab: currentTab, userId, vehicleId: vehicle.id })}
      onBack={() => navigate('dashboard')} />;
    return <div key={`${currentTab}:${selectedVehicle.id}`}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-white">{title} — {selectedVehicle.name}</h2>
        {vehicles.length > 1 && <button type="button" onClick={() => setModuleSelection(null)}
          className="rounded-xl border border-blue-900 bg-blue-950/60 px-4 py-2 text-sm font-medium text-blue-300 hover:bg-blue-900/60">
          Trocar veículo
        </button>}
      </div>
      {render(selectedVehicle)}
    </div>;
  };

  const alerts = useMemo(() => {
    return rawAlerts.filter(alert => {
      if (alert.severity === 'PRÓXIMO' && !preferences.alert_upcoming_enabled) return false;
      if (alert.severity === 'URGENTE' && !preferences.alert_urgent_enabled) return false;
      if (alert.severity === 'VENCIDO' && !preferences.alert_overdue_enabled) return false;
      return true;
    });
  }, [rawAlerts, preferences]);

  const criticalAlertCount = useMemo(() => alerts.filter(a => a.severity === 'VENCIDO' || a.severity === 'URGENTE').length, [alerts]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <LoadingState message="Inicializando PH Drive..." />
      </div>
    );
  }

  if (!isConfigured) {
    return <SupabaseSetupModal onConfigured={() => window.location.reload()} />;
  }

  if (!session) {
    return <LoginPage onSetupNeeded={() => setShowSetupModal(true)} />;
  }

  const renderContent = () => {
    switch (currentTab) {
      case 'dashboard':
        return <DashboardView onNavigate={navigate} alerts={alerts} criticalAlertCount={criticalAlertCount} />;
      case 'vehicles':
        return <VehicleList />;
      case 'profile':
      case 'settings':
        return <ProfileView />;
      case 'map':
        return <MapView />;
      case 'trips':
        return <TripsView />;
      case 'fuel':
        return renderVehicleModule('Abastecimentos', vehicle => <FuelModule vehicleId={vehicle.id} />);
      case 'maintenance':
        return renderVehicleModule('Manutenções', vehicle => <MaintenanceModule vehicle={vehicle} />);
      case 'expenses':
        return renderVehicleModule('Despesas', vehicle => <VehicleExpensesModule vehicle={vehicle} />);
      case 'documents':
        return renderVehicleModule('Documentos', vehicle => <DocumentsModule vehicle={vehicle} />);
      case 'tires':
        return renderVehicleModule('Pneus', vehicle => <TiresModule vehicle={vehicle} />);
      case 'reports':
        return renderVehicleModule('Relatórios', vehicle => <ReportsModule vehicle={vehicle} />);
      case 'alerts':
        return <AlertsModule vehicles={vehicles} onNavigate={navigate} />;
      default:
        return <DashboardView onNavigate={navigate} alerts={alerts} criticalAlertCount={criticalAlertCount} />;
    }
  };

  return (
    <AppLayout currentTab={currentTab} onSelectTab={navigate} criticalAlertCount={criticalAlertCount}>
      {renderContent()}
    </AppLayout>
  );
}

import { ErrorBoundary } from './components/common/ErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <PreferencesProvider>
          <MainAppContent />
        </PreferencesProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
