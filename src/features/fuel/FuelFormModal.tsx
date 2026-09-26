import React, { useState, useEffect } from 'react';
import { fuelEntriesService } from './fuelEntriesService';
import { FuelEntry } from '../../types/fuel_entry';
import { parsePtBrNumber } from '../../utils/numberParser';

export const FuelFormModal = ({ isOpen, onClose, onSave, entryToEdit, vehicleId }: { 
  isOpen: boolean, 
  onClose: () => void, 
  onSave: () => void,
  entryToEdit?: FuelEntry | null,
  vehicleId: string
}) => {
  const [formData, setFormData] = useState<any>(entryToEdit || {
    odometer_km: '',
    liters: '',
    total_amount: '',
    fuel_type: 'Gasolina',
    full_tank: false,
    filled_at: new Date().toISOString().split('T')[0],
    station_name: '',
    notes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (entryToEdit) {
        setFormData(entryToEdit);
      } else {
        setFormData({
            odometer_km: '',
            liters: '',
            total_amount: '',
            fuel_type: 'Gasolina',
            full_tank: false,
            filled_at: new Date().toISOString().split('T')[0],
            station_name: '',
            notes: '',
        });
        fuelEntriesService.getLatestEntry(vehicleId).then(entry => {
            if (entry) setFormData((prev: any) => ({ ...prev, odometer_km: entry.odometer_km }));
        });
      }
    }
  }, [isOpen, entryToEdit, vehicleId]);

  const litersNum = parsePtBrNumber(formData.liters) ?? 0;
  const totalAmountNum = parsePtBrNumber(formData.total_amount) ?? 0;
  const pricePerLiter = litersNum > 0 ? totalAmountNum / litersNum : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (litersNum <= 0 || totalAmountNum <= 0 || parseFloat(formData.odometer_km) < 0) return;
    
    setIsSubmitting(true);
    
    try {
        const entryData = {
            ...formData,
            odometer_km: parseFloat(formData.odometer_km),
            liters: litersNum,
            total_amount: totalAmountNum,
            price_per_liter: pricePerLiter,
            filled_at: new Date(formData.filled_at).toISOString(),
        };

        if (entryToEdit) {
        await fuelEntriesService.updateEntry(entryToEdit.id, entryData);
        } else {
        await fuelEntriesService.addEntry({ ...entryData, vehicle_id: vehicleId } as any);
        }
        onSave();
        onClose();
    } catch (error) {
        console.error(error);
        alert('Erro ao salvar abastecimento.');
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <form onSubmit={handleSubmit} className="bg-slate-900 p-6 rounded-xl border border-slate-800 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4 text-white">{entryToEdit ? 'Editar' : 'Novo'} Abastecimento</h2>
        
        <label className="block text-xs text-slate-400 mb-1">Data</label>
        <input type="date" value={formData.filled_at.split('T')[0]} onChange={e => setFormData({...formData, filled_at: e.target.value})} className="block w-full p-2 mb-2 bg-slate-950 border border-slate-700 rounded text-white" required />
        
        <label className="block text-xs text-slate-400 mb-1">Odômetro (km)</label>
        <input type="number" placeholder="12300" value={formData.odometer_km} onChange={e => setFormData({...formData, odometer_km: e.target.value})} className="block w-full p-2 mb-2 bg-slate-950 border border-slate-700 rounded text-white" required />
        
        <label className="block text-xs text-slate-400 mb-1">Litros</label>
        <input type="text" placeholder="10,000" value={formData.liters} onChange={e => setFormData({...formData, liters: e.target.value})} className="block w-full p-2 mb-2 bg-slate-950 border border-slate-700 rounded text-white" required />
        
        <label className="block text-xs text-slate-400 mb-1">Valor total (R$)</label>
        <input type="text" placeholder="60,00" value={formData.total_amount} onChange={e => setFormData({...formData, total_amount: e.target.value})} className="block w-full p-2 mb-2 bg-slate-950 border border-slate-700 rounded text-white" required />
        
        <label className="block text-xs text-slate-400 mb-1">Preço por litro</label>
        <div className="p-2 mb-2 bg-slate-950 border border-slate-700 rounded text-slate-300">R$ {pricePerLiter.toFixed(2)}/L</div>
        
        <label className="block text-xs text-slate-400 mb-1">Combustível</label>
        <select value={formData.fuel_type} onChange={e => setFormData({...formData, fuel_type: e.target.value})} className="block w-full p-2 mb-2 bg-slate-950 border border-slate-700 rounded text-white">
            {['Gasolina', 'Etanol', 'Diesel', 'GNV', 'Outro'].map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        
        <label className="flex items-center mb-4 text-slate-300">
          <input type="checkbox" checked={formData.full_tank} onChange={e => setFormData({...formData, full_tank: e.target.checked})} className="mr-2" />
          Tanque cheio
        </label>

        <label className="block text-xs text-slate-400 mb-1">Posto</label>
        <input type="text" placeholder="Posto (opcional)" value={formData.station_name} onChange={e => setFormData({...formData, station_name: e.target.value})} className="block w-full p-2 mb-2 bg-slate-950 border border-slate-700 rounded text-white" />
        
        <label className="block text-xs text-slate-400 mb-1">Observações</label>
        <textarea placeholder="Observações (opcional)" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="block w-full p-2 mb-4 bg-slate-950 border border-slate-700 rounded text-white" />

        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 p-2 bg-slate-800 rounded text-white">Cancelar</button>
          <button type="submit" disabled={isSubmitting} className="flex-1 p-2 bg-blue-600 rounded text-white disabled:opacity-50">{isSubmitting ? 'Salvando...' : 'Salvar'}</button>
        </div>
      </form>
    </div>
  );
};
