import React, { useState, useEffect, useMemo } from 'react';
import { Vehicle } from '../../types';
import { LoadingState, ErrorState } from '../../components/common/CommonComponents';
import { alertsService } from './alertsService';
import { Alert } from '../../types/alerts';
import { AlertTriangle, Clock, Info, ShieldAlert } from 'lucide-react';

import { NavigationTab } from '../../types';

export const AlertsModule = ({ vehicles, onNavigate }: { vehicles: Vehicle[]; onNavigate?: (tab: NavigationTab) => void }) => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [vehicleFilter, setVehicleFilter] = useState<string>('all');

  useEffect(() => {
    alertsService.getAlerts().then(setAlerts).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);

  const filteredAlerts = useMemo(() => {
    let filtered = alerts;
    if (filter !== 'all') filtered = filtered.filter(a => a.severity === filter);
    if (vehicleFilter !== 'all') filtered = filtered.filter(a => a.vehicleId === vehicleFilter);
    return filtered;
  }, [alerts, filter, vehicleFilter]);

  const counts = useMemo(() => {
      return alerts.reduce((acc, a) => {
          acc[a.severity] = (acc[a.severity] || 0) + 1;
          acc.total++;
          return acc;
      }, { VENCIDO: 0, URGENTE: 0, PRÓXIMO: 0, INFORMATIVO: 0, total: 0 } as any);
  }, [alerts]);

  if (loading) return <LoadingState message="Carregando alertas..." />;
  if (error) return <ErrorState message={error} onRetry={() => window.location.reload()} />;

  return (
    <div className="p-6 bg-slate-900 rounded-2xl border border-slate-800 text-slate-100">
      <h3 className="font-bold text-2xl text-white mb-6">Central de Alertas</h3>
      
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="p-2 bg-slate-950 rounded border border-slate-700 text-white text-sm">
            <option value="all">Todos</option>
            <option value="VENCIDO">Vencidos</option>
            <option value="URGENTE">Urgentes</option>
            <option value="PRÓXIMO">Próximos</option>
            <option value="INFORMATIVO">Informativos</option>
          </select>
          <select value={vehicleFilter} onChange={(e) => setVehicleFilter(e.target.value)} className="p-2 bg-slate-950 rounded border border-slate-700 text-white text-sm">
            <option value="all">Todos os veículos</option>
            {vehicles.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="p-3 bg-red-950/30 rounded-lg border border-red-900/50">
              <p className="text-red-400 text-xs font-bold">Vencidos</p>
              <p className="text-white text-lg font-bold">{counts.VENCIDO}</p>
          </div>
          <div className="p-3 bg-orange-950/30 rounded-lg border border-orange-900/50">
              <p className="text-orange-400 text-xs font-bold">Urgentes</p>
              <p className="text-white text-lg font-bold">{counts.URGENTE}</p>
          </div>
          <div className="p-3 bg-yellow-950/30 rounded-lg border border-yellow-900/50">
              <p className="text-yellow-400 text-xs font-bold">Próximos</p>
              <p className="text-white text-lg font-bold">{counts.PRÓXIMO}</p>
          </div>
          <div className="p-3 bg-blue-950/30 rounded-lg border border-blue-900/50">
              <p className="text-blue-400 text-xs font-bold">Informativos</p>
              <p className="text-white text-lg font-bold">{counts.INFORMATIVO}</p>
          </div>
          <div className="p-3 bg-slate-800 rounded-lg border border-slate-700">
              <p className="text-slate-400 text-xs font-bold">Total</p>
              <p className="text-white text-lg font-bold">{counts.total}</p>
          </div>
      </div>
      
      {filteredAlerts.length === 0 ? (
          <div className="p-8 text-center border border-slate-800 rounded-xl bg-slate-950">
            <Info className="w-8 h-8 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-300">Nenhum alerta ativo no momento.</p>
            <p className="text-slate-500 text-sm mt-1">Manutenções e vencimentos próximos aparecerão aqui automaticamente.</p>
          </div>
      ) : (
          <div className="space-y-4">
            {filteredAlerts.map(a => (
                <div key={a.id} className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex items-start gap-4">
                    {a.severity === 'VENCIDO' && <ShieldAlert className="w-6 h-6 text-red-500 mt-1" />}
                    {a.severity === 'URGENTE' && <AlertTriangle className="w-6 h-6 text-orange-500 mt-1" />}
                    {a.severity === 'PRÓXIMO' && <Clock className="w-6 h-6 text-yellow-500 mt-1" />}
                    {a.severity === 'INFORMATIVO' && <Info className="w-6 h-6 text-blue-500 mt-1" />}
                    <div className="flex-1">
                        <div className="flex justify-between items-start">
                            <h4 className="font-bold text-white">{a.title}</h4>
                            <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                                a.severity === 'VENCIDO' ? 'bg-red-900/50 text-red-300' :
                                a.severity === 'URGENTE' ? 'bg-orange-900/50 text-orange-300' :
                                a.severity === 'PRÓXIMO' ? 'bg-yellow-900/50 text-yellow-300' :
                                'bg-blue-900/50 text-blue-300'
                            }`}>{a.severity}</span>
                        </div>
                        <p className="text-sm text-slate-400 mt-1">{a.message}</p>
                        <p className="text-xs text-slate-500 mt-1">Veículo: {a.vehicleName}</p>
                        
                        <div className="mt-3">
                           {a.sourceType === 'maintenance' && (
                               <button onClick={() => onNavigate ? onNavigate('maintenance') : (window.location.href = '/manutencoes')} className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg font-bold">Ver manutenção</button>
                           )}
                           {a.sourceType === 'expense' && (
                               <button onClick={() => onNavigate ? onNavigate('expenses') : (window.location.href = '/despesas')} className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg font-bold">Ver despesa</button>
                           )}
                           {a.sourceType === 'tire' && (
                               <button onClick={() => onNavigate ? onNavigate('tires') : (window.location.href = '/pneus')} className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg font-bold">Ver pneu</button>
                           )}
                           {a.sourceType === 'document' && (
                               <button onClick={() => onNavigate ? onNavigate('documents') : (window.location.href = '/documentos')} className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg font-bold">Ver documento</button>
                           )}
                        </div>
                    </div>
                </div>
            ))}
          </div>
      )}
    </div>
  );
};
