import React, { useState, useEffect } from 'react';
import { maintenanceEntriesService } from './maintenanceEntriesService';
import { MaintenanceEntry } from '../../types/maintenance_entry';

const SERVICE_TYPES = [
  'Troca de óleo', 'Filtro de óleo', 'Filtro de ar', 'Filtro de combustível',
  'Pastilhas de freio', 'Discos de freio', 'Pneus', 'Corrente', 'Relação',
  'Velas', 'Bateria', 'Fluido de freio', 'Arrefecimento', 'Suspensão',
  'Revisão geral', 'Outro'
];

export const MaintenanceFormModal = ({ isOpen, onClose, onSave, entryToEdit, vehicleId, currentOdometer }: { 
  isOpen: boolean, 
  onClose: () => void, 
  onSave: () => void,
  entryToEdit?: MaintenanceEntry | null,
  vehicleId: string,
  currentOdometer: number
}) => {
  const [formData, setFormData] = useState<any>(entryToEdit || {
    odometer_km: currentOdometer,
    service_type: 'Revisão geral',
    custom_service_type: '',
    performed_at: new Date().toISOString().split('T')[0],
    description: '',
    cost_amount: '',
    workshop_name: '',
    next_due_odometer_km: '',
    next_due_date: '',
    notes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (formData.next_due_odometer_km && parseFloat(formData.next_due_odometer_km) < parseFloat(formData.odometer_km)) {
        setError('Próxima manutenção deve ser maior ou igual ao odômetro atual.');
    } else {
        setError(null);
    }
  }, [formData.next_due_odometer_km, formData.odometer_km]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (error) return;
    setIsSubmitting(true);
    try {
        const entryData = {
            ...formData,
            service_type: formData.service_type === 'Outro' ? formData.custom_service_type : formData.service_type,
            odometer_km: parseFloat(formData.odometer_km),
            cost_amount: formData.cost_amount ? parseFloat(formData.cost_amount.replace(',', '.')) : null,
            next_due_odometer_km: formData.next_due_odometer_km ? parseFloat(formData.next_due_odometer_km) : null,
            next_due_date: formData.next_due_date || null,
            performed_at: new Date(formData.performed_at).toISOString(),
        };
        delete entryData.custom_service_type;

        if (entryToEdit) {
            await maintenanceEntriesService.updateEntry(entryToEdit.id, entryData);
        } else {
            await maintenanceEntriesService.addEntry({ ...entryData, vehicle_id: vehicleId } as any);
        }
        onSave();
        onClose();
    } catch (error) {
        console.error(error);
        alert('Erro ao salvar manutenção.');
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <form onSubmit={handleSubmit} className="bg-slate-900 rounded-xl border border-slate-800 w-full max-w-md flex flex-col max-h-[90vh]">
        <div className="p-6 overflow-y-auto">
            <h2 className="text-xl font-bold mb-4 text-white">{entryToEdit ? 'Editar' : 'Nova'} Manutenção</h2>
            
            <label className="block text-xs text-slate-400 mb-1">Data</label>
            <input type="date" value={formData.performed_at.split('T')[0]} onChange={e => setFormData({...formData, performed_at: e.target.value})} className="block w-full p-2 mb-2 bg-slate-950 border border-slate-700 rounded text-white" required />
            
            <label className="block text-xs text-slate-400 mb-1">Odômetro (km)</label>
            <input type="number" value={formData.odometer_km} onChange={e => setFormData({...formData, odometer_km: e.target.value})} className="block w-full p-2 mb-2 bg-slate-950 border border-slate-700 rounded text-white" required />
            
            <label className="block text-xs text-slate-400 mb-1">Tipo de serviço</label>
            <select value={formData.service_type} onChange={e => setFormData({...formData, service_type: e.target.value})} className="block w-full p-2 mb-2 bg-slate-950 border border-slate-700 rounded text-white">
                {SERVICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            {formData.service_type === 'Outro' && (
                <input type="text" placeholder="Tipo de serviço personalizado" value={formData.custom_service_type} onChange={e => setFormData({...formData, custom_service_type: e.target.value})} className="block w-full p-2 mb-2 bg-slate-950 border border-slate-700 rounded text-white" required />
            )}

            <label className="block text-xs text-slate-400 mb-1">Descrição</label>
            <textarea placeholder="Descrição do serviço (opcional)" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="block w-full p-2 mb-2 bg-slate-950 border border-slate-700 rounded text-white" />
            
            <label className="block text-xs text-slate-400 mb-1">Custo (R$)</label>
            <input type="text" placeholder="0,00" value={formData.cost_amount} onChange={e => setFormData({...formData, cost_amount: e.target.value})} className="block w-full p-2 mb-2 bg-slate-950 border border-slate-700 rounded text-white" />
            
            <label className="block text-xs text-slate-400 mb-1">Oficina</label>
            <input type="text" placeholder="Oficina (opcional)" value={formData.workshop_name} onChange={e => setFormData({...formData, workshop_name: e.target.value})} className="block w-full p-2 mb-2 bg-slate-950 border border-slate-700 rounded text-white" />

            <div className="border-t border-slate-800 pt-4 mt-2">
                <p className="text-xs text-slate-400 mb-2">Informe quilometragem, data ou ambos.</p>
                <label className="block text-xs text-slate-400 mb-1">Próxima manutenção (km)</label>
                <input type="number" placeholder="Ex.: 13000" value={formData.next_due_odometer_km} onChange={e => setFormData({...formData, next_due_odometer_km: e.target.value})} className="block w-full p-2 mb-1 bg-slate-950 border border-slate-700 rounded text-white" />
                {error && <p className="text-xs text-red-400 mb-2">{error}</p>}
                
                <label className="block text-xs text-slate-400 mb-1">Próxima manutenção (data)</label>
                <input type="date" value={formData.next_due_date || ''} onChange={e => setFormData({...formData, next_due_date: e.target.value})} className="block w-full p-2 mb-2 bg-slate-950 border border-slate-700 rounded text-white" />
            </div>

            <label className="block text-xs text-slate-400 mb-1">Observações</label>
            <textarea placeholder="Observações (opcional)" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="block w-full p-2 mb-4 bg-slate-950 border border-slate-700 rounded text-white" />
        </div>

        <div className="flex gap-2 p-4 bg-slate-950 border-t border-slate-800 rounded-b-xl">
          <button type="button" onClick={onClose} className="flex-1 p-2 bg-slate-800 rounded text-white">Cancelar</button>
          <button type="submit" disabled={isSubmitting || !!error} className="flex-1 p-2 bg-blue-600 rounded text-white disabled:opacity-50">{isSubmitting ? 'Salvando...' : 'Salvar'}</button>
        </div>
      </form>
    </div>
  );
};
