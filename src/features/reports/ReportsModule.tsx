import React, { useState, useEffect } from 'react';
import { Vehicle } from '../../types';
import type { ReportData } from '../../types/reports';
import { calculateReportMetrics } from './reportMetrics';
import { metricDate } from '../../utils/metricDates';
import { LoadingState, ErrorState } from '../../components/common/CommonComponents';
import { reportsService } from './reportsService';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

export const ReportsModule = ({ vehicle }: { vehicle: Vehicle }) => {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<string>('all');

  const requestVersion = React.useRef(0);
  const days = period === 'all' ? undefined : Number(period);

  const loadData = async () => {
    const request = ++requestVersion.current;
    try {
      setLoading(true);
      setError(null);
      const res = await reportsService.getConsolidatedData(vehicle.id, days);
      if (request === requestVersion.current) setData(res);
    } catch (err: any) {
      if (request === requestVersion.current) setError(err.message);
    } finally {
      if (request === requestVersion.current) setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    return () => { requestVersion.current++; };
  }, [vehicle.id, period]);

  if (loading) return <LoadingState message="Carregando..." />;
  if (error) return <ErrorState message={error} onRetry={loadData} />;
  if (!data || data.vehicleId !== vehicle.id || data.days !== days) return <LoadingState message="Carregando..." />;

  const { consolidated, trips } = data;
  const { monthlyData, monthlyDistance, totalSpent, fuelSpent, maintSpent, genSpent, totalKm, costPerKm } = calculateReportMetrics(data);

  const chartData = [
      { name: 'Combustível', value: fuelSpent },
      { name: 'Manutenção', value: maintSpent },
      { name: 'Despesas', value: genSpent }
  ].filter(c => c.value > 0);

  const exportCSV = () => {
    const headers = ['Data', 'Tipo', 'Descrição', 'Valor'];
    const rows = consolidated.map((e: any) => [metricDate(e.date, true)!.toLocaleDateString('pt-BR'), e.type, e.description, e.amount.toFixed(2)]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-${vehicle.name}-${period}.csv`;
    a.click();
  };

  return (
    <div className="p-6 bg-slate-900 rounded-2xl border border-slate-800 text-slate-100">
      <h3 className="font-bold text-2xl text-white mb-6">Relatórios — {vehicle.name}</h3>

      <div className="flex gap-2 mb-6">
          <select value={period} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPeriod(e.target.value)} className="p-2 bg-slate-950 rounded border border-slate-700 text-white">
              <option value="30">30 dias</option>
              <option value="90">90 dias</option>
              <option value="180">6 meses</option>
              <option value="365">12 meses</option>
              <option value="all">Tudo</option>
          </select>
          <button onClick={exportCSV} className="p-2 bg-slate-800 rounded border border-slate-700 text-white">Exportar CSV</button>
      </div>

      {consolidated.length === 0 && trips.length === 0 ? (
          <p className="text-slate-400">Não há dados suficientes no período selecionado.</p>
      ) : (
        <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
                    <p className="text-slate-400 text-xs">Custo Total</p>
                    <p className="font-bold text-white text-lg">R$ {totalSpent.toFixed(2)}</p>
                </div>
                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
                    <p className="text-slate-400 text-xs">Custo por Km</p>
                    <p className="font-bold text-white text-lg">{costPerKm !== null ? `R$ ${costPerKm.toFixed(2)}` : '—'}</p>
                </div>
                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
                    <p className="text-slate-400 text-xs">Viagens</p>
                    <p className="font-bold text-white text-lg">{trips.length}</p>
                </div>
                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
                    <p className="text-slate-400 text-xs">Distância (Km)</p>
                    <p className="font-bold text-white text-lg">{totalKm.toFixed(0)}</p>
                </div>
            </div>
            
            <p className="mb-4 text-sm text-slate-300">No período selecionado, o veículo percorreu {totalKm.toFixed(0)} km e gerou R$ {totalSpent.toFixed(2)} em custos totais.</p>

            {monthlyData.length > 0 && (
                <div className="h-64 mb-8">
                    <h4 className="text-sm font-semibold mb-2">Evolução mensal de gastos</h4>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthlyData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" />
                            <YAxis />
                            <Tooltip formatter={(value: any) => `R$ ${value.toFixed(2)}`} />
                            <Legend />
                            <Bar dataKey="Combustível" fill="#3b82f6" stackId="a" />
                            <Bar dataKey="Manutenção" fill="#10b981" stackId="a" />
                            <Bar dataKey="Despesas" fill="#f59e0b" stackId="a" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}

            {monthlyDistance.length > 0 && (
                <div className="h-64 mb-8">
                    <h4 className="text-sm font-semibold mb-2">Distância percorrida por mês</h4>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthlyDistance}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" />
                            <YAxis />
                            <Tooltip formatter={(value: any) => `${value.toFixed(0)} km`} />
                            <Bar dataKey="km" fill="#8b5cf6" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}

            <div className="h-64 mb-8">
                <h4 className="text-sm font-semibold mb-2">Distribuição de gastos</h4>
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} fill="#8884d8" label>
                            {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={['#3b82f6', '#10b981', '#f59e0b'][index % 3]} />)}
                        </Pie>
                        <Tooltip />
                        <Legend />
                    </PieChart>
                </ResponsiveContainer>
            </div>

            <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-400 uppercase border-b border-slate-800">
                <tr><th className="py-3">Data</th><th className="py-3">Tipo</th><th className="py-3">Descrição</th><th className="py-3">Valor</th></tr>
                </thead>
                <tbody>
                {consolidated.map((e: any) => (
                    <tr key={e.id} className="border-b border-slate-800">
                    <td className="py-3">{metricDate(e.date, true)!.toLocaleDateString('pt-BR')}</td>
                    <td className="py-3">{e.type}</td>
                    <td className="py-3">{e.description}</td>
                    <td className="py-3">R$ {e.amount.toFixed(2)}</td>
                    </tr>
                ))}
                </tbody>
            </table>
        </>
      )}
    </div>
  );
};