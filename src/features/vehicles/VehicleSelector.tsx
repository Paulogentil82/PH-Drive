import React from 'react';
import { ArrowLeft, Bike, Car } from 'lucide-react';
import { Vehicle } from '../../types';
import { PageHeader } from '../../components/common/CommonComponents';
import { usePreferences } from '../profile/PreferencesContext';

interface VehicleSelectorProps {
  vehicles: Vehicle[];
  onSelect: (vehicle: Vehicle) => void;
  onBack?: () => void;
}

export function VehicleSelector({ vehicles, onSelect, onBack }: VehicleSelectorProps) {
  const { formatDistance } = usePreferences();
  return (
    <div>
      <PageHeader title="Escolha um veículo" subtitle="Selecione o veículo para abrir este módulo."
        action={onBack && <button type="button" onClick={onBack}
          className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700">
          <ArrowLeft className="h-4 w-4" /> Voltar para Visão Geral
        </button>} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {vehicles.map(vehicle => {
          const Icon = vehicle.type === 'MOTORCYCLE' ? Bike : Car;
          return (
            <button key={vehicle.id} type="button" onClick={() => onSelect(vehicle)}
              aria-label={`Selecionar ${vehicle.name}`}
              className="rounded-2xl border border-slate-800 bg-slate-900 p-5 text-left transition hover:border-blue-500 hover:bg-slate-800 active:border-blue-400 active:bg-blue-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
              <div className="mb-3 flex items-center gap-3">
                <Icon className="h-6 w-6 shrink-0 text-blue-400" />
                <h2 className="text-lg font-semibold text-white">{vehicle.name}</h2>
              </div>
              <p className="text-sm text-slate-400">{[vehicle.brand, vehicle.model, vehicle.year].filter(Boolean).join(' · ') || 'Marca/modelo não informados'}</p>
              {vehicle.license_plate && <p className="mt-2 text-sm text-slate-300">Placa: {vehicle.license_plate}</p>}
              {vehicle.odometer_km != null && <p className="mt-2 text-sm text-slate-300">Odômetro: {formatDistance(vehicle.odometer_km)}</p>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
