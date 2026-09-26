import React, { useState, useEffect } from 'react';
import { X, Car, Bike, ShieldAlert } from 'lucide-react';
import { Vehicle, VehicleFormData, VehicleType, FuelType } from '../../types';

interface VehicleModalProps {
  isOpen: boolean;
  vehicleToEdit?: Vehicle | null;
  onClose: () => void;
  onSave: (data: VehicleFormData, isEditing: boolean, currentOdometer: number) => Promise<void>;
}

export function VehicleModal({ isOpen, vehicleToEdit, onClose, onSave }: VehicleModalProps) {
  const [formData, setFormData] = useState<VehicleFormData>({
    name: '',
    type: 'CAR',
    brand: '',
    model: '',
    version: '',
    year: new Date().getFullYear(),
    license_plate: '',
    fuel_type: 'FLEX',
    odometer_km: 0,
    tank_capacity_liters: 50,
    average_consumption_km_l: 10,
    image_url: '',
    bluetooth_name: '',
    active: true,
  });

  const [odometerWarning, setOdometerWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (vehicleToEdit) {
      setFormData({
        name: vehicleToEdit.name,
        type: vehicleToEdit.type,
        brand: vehicleToEdit.brand || '',
        model: vehicleToEdit.model || '',
        version: vehicleToEdit.version || '',
        year: vehicleToEdit.year || new Date().getFullYear(),
        license_plate: vehicleToEdit.license_plate || '',
        fuel_type: vehicleToEdit.fuel_type || 'FLEX',
        odometer_km: vehicleToEdit.odometer_km,
        tank_capacity_liters: vehicleToEdit.tank_capacity_liters || 50,
        average_consumption_km_l: vehicleToEdit.average_consumption_km_l || 10,
        image_url: vehicleToEdit.image_url || '',
        bluetooth_name: vehicleToEdit.bluetooth_name || '',
        active: vehicleToEdit.active,
      });
    } else {
      setFormData({
        name: '',
        type: 'CAR',
        brand: '',
        model: '',
        version: '',
        year: new Date().getFullYear(),
        license_plate: '',
        fuel_type: 'FLEX',
        odometer_km: 0,
        tank_capacity_liters: 50,
        average_consumption_km_l: 10,
        image_url: '',
        bluetooth_name: '',
        active: true,
      });
    }
    setOdometerWarning(null);
    setError(null);
  }, [vehicleToEdit, isOpen]);

  if (!isOpen) return null;

  const handleOdometerChange = (val: number) => {
    setFormData(prev => ({ ...prev, odometer_km: val }));
    if (vehicleToEdit && val < vehicleToEdit.odometer_km) {
      setOdometerWarning('O novo odômetro é inferior ao valor registrado atualmente.');
    } else {
      setOdometerWarning(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.odometer_km < 0) {
      setError('O odômetro não pode ser negativo.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await onSave(formData, Boolean(vehicleToEdit), vehicleToEdit ? vehicleToEdit.odometer_km : 0);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar veículo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 md:p-8 text-slate-100 my-8">
        <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/20 text-blue-400 rounded-xl border border-blue-500/30">
              <Car className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                {vehicleToEdit ? 'Editar Veículo' : 'Cadastrar Novo Veículo'}
              </h2>
              <p className="text-xs text-slate-400">Preencha os dados técnicos do veículo</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-950/50 border border-red-800/50 text-red-300 text-xs rounded-xl flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Name */}
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Nome do Veículo <span className="text-blue-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Meu Civic, Moto Principal"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-600"
              />
            </div>

            {/* Type */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Tipo <span className="text-blue-500">*</span>
              </label>
              <select
                value={formData.type}
                onChange={e => setFormData({ ...formData, type: e.target.value as VehicleType })}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-blue-600"
              >
                <option value="CAR">Carro (CAR)</option>
                <option value="MOTORCYCLE">Moto (MOTORCYCLE)</option>
              </select>
            </div>

            {/* Brand */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Marca</label>
              <input
                type="text"
                value={formData.brand}
                onChange={e => setFormData({ ...formData, brand: e.target.value })}
                placeholder="Ex: Honda, Toyota, Yamaha"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-600"
              />
            </div>

            {/* Model */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Modelo</label>
              <input
                type="text"
                value={formData.model}
                onChange={e => setFormData({ ...formData, model: e.target.value })}
                placeholder="Ex: Civic, Corolla, Fazer 250"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-600"
              />
            </div>

            {/* Version */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Versão</label>
              <input
                type="text"
                value={formData.version}
                onChange={e => setFormData({ ...formData, version: e.target.value })}
                placeholder="Ex: EXL 2.0, ABS"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-600"
              />
            </div>

            {/* Year */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Ano</label>
              <input
                type="number"
                value={formData.year || ''}
                onChange={e => setFormData({ ...formData, year: e.target.value ? parseInt(e.target.value) : null })}
                placeholder="2023"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-600"
              />
            </div>

            {/* License Plate */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Placa (Opcional)</label>
              <input
                type="text"
                value={formData.license_plate}
                onChange={e => setFormData({ ...formData, license_plate: e.target.value.toUpperCase() })}
                placeholder="ABC1D23"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-600 font-mono uppercase"
              />
            </div>

            {/* Fuel Type */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Tipo de Combustível</label>
              <select
                value={formData.fuel_type}
                onChange={e => setFormData({ ...formData, fuel_type: e.target.value as FuelType })}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-blue-600"
              >
                <option value="FLEX">Flex</option>
                <option value="GASOLINE">Gasolina</option>
                <option value="ETHANOL">Etanol</option>
                <option value="DIESEL">Diesel</option>
                <option value="ELECTRIC">Elétrico</option>
                <option value="HYBRID">Híbrido</option>
                <option value="GNV">GNV</option>
              </select>
            </div>

            {/* Odometer */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Odômetro Atual (km) <span className="text-blue-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="0.1"
                required
                value={formData.odometer_km}
                onChange={e => handleOdometerChange(parseFloat(e.target.value) || 0)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-blue-600"
              />
              {odometerWarning && (
                <div className="mt-1.5 p-2 bg-amber-950/40 border border-amber-800/50 rounded-xl text-amber-300 text-xs flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400" />
                  <span>{odometerWarning}</span>
                </div>
              )}
            </div>

            {/* Tank Capacity */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Capacidade do Tanque (Litros)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={formData.tank_capacity_liters ?? ''}
                onChange={e => setFormData({ ...formData, tank_capacity_liters: e.target.value ? parseFloat(e.target.value) : null })}
                placeholder="50"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-600"
              />
            </div>

            {/* Average Consumption */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Consumo Médio Estimado (km/L)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={formData.average_consumption_km_l ?? ''}
                onChange={e => setFormData({ ...formData, average_consumption_km_l: e.target.value ? parseFloat(e.target.value) : null })}
                placeholder="10.5"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-600"
              />
            </div>

            {/* Bluetooth Name */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Nome Bluetooth da Central</label>
              <input
                type="text"
                value={formData.bluetooth_name}
                onChange={e => setFormData({ ...formData, bluetooth_name: e.target.value })}
                placeholder="Ex: Honda BT, SYNC"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-600"
              />
            </div>

            {/* Image URL */}
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-300 mb-1">URL da Foto (Opcional)</label>
              <input
                type="url"
                value={formData.image_url}
                onChange={e => setFormData({ ...formData, image_url: e.target.value })}
                placeholder="https://exemplo.com/foto-veiculo.jpg"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-600"
              />
            </div>

            {/* Active Status */}
            <div className="md:col-span-2 flex items-center gap-3 pt-2">
              <input
                type="checkbox"
                id="vehicle-active"
                checked={formData.active}
                onChange={e => setFormData({ ...formData, active: e.target.checked })}
                className="w-4 h-4 accent-blue-600 rounded bg-slate-950 border-slate-800"
              />
              <label htmlFor="vehicle-active" className="text-sm font-medium text-slate-200 cursor-pointer">
                Veículo Ativo (disponível para viagens e registros)
              </label>
            </div>
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
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium text-sm rounded-xl transition shadow-lg shadow-blue-600/25"
            >
              {loading ? 'Salvando...' : vehicleToEdit ? 'Salvar Alterações' : 'Cadastrar Veículo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
