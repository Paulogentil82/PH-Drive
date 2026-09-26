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
import { DevelopmentView } from './features/development/DevelopmentView';
import { NavigationTab } from './types';
import { LoadingState } from './components/common/CommonComponents';

function MainAppContent() {
  const { session, loading, isConfigured, user } = useAuth();
  const { preferences } = usePreferences();
  const [currentTab, setCurrentTab] = useState<NavigationTab>('dashboard');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [rawAlerts, setRawAlerts] = useState<Alert[]>([]);
  const [showSetupModal, setShowSetupModal] = useState(false);

  useEffect(() => {
    if (user) {
      supabase.from('vehicles').select('*').eq('user_id', user.id).then(({ data }) => setVehicles(data || []));
      alertsService.getAlerts().then(setRawAlerts);
    }
  }, [user]);

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
        return <DashboardView onNavigate={(tab) => setCurrentTab(tab)} alerts={alerts} criticalAlertCount={criticalAlertCount} />;
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
        if (vehicles.length === 1) return <FuelModule vehicleId={vehicles[0].id} />;
        return <DevelopmentView title="Selecione um veículo" description="Funcionalidade de múltiplos veículos em desenvolvimento." onBack={() => setCurrentTab('dashboard')} />;
      case 'maintenance':
        if (vehicles.length === 1) return <MaintenanceModule vehicle={vehicles[0]} />;
        return <DevelopmentView title="Selecione um veículo" description="Funcionalidade de múltiplos veículos em desenvolvimento." onBack={() => setCurrentTab('dashboard')} />;
      case 'expenses':
        if (vehicles.length === 1) return <VehicleExpensesModule vehicle={vehicles[0]} />;
        return <DevelopmentView title="Selecione um veículo" description="Funcionalidade de múltiplos veículos em desenvolvimento." onBack={() => setCurrentTab('dashboard')} />;
      case 'documents':
        if (vehicles.length === 1) return <DocumentsModule vehicle={vehicles[0]} />;
        return <DevelopmentView title="Selecione um veículo" description="Funcionalidade de múltiplos veículos em desenvolvimento." onBack={() => setCurrentTab('dashboard')} />;
      case 'tires':
        if (vehicles.length === 1) return <TiresModule vehicle={vehicles[0]} />;
        return <DevelopmentView title="Selecione um veículo" description="Funcionalidade de múltiplos veículos em desenvolvimento." onBack={() => setCurrentTab('dashboard')} />;
      case 'reports':
        if (vehicles.length === 1) return <ReportsModule vehicle={vehicles[0]} />;
        return <DevelopmentView title="Selecione um veículo" description="Funcionalidade de múltiplos veículos em desenvolvimento." onBack={() => setCurrentTab('dashboard')} />;
      case 'alerts':
        return <AlertsModule vehicles={vehicles} onNavigate={setCurrentTab} />;
      default:
        return <DashboardView onNavigate={(tab) => setCurrentTab(tab)} alerts={alerts} criticalAlertCount={criticalAlertCount} />;
    }
  };

  return (
    <AppLayout currentTab={currentTab} onSelectTab={setCurrentTab} criticalAlertCount={criticalAlertCount}>
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
