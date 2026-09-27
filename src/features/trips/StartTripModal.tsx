import React, { useState, useEffect } from 'react';
import { X, Navigation, Car, ShieldAlert } from 'lucide-react';
import { Trip, Vehicle } from '../../types';
import { getEffectiveEndOdometer } from './tripUtils';
import { startTripSchema } from './tripValidation';

interface StartTripModalProps {
  isOpen: boolean;
  vehicles: Vehicle[];
  trips: Trip[];
  onClose: () => void;
  onStartTrip: (vehicleId: string, startOdometer: number, originLabel?: string, notes?: string) => Promise<void>;
}

export function StartTripModal({ isOpen, vehicles, trips, onClose, onStartTrip }: StartTripModalProps) {
  const activeVehicles = vehicles.filter(v => v.active);
  const [vehicleId, setVehicleId] = useState<string>(activeVehicles[0]?.id || '');
  const [startOdometer, setStartOdometer] = useState<number>(0);
  const [originLabel, setOriginLabel] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getSuggestedOdometer = (id: string) => {
    const selected = vehicles.find(v => v.id === id);
    if (!selected) return 0;
    
    const vehicleOdometer = selected.odometer_km;
    
    const lastCompletedTrip = trips
      .filter(t => t.vehicle_id === id && t.status === 'COMPLETED')
      .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())[0];
      
    let lastTripOdometer: number | null = null;
    if (lastCompletedTrip) {
        const { odometer } = getEffectiveEndOdometer(lastCompletedTrip);
        lastTripOdometer = odometer;
    }
    
    return Math.max(vehicleOdometer, lastTripOdometer || 0);
  };

  useEffect(() => {
    if (activeVehicles.length > 0 && !vehicleId) {
      const initialId = activeVehicles[0].id;
      setVehicleId(initialId);
      setStartOdometer(getSuggestedOdometer(initialId));
    }
  }, [vehicles, trips]);

  if (!isOpen) return null;

  const handleVehicleChange = (id: string) => {
    setVehicleId(id);
    setStartOdometer(getSuggestedOdometer(id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const validation = startTripSchema.safeParse({
      vehicle_id: vehicleId,
      start_odometer_km: startOdometer,
      origin_label: originLabel,
      notes,
    });

    if (!validation.success) {
      setError(validation.error.issues[0].message);
      return;
    }

    try {
      setLoading(true);
      await onStartTrip(vehicleId, startOdometer, originLabel || undefined, notes || undefined);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao iniciar viagem.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 md:p-8 text-slate-100">
        <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/20 text-blue-400 rounded-xl border border-blue-500/30">
              <Navigation className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Iniciar Nova Viagem</h2>
              <p className="text-xs text-slate-400">Selecione o veículo e confirme o odômetro inicial</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {activeVehicles.length === 0 ? (
          <div className="p-4 bg-amber-950/40 border border-amber-950/60 rounded-xl text-amber-300 text-xs mb-4 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>Você não possui veículos ativos cadastrados para iniciar uma viagem.</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-950/50 border border-red-800/50 text-red-300 text-xs rounded-xl flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Veículo <span className="text-blue-500">*</span>
              </label>
              <select
                value={vehicleId}
                onChange={e => handleVehicleChange(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-blue-600"
              >
                {activeVehicles.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.brand || ''} {v.model || ''} - {v.odometer_km.toLocaleString('pt-BR')} km)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Odômetro Inicial (km) <span className="text-blue-500">*</span>
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                required
                value={startOdometer}
                onChange={e => setStartOdometer(parseFloat(e.target.value) || 0)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-blue-600"
              />
              <p className="text-[11px] text-slate-500 mt-1">Sugerido automaticamente a partir do odômetro atual do veículo.</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Origem (Opcional)</label>
              <input
                type="text"
                value={originLabel}
                onChange={e => setOriginLabel(e.target.value)}
                placeholder="Ex: Casa, Escritório, Garagem"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Observações (Opcional)</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Ex: Reunião com cliente, viagem de rotina..."
                rows={2}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-600 resize-none"
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
                disabled={loading || activeVehicles.length === 0}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium text-sm rounded-xl transition shadow-lg shadow-blue-600/25 flex items-center gap-2"
              >
                <Navigation className="w-4 h-4" />
                <span>{loading ? 'Iniciando...' : 'Iniciar Viagem'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
