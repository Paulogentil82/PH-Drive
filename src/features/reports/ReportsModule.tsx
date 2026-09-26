import React, { useState, useEffect } from 'react';
import { Vehicle } from '../../types';
import { LoadingState, ErrorState } from '../../components/common/CommonComponents';
import { reportsService } from './reportsService';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

export const ReportsModule = ({ vehicle }: { vehicle: Vehicle }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<string>('all');

  const loadData = async () => {
    try {
      setLoading(true);
      const days = period === 'all' ? undefined : parseInt(period);
      const res = await reportsService.getConsolidatedData(vehicle.id, days);
      setData(res);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [vehicle.id, period]);

  const monthlyData = React.useMemo(() => {
      if (!data) return [];
      const { fuel, maintenance, expenses } = data;
      const monthsMap: Record<string, any> = {};

      fuel.forEach((f: any) => {
          const date = new Date(f.filled_at);
          const m = date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
          if (!monthsMap[m]) monthsMap[m] = { month: m, timestamp: date.getTime(), Combustível: 0, Manutenção: 0, Despesas: 0 };
          monthsMap[m].Combustível += f.total_amount || 0;
      });
      maintenance.forEach((m: any) => {
          const date = new Date(m.performed_at);
          const mon = date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
          if (!monthsMap[mon]) monthsMap[mon] = { month: mon, timestamp: date.getTime(), Combustível: 0, Manutenção: 0, Despesas: 0 };
          monthsMap[mon].Manutenção += m.cost_amount || 0;
      });
      expenses.forEach((e: any) => {
          const date = new Date(e.expense_date);
          const mon = date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
          if (!monthsMap[mon]) monthsMap[mon] = { month: mon, timestamp: date.getTime(), Combustível: 0, Manutenção: 0, Despesas: 0 };
          monthsMap[mon].Despesas += e.amount || 0;
      });
      
      return Object.values(monthsMap).sort((a: any, b: any) => a.timestamp - b.timestamp);
  }, [data]);

  const monthlyDistance = React.useMemo(() => {
      if (!data) return [];
      const { trips } = data;
      const distMap: Record<string, any> = {};
      trips.forEach((t: any) => {
          const date = new Date(t.end_time || t.start_time);
          const mon = date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
          const km = (t.gps_distance_km && t.gps_distance_km > 0) ? t.gps_distance_km : (t.distance_km || 0);
          if (!distMap[mon]) distMap[mon] = { month: mon, timestamp: date.getTime(), km: 0 };
          distMap[mon].km += km;
      });
      return Object.values(distMap).sort((a: any, b: any) => a.timestamp - b.timestamp);
  }, [data]);

  if (loading) return <LoadingState message="Carregando..." />;
  if (error) return <ErrorState message={error} onRetry={loadData} />;

  const { consolidated, fuel, maintenance, expenses, trips } = data;

  const totalSpent = consolidated.reduce((sum: number, e: any) => sum + e.amount, 0);
  const fuelSpent = fuel.reduce((sum: number, e: any) => sum + e.total_amount, 0);
  const maintSpent = maintenance.reduce((sum: number, e: any) => sum + (e.cost_amount || 0), 0);
  const genSpent = expenses.reduce((sum: number, e: any) => sum + e.amount, 0);
  
  const totalKm = trips.reduce((sum: number, t: any) => sum + ((t.gps_distance_km && t.gps_distance_km > 0) ? t.gps_distance_km : (t.distance_km || 0)), 0);
  const costPerKm = totalKm > 0 ? totalSpent / totalKm : 0;

  const chartData = [
      { name: 'Combustível', value: fuelSpent },
      { name: 'Manutenção', value: maintSpent },
      { name: 'Despesas', value: genSpent }
  ].filter(c => c.value > 0);

  const exportCSV = () => {
    const headers = ['Data', 'Tipo', 'Descrição', 'Valor'];
    const rows = consolidated.map((e: any) => [new Date(e.date).toLocaleDateString(), e.type, e.description, e.amount.toFixed(2)]);
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

      {consolidated.length === 0 ? (
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
                    <p className="font-bold text-white text-lg">{totalKm > 0 ? `R$ ${costPerKm.toFixed(2)}` : '—'}</p>
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
                    <td className="py-3">{new Date(e.date).toLocaleDateString()}</td>
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