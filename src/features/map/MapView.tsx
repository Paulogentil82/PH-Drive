import { effectiveTripDistance } from '../../utils/tripMetrics';
import React, { useState, useEffect, useRef } from 'react';
import { Map, Navigation, Car, Calendar, Filter, Eye, ShieldAlert } from 'lucide-react';
import { Vehicle, Trip } from '../../types';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/AuthContext';
import { TripPointsContent } from '../../components/common/TripPointsContent';
import { useTripPoints } from '../trips/useTripPoints';
import { backendErrorMessage, classifyBackendError, runBackendRead } from '../../lib/backendDiagnostics';
import { PageHeader, LoadingState, ErrorState, EmptyState } from '../../components/common/CommonComponents';

export function MapView() {
  const { user, signOut } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('ALL');
  const [selectedTripId, setSelectedTripId] = useState<string>('');
  const pointState = useTripPoints(selectedTripId || null, user?.id);
  const currentTripPoints = pointState.points;
  const dataRequest = useRef(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authError, setAuthError] = useState(false);

  useEffect(() => {
    if (!user) return;
    setSelectedTripId('');
    setSelectedVehicleId('ALL');
    void fetchData();
    return () => { dataRequest.current++; };
  }, [user?.id]);

  const fetchData = async () => {
    if (!user) return;
    const request = ++dataRequest.current;
    try {
      setLoading(true);
      setError(null);
      setAuthError(false);

      const [vehicleData, tripData] = await Promise.all([
        runBackendRead<Vehicle[] | null>('map_vehicles', signal => supabase.from('vehicles').select('*').eq('user_id', user.id).abortSignal(signal)),
        runBackendRead<Trip[] | null>('map_trips', signal => supabase.from('trips').select('*, vehicle:vehicles(*)').eq('user_id', user.id).order('started_at', { ascending: false }).abortSignal(signal))
      ]);
      if (request !== dataRequest.current) return;
      setVehicles(vehicleData || []);
      const allTrips = tripData || [];
      setTrips(allTrips);

      // Selecionar por padrão a primeira viagem se houver
      if (allTrips.length > 0 && !selectedTripId) {
        setSelectedTripId(allTrips[0].id);
        if (allTrips[0].vehicle_id) {
          setSelectedVehicleId(allTrips[0].vehicle_id);
        }
      }
    } catch (err: any) {
      if (request !== dataRequest.current) return;
      const info = classifyBackendError(err);
      setAuthError(info.kind === 'AUTH');
      setError(backendErrorMessage(info.kind));
    } finally {
      if (request === dataRequest.current) setLoading(false);
    }
  };

  if (loading) {
    return <LoadingState message="Carregando mapa e trajetos..." />;
  }

  if (error) {
    return <><ErrorState message={error} onRetry={fetchData} />{authError && <button type="button" onClick={() => void signOut()} className="text-blue-400">Entrar novamente</button>}</>;
  }

  // Filtrar viagens pelo veículo selecionado
  const filteredTrips = trips.filter(t => {
    if (selectedVehicleId !== 'ALL' && t.vehicle_id !== selectedVehicleId) return false;
    return true;
  });

  const selectedTrip = trips.find(t => t.id === selectedTripId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mapa de Trajetos"
        subtitle="Visualização geoespacial e reconstrução de rotas das viagens registradas"
      />

      {/* Seletor de Veículo e Viagem */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 md:p-6 shadow-xl grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5">Filtrar por Veículo</label>
          <select
            value={selectedVehicleId}
            onChange={e => {
              setSelectedVehicleId(e.target.value);
              // resetar trip se não pertencer ao veículo
              const matchingTrips = trips.filter(t => e.target.value === 'ALL' || t.vehicle_id === e.target.value);
              if (matchingTrips.length > 0) {
                setSelectedTripId(matchingTrips[0].id);
              } else {
                setSelectedTripId('');
              }
            }}
            className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-blue-600"
          >
            <option value="ALL">Todos os Veículos</option>
            {vehicles.map(v => (
              <option key={v.id} value={v.id}>{v.name} ({v.brand || ''} {v.model || ''})</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5">Selecionar Viagem</label>
          <select
            value={selectedTripId}
            onChange={e => setSelectedTripId(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-blue-600"
          >
            {filteredTrips.length === 0 ? (
              <option value="">Nenhuma viagem disponível</option>
            ) : (
              filteredTrips.map(t => (
                <option key={t.id} value={t.id}>
                  {new Date(t.started_at).toLocaleDateString('pt-BR')} - {t.origin_label || 'Início'} → {t.destination_label || 'Fim'} ({effectiveTripDistance(t)} km)
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      {/* Info da Viagem Selecionada */}
      {selectedTrip && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <span className="text-xs text-slate-500 block mb-1">Veículo</span>
            <span className="text-sm font-bold text-white truncate block">{selectedTrip.vehicle?.name || '—'}</span>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <span className="text-xs text-slate-500 block mb-1">Distância Odômetro</span>
            <span className="text-sm font-bold text-white">{selectedTrip.distance_km ?? 0} km</span>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <span className="text-xs text-slate-500 block mb-1">Distância GPS</span>
            <span className="text-sm font-bold text-emerald-400">{selectedTrip.gps_distance_km ?? 0} km</span>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <span className="text-xs text-slate-500 block mb-1">Pontos GPS</span>
            <span className="text-sm font-bold text-blue-400">{pointState.status === 'SUCCESS_WITH_POINTS' || pointState.status === 'SUCCESS_EMPTY' ? `${currentTripPoints.length} pontos` : '—'}</span>
          </div>
        </div>
      )}

      {/* Área do Mapa */}
      {trips.length === 0 ? (
        <EmptyState
          icon={Map}
          title="Nenhuma viagem registrada"
          description="Registre ou conclua viagens para visualizar os trajetos no mapa."
        />
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
          <TripPointsContent state={pointState} onRetry={pointState.retry} onSignIn={() => void signOut()} height="520px" />
        </div>
      )}
    </div>
  );
}
