import React, { useState, useEffect } from 'react';
import { 
  Navigation, 
  Plus, 
  Car, 
  Clock, 
  Gauge, 
  MapPin, 
  CheckCircle, 
  Ban, 
  Play, 
  Filter, 
  AlertTriangle,
  Eye,
  Square
} from 'lucide-react';
import { Trip, Vehicle, TripStatus } from '../../types';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/AuthContext';
import { PageHeader, EmptyState, LoadingState, ErrorState, ConfirmDialog } from '../../components/common/CommonComponents';
import { StartTripModal } from './StartTripModal';
import { EndTripModal } from './EndTripModal';
import { TripDetailModal } from './TripDetailModal';
import { calculateTripMetrics } from './tripValidation';

export function TripsView() {
  const { user } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [isStartModalOpen, setIsStartModalOpen] = useState(false);
  const [endModalTrip, setEndModalTrip] = useState<Trip | null>(null);
  const [detailModalTrip, setDetailModalTrip] = useState<Trip | null>(null);
  const [cancelTripId, setCancelTripId] = useState<string | null>(null);

  // Filters
  const [filterVehicleId, setFilterVehicleId] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  const fetchData = async () => {
    if (!user) return;
    try {
      setLoading(true);
      setError(null);

      // Fetch vehicles
      const { data: vData, error: vError } = await supabase
        .from('vehicles')
        .select('*')
        .eq('user_id', user.id);

      if (vError) throw vError;
      setVehicles(vData || []);

      // Fetch trips with vehicle relation if possible or map manually
      const { data: tData, error: tError } = await supabase
        .from('trips')
        .select('*, vehicle:vehicles(*)')
        .eq('user_id', user.id)
        .order('started_at', { ascending: false });

      if (tError) throw tError;
      setTrips(tData || []);
    } catch (err: any) {
      console.error('Error fetching trips:', err);
      setError(err.message || 'Erro ao carregar dados de viagens.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleStartTrip = async (vehicleId: string, startOdometer: number, originLabel?: string, notes?: string) => {
    if (!user) return;

    // Check if vehicle already has an active trip
    const activeForVehicle = trips.find(t => t.vehicle_id === vehicleId && t.status === 'IN_PROGRESS');
    if (activeForVehicle) {
      throw new Error('Este veículo já possui uma viagem em andamento.');
    }

    const { error } = await supabase
      .from('trips')
      .insert({
        user_id: user.id,
        vehicle_id: vehicleId,
        status: 'IN_PROGRESS',
        started_at: new Date().toISOString(),
        start_odometer_km: startOdometer,
        origin_label: originLabel || null,
        notes: notes || null,
      });

    if (error) {
      if (error.code === '23505' || error.message?.includes('trips_one_in_progress_per_vehicle')) {
        throw new Error('Este veículo já possui uma viagem em andamento.');
      }
      throw error;
    }

    await fetchData();
  };

  const handleEndTrip = async (tripId: string, endOdometer: number, destinationLabel?: string, distanceKm?: number) => {
    if (!user) return;
    const tripToEnds = trips.find(t => t.id === tripId);
    if (!tripToEnds) return;

    const endedAt = new Date().toISOString();
    const metrics = calculateTripMetrics(tripToEnds.started_at, endedAt, tripToEnds.start_odometer_km, endOdometer);

    const finalDistance = distanceKm !== undefined ? distanceKm : metrics.distanceKm;

    // Update trip
    const { error: updateError } = await supabase
      .from('trips')
      .update({
        status: 'COMPLETED',
        ended_at: endedAt,
        end_odometer_km: endOdometer,
        distance_km: finalDistance,
        duration_seconds: metrics.durationSeconds,
        destination_label: destinationLabel || null,
      })
      .eq('id', tripId)
      .eq('user_id', user.id);

    if (updateError) throw updateError;

    // Update vehicle odometer if higher
    const vehicle = vehicles.find(v => v.id === tripToEnds.vehicle_id);
    if (vehicle && endOdometer > vehicle.odometer_km) {
      await supabase
        .from('vehicles')
        .update({ odometer_km: endOdometer })
        .eq('id', vehicle.id)
        .eq('user_id', user.id);
    }

    await fetchData();
  };

  const handleCancelTrip = async () => {
    if (!cancelTripId || !user) return;
    try {
      const { error } = await supabase
        .from('trips')
        .update({ status: 'CANCELLED' })
        .eq('id', cancelTripId)
        .eq('user_id', user.id);

      if (error) throw error;
      setCancelTripId(null);
      await fetchData();
    } catch (err: any) {
      alert('Erro ao cancelar viagem: ' + err.message);
    }
  };

  if (loading) {
    return <LoadingState message="Carregando viagens..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={fetchData} />;
  }

  const activeTrip = trips.find(t => t.status === 'IN_PROGRESS');

  const filteredTrips = trips.filter(t => {
    if (filterVehicleId !== 'ALL' && t.vehicle_id !== filterVehicleId) return false;
    if (filterStatus !== 'ALL' && t.status !== filterStatus) return false;
    return true;
  });

  return (
    <div>
      <PageHeader
        title="Gerenciamento de Viagens"
        subtitle="Controle manual de trajetos, quilometragem e histórico"
        action={
          <button
            onClick={() => setIsStartModalOpen(true)}
            disabled={Boolean(activeTrip)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium text-sm rounded-xl transition shadow-lg shadow-blue-600/25"
          >
            <Play className="w-4 h-4" />
            <span>{activeTrip ? 'Viagem em Andamento' : 'Iniciar Viagem'}</span>
          </button>
        }
      />

      {/* Viagem em Andamento Card (Destaque) */}
      {activeTrip && (
        <div className="mb-8 bg-gradient-to-r from-blue-950/80 via-slate-900 to-slate-900 border border-blue-500/30 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <Navigation className="w-40 h-40 text-blue-400" />
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-full text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                <span>Viagem em Andamento</span>
              </div>
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Car className="w-5 h-5 text-blue-400" />
                <span>{activeTrip.vehicle?.name || 'Veículo em uso'}</span>
              </h3>
              <p className="text-xs text-slate-400">
                Início: {new Date(activeTrip.started_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} • 
                Odômetro Inicial: <strong className="text-white">{activeTrip.start_odometer_km?.toLocaleString('pt-BR')} km</strong>
                {activeTrip.origin_label && ` • Origem: ${activeTrip.origin_label}`}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setCancelTripId(activeTrip.id)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs rounded-xl transition border border-slate-700 flex items-center gap-1.5"
              >
                <Ban className="w-3.5 h-3.5 text-red-400" />
                <span>Cancelar</span>
              </button>
              <button
                onClick={() => setEndModalTrip(activeTrip)}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-xl transition shadow-lg shadow-emerald-600/20 flex items-center gap-2"
              >
                <Square className="w-4 h-4 fill-white" />
                <span>Encerrar Viagem</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters Toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
          <Filter className="w-4 h-4 text-blue-400" />
          <span>Filtros do Histórico:</span>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <select
            value={filterVehicleId}
            onChange={e => setFilterVehicleId(e.target.value)}
            className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-600 flex-1 sm:flex-none"
          >
            <option value="ALL">Todos os Veículos</option>
            {vehicles.map(v => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-600 flex-1 sm:flex-none"
          >
            <option value="ALL">Todos os Status</option>
            <option value="COMPLETED">Concluídas</option>
            <option value="IN_PROGRESS">Em Andamento</option>
            <option value="CANCELLED">Canceladas</option>
          </select>
        </div>
      </div>

      {/* Histórico de Viagens */}
      {filteredTrips.length === 0 ? (
        <EmptyState
          icon={Navigation}
          title="Nenhuma viagem encontrada"
          description="Você ainda não registrou nenhuma viagem com os filtros selecionados."
          actionLabel="Iniciar primeira viagem"
          onAction={() => setIsStartModalOpen(true)}
        />
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-xs font-semibold text-slate-400">
                  <th className="p-4">Data / Hora</th>
                  <th className="p-4">Veículo</th>
                  <th className="p-4">Rota (Origem → Destino)</th>
                  <th className="p-4">Distância</th>
                  <th className="p-4">Duração</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-sm">
                {filteredTrips.map(trip => {
                  const dateStr = new Date(trip.started_at).toLocaleDateString('pt-BR');
                  const timeStr = new Date(trip.started_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                  const durationMins = trip.duration_seconds ? Math.round(trip.duration_seconds / 60) : null;

                  return (
                    <tr key={trip.id} className="hover:bg-slate-800/40 transition">
                      <td className="p-4">
                        <div className="font-medium text-white">{dateStr}</div>
                        <div className="text-xs text-slate-400">{timeStr}</div>
                      </td>
                      <td className="p-4 font-medium text-slate-200">
                        {trip.vehicle?.name || 'Veículo'}
                      </td>
                      <td className="p-4">
                        <div className="text-slate-200">{trip.origin_label || 'Origem não informada'}</div>
                        <div className="text-xs text-slate-400">↓ {trip.destination_label || 'Destino não informado'}</div>
                      </td>
                      <td className="p-4 font-semibold text-white">
                        {trip.distance_km !== null ? `${trip.distance_km} km` : '—'}
                      </td>
                      <td className="p-4 text-slate-300">
                        {durationMins !== null ? `${durationMins} min` : '—'}
                      </td>
                      <td className="p-4">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                          trip.status === 'COMPLETED' ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/50' :
                          trip.status === 'IN_PROGRESS' ? 'bg-blue-950/60 text-blue-400 border border-blue-800/50' :
                          'bg-red-950/60 text-red-400 border border-red-800/50'
                        }`}>
                          {trip.status === 'COMPLETED' ? 'Concluída' : trip.status === 'IN_PROGRESS' ? 'Em Andamento' : 'Cancelada'}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setDetailModalTrip(trip)}
                            className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition"
                            title="Ver detalhes"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {trip.status === 'IN_PROGRESS' && (
                            <button
                              onClick={() => setEndModalTrip(trip)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-xl transition shadow"
                            >
                              Encerrar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      <StartTripModal
        isOpen={isStartModalOpen}
        vehicles={vehicles}
        trips={trips}
        onClose={() => setIsStartModalOpen(false)}
        onStartTrip={handleStartTrip}
      />

      <EndTripModal
        isOpen={Boolean(endModalTrip)}
        trip={endModalTrip}
        onClose={() => setEndModalTrip(null)}
        onEndTrip={handleEndTrip}
      />

      <TripDetailModal
        isOpen={Boolean(detailModalTrip)}
        trip={detailModalTrip}
        onClose={() => setDetailModalTrip(null)}
      />

      <ConfirmDialog
        isOpen={Boolean(cancelTripId)}
        title="Cancelar Viagem"
        message="Tem certeza que deseja cancelar esta viagem em andamento? Ela não será contabilizada para quilometragem."
        confirmLabel="Sim, cancelar viagem"
        cancelLabel="Voltar"
        danger={true}
        onConfirm={handleCancelTrip}
        onCancel={() => setCancelTripId(null)}
      />
    </div>
  );
}
