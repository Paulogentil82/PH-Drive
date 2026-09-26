import React, { useState, useEffect } from 'react';
import { X, Navigation, Calendar, Clock, Gauge, MapPin, FileText, CheckCircle, Ban, AlertCircle, Sparkles } from 'lucide-react';
import { Trip, TripPoint } from '../../types';
import { listTripPoints, addHomologationTestPoints, calculateTripComparison, calculateGpsDistance } from './tripPointsService';
import { TripMap } from '../../components/common/TripMap';
import { useAuth } from '../auth/AuthContext';

interface TripDetailModalProps {
  isOpen: boolean;
  trip: Trip | null;
  onClose: () => void;
  onTripUpdated?: () => void;
}

export function TripDetailModal({ isOpen, trip, onClose, onTripUpdated }: TripDetailModalProps) {
  const { user } = useAuth();
  const [points, setPoints] = useState<TripPoint[]>([]);
  const [loadingPoints, setLoadingPoints] = useState(false);
  const [addingTest, setAddingTest] = useState(false);

  useEffect(() => {
    if (isOpen && trip) {
      fetchPoints(trip.id);
    } else {
      setPoints([]);
    }
  }, [isOpen, trip]);

  const fetchPoints = async (tripId: string) => {
    try {
      setLoadingPoints(true);
      const data = await listTripPoints(tripId);
      setPoints(data);
    } catch (err) {
      console.error('Error loading trip points:', err);
    } finally {
      setLoadingPoints(false);
    }
  };

  const handleAddHomologationPoints = async () => {
    if (!trip || !user) return;
    try {
      setAddingTest(true);
      await addHomologationTestPoints(trip.id, user.id);
      await fetchPoints(trip.id);
      if (onTripUpdated) onTripUpdated();
    } catch (err: any) {
      alert('Erro ao gerar pontos de teste: ' + err.message);
    } finally {
      setAddingTest(false);
    }
  };

  if (!isOpen || !trip) return null;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds && seconds !== 0) return 'N/D';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}min`;
    return `${mins} min`;
  };

  // Comparação de Distância Odômetro vs GPS
  const odometerDistance = trip.distance_km;
  const gpsDistance = trip.gps_distance_km ?? (points.length > 0 ? calculateGpsDistance(points) : null);
  const comparison = calculateTripComparison(odometerDistance, gpsDistance);

  // Verificar pontos com baixa precisão (> 100m)
  const lowAccuracyCount = points.filter(p => p.accuracy_meters !== null && p.accuracy_meters > 100).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 md:p-8 text-slate-100 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/20 text-blue-400 rounded-xl border border-blue-500/30">
              <Navigation className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Detalhes da Viagem & Trajeto</h2>
              <p className="text-xs text-slate-400">{trip.vehicle?.name || 'Veículo'} • {formatDate(trip.started_at)}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6 text-xs">
          {/* Status e Homologation Dev Helper (Se 0 pontos) */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 bg-slate-950 border border-slate-800 rounded-xl">
            <div className="flex items-center gap-3">
              <span className="text-slate-400">Status</span>
              <span className={`font-semibold px-2.5 py-1 rounded-full text-[11px] ${
                trip.status === 'COMPLETED' ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/50' :
                trip.status === 'IN_PROGRESS' ? 'bg-blue-950/60 text-blue-400 border border-blue-800/50' :
                'bg-red-950/60 text-red-400 border border-red-800/50'
              }`}>
                {trip.status === 'COMPLETED' ? 'Concluída' : trip.status === 'IN_PROGRESS' ? 'Em Andamento' : 'Cancelada'}
              </span>
            </div>

            {/* Botão de Homologação / Teste em Dev */}
            {points.length === 0 && trip.status === 'COMPLETED' && (
              <button
                onClick={handleAddHomologationPoints}
                disabled={addingTest}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-xl transition font-medium"
                title="Inserir pontos de teste para homologação do mapa e GPS"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>{addingTest ? 'Gerando...' : 'Gerar Pontos de Teste (Dev)'}</span>
              </button>
            )}
          </div>

          {/* MAPA DO TRAJETO */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-slate-300 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-400" />
                <span>Reconstrução do Trajeto (MapLibre & GPS)</span>
              </h3>
              <span className="text-slate-500 text-[11px]">
                {points.length} {points.length === 1 ? 'ponto registrado' : 'pontos registrados'}
              </span>
            </div>
            {loadingPoints ? (
              <div className="h-[300px] bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-center text-slate-500">
                Carregando pontos de GPS...
              </div>
            ) : (
              <TripMap points={points} height="300px" />
            )}
            {lowAccuracyCount > 0 && (
              <div className="mt-2 p-2 bg-amber-950/30 border border-amber-800/40 rounded-xl text-amber-300 text-[11px] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Atenção: {lowAccuracyCount} {lowAccuracyCount === 1 ? 'ponto possui' : 'pontos possuem'} precisão inferior a 100m (baixa precisão).</span>
              </div>
            )}
          </div>

          {/* COMPARAÇÃO ODÔMETRO VS GPS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
              <span className="text-slate-500 block mb-1">Odômetro (Referência)</span>
              <span className="text-lg font-bold text-white">
                {odometerDistance !== null && odometerDistance !== undefined ? `${odometerDistance} km` : '—'}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Início: {trip.start_odometer_km ?? '—'} | Fim: {trip.end_odometer_km ?? '—'}</span>
            </div>
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
              <span className="text-slate-500 block mb-1">GPS (Calculado Haversine)</span>
              <span className="text-lg font-bold text-emerald-400">
                {gpsDistance !== null && gpsDistance !== undefined ? `${gpsDistance} km` : '—'}
              </span>
              {comparison.hasComparison ? (
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Diferença: {comparison.differenceKm} km ({comparison.differencePercent}%)
                </span>
              ) : (
                <span className="text-[10px] text-slate-500 block mt-0.5">Comparação indisponível</span>
              )}
            </div>
          </div>

          {/* Outras Informações */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
              <span className="text-slate-500 block mb-1">Duração</span>
              <span className="font-semibold text-slate-200">{formatDuration(trip.duration_seconds)}</span>
            </div>
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
              <span className="text-slate-500 block mb-1">Origem → Destino</span>
              <span className="font-semibold text-slate-200 truncate block">
                {trip.origin_label || '—'} → {trip.destination_label || '—'}
              </span>
            </div>
          </div>

          {trip.notes && (
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
              <span className="text-slate-500 block mb-1">Observações</span>
              <p className="text-slate-300">{trip.notes}</p>
            </div>
          )}
        </div>

        <div className="mt-6 pt-4 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs rounded-xl transition"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

function calculateGpsDistanceMock(pts: TripPoint[]): number {
  if (pts.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const R = 6371;
    const dLat = (p2.latitude - p1.latitude) * (Math.PI / 180);
    const dLon = (p2.longitude - p1.longitude) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(p1.latitude * (Math.PI / 180)) * Math.cos(p2.latitude * (Math.PI / 180)) * Math.sin(dLon / 2) ** 2;
    total += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  return Number(total.toFixed(2));
}
