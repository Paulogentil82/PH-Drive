import React, { useState, useEffect } from 'react';
import { maintenanceEntriesService } from './maintenanceEntriesService';
import { MaintenanceEntry, MaintenanceStatus } from '../../types/maintenance_entry';
import { LoadingState, ErrorState } from '../../components/common/CommonComponents';
import { MaintenanceFormModal } from './MaintenanceFormModal';
import { Edit2, Trash2, Plus, AlertCircle, CheckCircle, AlertTriangle } from 'lucide-react';
import { Vehicle } from '../../types';

export const MaintenanceModule = ({ vehicle }: { vehicle: Vehicle }) => {
  const [entries, setEntries] = useState<MaintenanceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [entryToEdit, setEntryToEdit] = useState<MaintenanceEntry | null>(null);
  const [entryToDelete, setEntryToDelete] = useState<MaintenanceEntry | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadEntries = async () => {
    try {
      setLoading(true);
      const data = await maintenanceEntriesService.getEntries(vehicle.id);
      setEntries(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadEntries(); }, [vehicle.id]);

  const confirmDelete = async () => {
    if (!entryToDelete) return;
    setIsDeleting(true);
    try {
        await maintenanceEntriesService.deleteEntry(entryToDelete.id);
        setEntryToDelete(null);
        loadEntries();
    } catch (error) {
        alert('Erro ao excluir manutenção.');
    } finally {
        setIsDeleting(false);
    }
  };

  const getStatus = (m: MaintenanceEntry): { status: MaintenanceStatus, label: string } => {
    if (!m.next_due_odometer_km && !m.next_due_date) return { status: 'SEM_REVISAO', label: 'Sem próxima revisão definida' };
    
    let kmStatus: 'OK' | 'PRÓXIMA' | 'VENCIDA' | null = null;
    if (m.next_due_odometer_km) {
        if (vehicle.odometer_km >= m.next_due_odometer_km) kmStatus = 'VENCIDA';
        else if (m.next_due_odometer_km - vehicle.odometer_km <= 500) kmStatus = 'PRÓXIMA';
        else kmStatus = 'OK';
    }
    
    let dateStatus: 'OK' | 'PRÓXIMA' | 'VENCIDA' | null = null;
    if (m.next_due_date) {
        const today = new Date();
        const dueDate = new Date(m.next_due_date);
        const diffTime = dueDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (today >= dueDate) dateStatus = 'VENCIDA';
        else if (diffDays <= 30) dateStatus = 'PRÓXIMA';
        else dateStatus = 'OK';
    }
    
    const status = [kmStatus, dateStatus].includes('VENCIDA') ? 'VENCIDA' :
                   [kmStatus, dateStatus].includes('PRÓXIMA') ? 'PRÓXIMA' : 'OK';
    
    const labels = { 'OK': 'OK', 'PRÓXIMA': 'Próxima', 'VENCIDA': 'Vencida' };
    return { status: status as MaintenanceStatus, label: labels[status as 'OK' | 'PRÓXIMA' | 'VENCIDA'] };
  };

  if (loading) return <LoadingState message="Carregando..." />;
  if (error) return <ErrorState message={error} onRetry={loadEntries} />;

  return (
    <div className="p-6 bg-slate-900 rounded-2xl border border-slate-800 text-slate-100">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-bold text-xl text-white">Manutenções</h3>
        <button onClick={() => { setEntryToEdit(null); setIsModalOpen(true); }} className="p-2 bg-blue-600 rounded-lg"><Plus className="w-5 h-5"/></button>
      </div>
      
      <table className="w-full text-sm text-left">
        <thead className="text-xs text-slate-400 uppercase border-b border-slate-800">
          <tr><th className="py-3">Data</th><th className="py-3">Serviço</th><th className="py-3">Custo</th><th className="py-3">Status</th><th className="py-3">Ações</th></tr>
        </thead>
        <tbody>
          {entries.map(e => {
            const { status, label } = getStatus(e);
            return (
              <tr key={e.id} className="border-b border-slate-800">
                <td className="py-3">{new Date(e.performed_at).toLocaleDateString()}</td>
                <td className="py-3">{e.service_type}</td>
                <td className="py-3">{e.cost_amount ? `R$ ${e.cost_amount.toFixed(2)}` : '--'}</td>
                <td className="py-3">
                    <span className={`flex items-center gap-1 ${status === 'VENCIDA' ? 'text-red-400' : status === 'PRÓXIMA' ? 'text-yellow-400' : 'text-green-400'}`}>
                        {status === 'VENCIDA' && <AlertTriangle className="w-4 h-4"/>}
                        {status === 'PRÓXIMA' && <AlertCircle className="w-4 h-4"/>}
                        {status === 'OK' && <CheckCircle className="w-4 h-4"/>}
                        {label}
                    </span>
                </td>
                <td className="py-3 flex gap-2">
                    <button type="button" onClick={() => { setEntryToEdit(e); setIsModalOpen(true); }}><Edit2 className="w-4 h-4 text-slate-400"/></button>
                    <button type="button" onClick={() => setEntryToDelete(e)}><Trash2 className="w-4 h-4 text-red-400"/></button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {isModalOpen && (
          <MaintenanceFormModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={loadEntries} entryToEdit={entryToEdit} vehicleId={vehicle.id} currentOdometer={vehicle.odometer_km} />
      )}
      
      {entryToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
            <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 w-full max-w-sm">
                <h3 className="text-white font-bold mb-2">Excluir esta manutenção?</h3>
                <div className="flex gap-2">
                    <button type="button" onClick={() => setEntryToDelete(null)} className="flex-1 p-2 bg-slate-800 rounded text-white">Cancelar</button>
                    <button type="button" disabled={isDeleting} onClick={confirmDelete} className="flex-1 p-2 bg-red-600 rounded text-white disabled:opacity-50">{isDeleting ? 'Excluindo...' : 'Excluir'}</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
