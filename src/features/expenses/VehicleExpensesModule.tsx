import React, { useState, useEffect } from 'react';
import { vehicleExpensesService } from './vehicleExpensesService';
import { VehicleExpense } from '../../types/vehicle_expense';
import { LoadingState, ErrorState } from '../../components/common/CommonComponents';
import { VehicleExpensesFormModal } from './VehicleExpensesFormModal';
import { Edit2, Trash2, Plus } from 'lucide-react';
import { Vehicle } from '../../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

export const VehicleExpensesModule = ({ vehicle }: { vehicle: Vehicle }) => {
  const [expenses, setExpenses] = useState<VehicleExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expenseToEdit, setExpenseToEdit] = useState<VehicleExpense | null>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<VehicleExpense | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [period, setPeriod] = useState<'30' | '90' | '180' | '365' | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState('Todas');

  const loadExpenses = async () => {
    try {
      setLoading(true);
      const data = await vehicleExpensesService.getExpenses(vehicle.id);
      setExpenses(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadExpenses(); }, [vehicle.id]);

  const confirmDelete = async () => {
    if (!expenseToDelete) return;
    setIsDeleting(true);
    try {
        await vehicleExpensesService.deleteExpense(expenseToDelete.id);
        setExpenseToDelete(null);
        loadExpenses();
    } catch (error) {
        alert('Erro ao excluir despesa.');
    } finally {
        setIsDeleting(false);
    }
  };

  const filteredExpenses = expenses.filter(e => {
      let match = true;
      if (categoryFilter !== 'Todas' && e.category !== categoryFilter) match = false;
      if (period !== 'all') {
          const d = new Date(e.expense_date);
          const now = new Date();
          const days = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
          if (days > parseInt(period)) match = false;
      }
      return match;
  });

  const totalSpent = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  const monthExpenses = filteredExpenses.filter(e => new Date(e.expense_date).getMonth() === new Date().getMonth()).reduce((sum, e) => sum + e.amount, 0);
  
  const categoryData = filteredExpenses.reduce((acc: any, e) => {
      acc[e.category] = (acc[e.category] || 0) + e.amount;
      return acc;
  }, {});
  
  const chartData = Object.entries(categoryData).map(([name, value]) => ({ name, value })).filter((item: any) => item.value > 0);
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

  if (loading) return <LoadingState message="Carregando..." />;
  if (error) return <ErrorState message={error} onRetry={loadExpenses} />;

  return (
    <div className="p-6 bg-slate-900 rounded-2xl border border-slate-800 text-slate-100">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-bold text-xl text-white">Despesas Gerais</h3>
        <button onClick={() => { setExpenseToEdit(null); setIsModalOpen(true); }} className="p-2 bg-blue-600 rounded-lg"><Plus className="w-5 h-5"/></button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
            <p className="text-slate-400 text-xs">Total Gasto</p>
            <p className="font-bold text-white text-lg">R$ {totalSpent.toFixed(2)}</p>
        </div>
        <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
            <p className="text-slate-400 text-xs">Despesas no mês</p>
            <p className="font-bold text-white text-lg">R$ {monthExpenses.toFixed(2)}</p>
        </div>
        <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
            <p className="text-slate-400 text-xs">Quantidade</p>
            <p className="font-bold text-white text-lg">{filteredExpenses.length}</p>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
          <select value={period} onChange={e => setPeriod(e.target.value as any)} className="p-2 bg-slate-950 rounded border border-slate-700 text-white">
              <option value="30">30 dias</option>
              <option value="90">90 dias</option>
              <option value="180">6 meses</option>
              <option value="365">12 meses</option>
              <option value="all">Tudo</option>
          </select>
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="p-2 bg-slate-950 rounded border border-slate-700 text-white">
              <option>Todas</option>
              {['Estacionamento', 'Pedágio', 'Lavagem', 'Seguro', 'IPVA', 'Licenciamento', 'Multa', 'Acessórios', 'Peças', 'Documentação', 'Outro'].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
      </div>
      
      {chartData.length > 0 ? (
          <div className="h-64 mb-6">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} fill="#8884d8" label>
                        {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                </PieChart>
            </ResponsiveContainer>
          </div>
      ) : (
        <p className="text-slate-400 text-sm mb-6">Registre despesas para visualizar a distribuição por categoria.</p>
      )}

      <table className="w-full text-sm text-left">
        <thead className="text-xs text-slate-400 uppercase border-b border-slate-800">
          <tr><th className="py-3">Data</th><th className="py-3">Categoria</th><th className="py-3">Valor</th><th className="py-3">Ações</th></tr>
        </thead>
        <tbody>
          {filteredExpenses.map(e => (
            <tr key={e.id} className="border-b border-slate-800">
              <td className="py-3">{new Date(e.expense_date).toLocaleDateString()}</td>
              <td className="py-3">{e.category}</td>
              <td className="py-3">R$ {e.amount.toFixed(2)}</td>
              <td className="py-3 flex gap-2">
                  <button type="button" onClick={() => { setExpenseToEdit(e); setIsModalOpen(true); }}><Edit2 className="w-4 h-4 text-slate-400"/></button>
                  <button type="button" onClick={() => setExpenseToDelete(e)}><Trash2 className="w-4 h-4 text-red-400"/></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {isModalOpen && (
          <VehicleExpensesFormModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={loadExpenses} expenseToEdit={expenseToEdit} vehicleId={vehicle.id} vehicleName={vehicle.name} />
      )}
      
      {expenseToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
            <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 w-full max-w-sm">
                <h3 className="text-white font-bold mb-2">Excluir esta despesa?</h3>
                <div className="flex gap-2">
                    <button type="button" onClick={() => setExpenseToDelete(null)} className="flex-1 p-2 bg-slate-800 rounded text-white">Cancelar</button>
                    <button type="button" disabled={isDeleting} onClick={confirmDelete} className="flex-1 p-2 bg-red-600 rounded text-white disabled:opacity-50">{isDeleting ? 'Excluindo...' : 'Excluir'}</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
