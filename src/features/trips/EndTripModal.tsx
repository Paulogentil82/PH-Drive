import React, { useState, useEffect } from 'react';
import { X, CheckCircle, ShieldAlert, Gauge } from 'lucide-react';
import { Trip } from '../../types';
import { endTripSchema } from './tripValidation';

interface EndTripModalProps {
  isOpen: boolean;
  trip: Trip | null;
  onClose: () => void;
  onEndTrip: (tripId: string, endOdometer: number, destinationLabel?: string, distanceKm?: number) => Promise<void>;
}

export function EndTripModal({ isOpen, trip, onClose, onEndTrip }: EndTripModalProps) {
  const startOdometer = trip?.start_odometer_km ?? 0;
  const [endOdometer, setEndOdometer] = useState<number>(startOdometer);
  const [destinationLabel, setDestinationLabel] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [odometerWarning, setOdometerWarning] = useState<string | null>(null);

  useEffect(() => {
    if (trip) {
      const initial = trip.start_odometer_km ?? 0;
      setEndOdometer(initial);
      setDestinationLabel('');
      setOdometerWarning(null);
      setError(null);
    }
  }, [trip, isOpen]);

  if (!isOpen || !trip) return null;

  const handleOdometerChange = (val: number) => {
    setEndOdometer(val);
    const start = trip.start_odometer_km ?? 0;
    if (val < start) {
      setOdometerWarning('O odômetro final é inferior ao odômetro inicial registrado.');
    } else {
      setOdometerWarning(null);
    }
  };

  const calculatedDistance = Math.max(0, Number((endOdometer - (trip.start_odometer_km ?? endOdometer)).toFixed(2)));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const validation = endTripSchema.safeParse({
      end_odometer_km: endOdometer,
      destination_label: destinationLabel,
      distance_km: calculatedDistance,
    });

    if (!validation.success) {
      setError(validation.error.issues[0].message);
      return;
    }

    if (trip.start_odometer_km !== null && endOdometer < trip.start_odometer_km) {
      setError('O odômetro final não pode ser menor que o odômetro inicial.');
      return;
    }

    try {
      setLoading(true);
      await onEndTrip(trip.id, endOdometer, destinationLabel || undefined, calculatedDistance);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao encerrar viagem.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 md:p-8 text-slate-100">
        <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-600/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Encerrar Viagem</h2>
              <p className="text-xs text-slate-400">
                {trip.vehicle?.name || 'Veículo'} • Início: {new Date(trip.started_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-950/50 border border-red-800/50 text-red-300 text-xs rounded-xl flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs">
            <div>
              <span className="text-slate-500 block">Odômetro Inicial</span>
              <span className="font-semibold text-white text-sm">{trip.start_odometer_km?.toLocaleString('pt-BR') ?? 0} km</span>
            </div>
            <div>
              <span className="text-slate-500 block">Distância Calculada</span>
              <span className="font-semibold text-emerald-400 text-sm">{calculatedDistance} km</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Odômetro Final (km) <span className="text-blue-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <Gauge className="w-4 h-4" />
              </span>
              <input
                type="number"
                step="0.1"
                min={trip.start_odometer_km ?? 0}
                required
                value={endOdometer}
                onChange={e => handleOdometerChange(parseFloat(e.target.value) || 0)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-blue-600"
              />
            </div>
            {odometerWarning && (
              <div className="mt-1.5 p-2 bg-amber-950/40 border border-amber-800/50 rounded-xl text-amber-300 text-xs flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400" />
                <span>{odometerWarning}</span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Destino (Opcional)</label>
            <input
              type="text"
              value={destinationLabel}
              onChange={e => setDestinationLabel(e.target.value)}
              placeholder="Ex: Trabalho, Cliente ABC, Casa"
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-600"
            />
          </div>

          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-sm rounded-xl transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium text-sm rounded-xl transition shadow-lg shadow-emerald-600/25 flex items-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              <span>{loading ? 'Encerrando...' : 'Confirmar Encerramento'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
