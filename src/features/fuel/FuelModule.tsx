import React, { useState, useEffect } from 'react';
import { fuelEntriesService } from './fuelEntriesService';
import { FuelEntry } from '../../types/fuel_entry';
import { LoadingState, ErrorState } from '../../components/common/CommonComponents';
import { FuelFormModal } from './FuelFormModal';
import { Edit2, Trash2, Plus } from 'lucide-react';

export const FuelModule = ({ vehicleId }: { vehicleId: string }) => {
  const [entries, setEntries] = useState<FuelEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState<number | undefined>(undefined);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [entryToEdit, setEntryToEdit] = useState<FuelEntry | null>(null);
  const [entryToDelete, setEntryToDelete] = useState<FuelEntry | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleCloseFuelModal = () => {
    setIsModalOpen(false);
    setEditingEntry(null);
  };

  const setEditingEntry = (entry: FuelEntry | null) => {
    setEntryToEdit(entry);
  };

  const confirmDelete = async () => {
    if (!entryToDelete) return;
    setIsDeleting(true);
    try {
        await fuelEntriesService.deleteEntry(entryToDelete.id);
        setEntryToDelete(null);
        loadEntries();
    } catch (error) {
        console.error(error);
        alert('Erro ao excluir abastecimento.');
    } finally {
        setIsDeleting(false);
    }
  };

  const loadEntries = async () => {
    try {
      setLoading(true);
      const data = await fuelEntriesService.getEntries(vehicleId, days);
      setEntries(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadEntries(); }, [vehicleId, days]);

  const { lastConsumption, averageConsumption, totalSpent, totalLiters } = fuelEntriesService.calculateConsumption(entries);
  const cycles = fuelEntriesService.getValidConsumptionCycles(entries);
  const avgPrice = totalLiters > 0 ? totalSpent / totalLiters : 0;

  if (loading) return <LoadingState message="Carregando..." />;
  if (error) return <ErrorState message={error} onRetry={loadEntries} />;

  return (
    <div className="p-6 bg-slate-900 rounded-2xl border border-slate-800 text-slate-100">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-bold text-xl text-white">Abastecimentos</h3>
        <div className="flex gap-2">
            <button onClick={() => { setEditingEntry(null); setIsModalOpen(true); }} className="p-2 bg-blue-600 rounded-lg"><Plus className="w-5 h-5"/></button>
            <select onChange={(e) => setDays(e.target.value ? parseInt(e.target.value) : undefined)} className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm">
            <option value="">Tudo</option>
            <option value="30">30 dias</option>
            <option value="90">90 dias</option>
            <option value="180">6 meses</option>
            </select>
        </div>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Indicator label="Último Consumo" value={lastConsumption ? `${lastConsumption.toFixed(1)} km/L` : '--'} />
        <Indicator label="Média Ponderada" value={averageConsumption ? `${averageConsumption.toFixed(1)} km/L` : '--'} />
        <Indicator label="Gasto Total" value={`R$ ${totalSpent.toFixed(2)}`} />
        <Indicator label="Preço Médio/L" value={`R$ ${avgPrice.toFixed(2)}`} />
      </div>

      {cycles.length > 0 ? (
          <div className="h-48 bg-slate-950 rounded-lg border border-slate-800 mb-6 p-4">
              <h4 className="text-sm text-slate-400 mb-4">Consumo (km/L)</h4>
              <div className="flex items-end gap-2 h-24">
                  {cycles.map((c, i) => (
                      <div key={i} className="flex-1 bg-blue-600" style={{ height: `${(c.consumption / 20) * 100}%` }} title={`Consumo: ${c.consumption.toFixed(1)} km/L`}></div>
                  ))}
              </div>
          </div>
      ) : <p className="text-slate-500 mb-6 text-sm italic">Registre pelo menos dois ciclos de tanque cheio para visualizar o consumo.</p>}

      <table className="w-full text-sm text-left">
        <thead className="text-xs text-slate-400 uppercase border-b border-slate-800">
          <tr><th className="py-3">Data</th><th className="py-3">Odômetro</th><th className="py-3">L</th><th className="py-3">R$</th><th className="py-3">Cheio</th><th className="py-3">Ações</th></tr>
        </thead>
        <tbody>
          {entries.map(e => (
            <tr key={e.id} className="border-b border-slate-800">
              <td className="py-3">{new Date(e.filled_at).toLocaleDateString()}</td>
              <td className="py-3">{e.odometer_km.toLocaleString('pt-BR')} km</td>
              <td className="py-3">{e.liters.toFixed(3)}</td>
              <td className="py-3">R$ {e.total_amount.toFixed(2)}</td>
              <td className="py-3">{e.full_tank ? 'Sim' : 'Não'}</td>
              <td className="py-3 flex gap-2">
                  <button type="button" onClick={() => { setEditingEntry(e); setIsModalOpen(true); }}><Edit2 className="w-4 h-4 text-slate-400"/></button>
                  <button type="button" onClick={() => setEntryToDelete(e)}><Trash2 className="w-4 h-4 text-red-400"/></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {isModalOpen && (
          <FuelFormModal isOpen={isModalOpen} onClose={handleCloseFuelModal} onSave={loadEntries} entryToEdit={entryToEdit} vehicleId={vehicleId} />
      )}
      
      {entryToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
            <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 w-full max-w-sm">
                <h3 className="text-white font-bold mb-2">Excluir este abastecimento?</h3>
                <p className="text-slate-400 text-sm mb-6">Os indicadores de consumo poderão ser recalculados.</p>
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

const Indicator = ({ label, value }: { label: string, value: string }) => (
  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
    <p className="text-slate-400 text-xs">{label}</p>
    <p className="font-bold text-white text-lg">{value}</p>
  </div>
);
