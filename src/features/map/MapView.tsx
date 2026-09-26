import React, { useState, useEffect } from 'react';
import { Map, Navigation, Car, Calendar, Filter, Eye, ShieldAlert } from 'lucide-react';
import { Vehicle, Trip, TripPoint } from '../../types';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/AuthContext';
import { listTripPoints } from '../trips/tripPointsService';
import { TripMap } from '../../components/common/TripMap';
import { PageHeader, LoadingState, ErrorState, EmptyState } from '../../components/common/CommonComponents';

export function MapView() {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('ALL');
  const [selectedTripId, setSelectedTripId] = useState<string>('');
  const [currentTripPoints, setCurrentTripPoints] = useState<TripPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPoints, setLoadingPoints] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    try {
      setLoading(true);
      setError(null);

      const [vRes, tRes] = await Promise.all([
        supabase.from('vehicles').select('*').eq('user_id', user.id),
        supabase.from('trips').select('*, vehicle:vehicles(*)').eq('user_id', user.id).order('started_at', { ascending: false })
      ]);

      if (vRes.error) throw vRes.error;
      if (tRes.error) throw tRes.error;

      setVehicles(vRes.data || []);
      const allTrips = tRes.data || [];
      setTrips(allTrips);

      // Selecionar por padrão a primeira viagem se houver
      if (allTrips.length > 0 && !selectedTripId) {
        setSelectedTripId(allTrips[0].id);
        if (allTrips[0].vehicle_id) {
          setSelectedVehicleId(allTrips[0].vehicle_id);
        }
      }
    } catch (err: any) {
      console.error('Error fetching map data:', err);
      setError(err.message || 'Erro ao carregar dados do mapa.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedTripId) {
      loadTripPointsForTrip(selectedTripId);
    } else {
      setCurrentTripPoints([]);
    }
  }, [selectedTripId]);

  const loadTripPointsForTrip = async (tripId: string) => {
    try {
      setLoadingPoints(true);
      const points = await listTripPoints(tripId);
      setCurrentTripPoints(points);
    } catch (err) {
      console.error('Error loading trip points for map:', err);
      setCurrentTripPoints([]);
    } finally {
      setLoadingPoints(false);
    }
  };

  if (loading) {
    return <LoadingState message="Carregando mapa e trajetos..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={fetchData} />;
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
                  {new Date(t.started_at).toLocaleDateString('pt-BR')} - {t.origin_label || 'Início'} → {t.destination_label || 'Fim'} ({t.distance_km ?? 0} km)
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
            <span className="text-sm font-bold text-blue-400">{currentTripPoints.length} pontos</span>
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
          {loadingPoints ? (
            <div className="h-[500px] bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-center text-slate-400">
              Carregando pontos do trajeto...
            </div>
          ) : (
            <TripMap points={currentTripPoints} height="520px" />
          )}
        </div>
      )}
    </div>
  );
}
