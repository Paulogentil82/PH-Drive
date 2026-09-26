import React, { useState } from 'react';
import { vehicleExpensesService } from './vehicleExpensesService';
import { VehicleExpense } from '../../types/vehicle_expense';

const EXPENSE_CATEGORIES = [
  'Estacionamento', 'Pedágio', 'Lavagem', 'Seguro', 'IPVA', 'Licenciamento',
  'Multa', 'Acessórios', 'Peças', 'Documentação', 'Outro'
];
const PAYMENT_METHODS = ['Dinheiro', 'Pix', 'Débito', 'Crédito', 'Boleto', 'Outro'];
const FREQUENCIES = ['Mensal', 'Trimestral', 'Semestral', 'Anual', 'Outro'];

export const VehicleExpensesFormModal = ({ isOpen, onClose, onSave, expenseToEdit, vehicleId, vehicleName }: { 
  isOpen: boolean, 
  onClose: () => void, 
  onSave: () => void,
  expenseToEdit?: VehicleExpense | null,
  vehicleId: string,
  vehicleName: string
}) => {
  const [formData, setFormData] = useState<any>(expenseToEdit || {
    expense_date: new Date().toISOString().split('T')[0],
    category: 'Estacionamento',
    custom_category: '',
    description: '',
    amount: '',
    vendor_name: '',
    payment_method: 'Dinheiro',
    custom_payment_method: '',
    recurring: false,
    frequency: 'Mensal',
    notes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(formData.amount.replace(',', '.'));
    if (isNaN(amount) || amount <= 0) {
        setError('Informe um valor maior que zero.');
        return;
    }
    setIsSubmitting(true);
    try {
        const expenseData = {
            ...formData,
            category: formData.category === 'Outro' ? formData.custom_category : formData.category,
            payment_method: formData.payment_method === 'Outro' ? formData.custom_payment_method : formData.payment_method,
            amount: amount,
            expense_date: new Date(formData.expense_date).toISOString(),
        };
        delete expenseData.custom_category;
        delete expenseData.custom_payment_method;
        delete expenseData.frequency; // Metadado visual apenas

        if (expenseToEdit) {
            await vehicleExpensesService.updateExpense(expenseToEdit.id, expenseData);
        } else {
            await vehicleExpensesService.addExpense({ ...expenseData, vehicle_id: vehicleId } as any);
        }
        onSave();
        onClose();
    } catch (error) {
        console.error(error);
        alert('Erro ao salvar despesa.');
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <form onSubmit={handleSubmit} className="bg-slate-900 rounded-xl border border-slate-800 w-full max-w-md flex flex-col max-h-[90vh]">
        <div className="p-6 overflow-y-auto">
            <h2 className="text-xl font-bold mb-4 text-white">{expenseToEdit ? 'Editar' : 'Nova'} Despesa</h2>
            
            <p className="text-xs text-slate-400 mb-4">Veículo: {vehicleName}</p>

            <label className="block text-xs text-slate-400 mb-1">Data</label>
            <input type="date" value={formData.expense_date.split('T')[0]} onChange={e => setFormData({...formData, expense_date: e.target.value})} className="block w-full p-2 mb-2 bg-slate-950 border border-slate-700 rounded text-white" required />
            
            <label className="block text-xs text-slate-400 mb-1">Categoria</label>
            <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="block w-full p-2 mb-2 bg-slate-950 border border-slate-700 rounded text-white">
                {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {formData.category === 'Outro' && (
                <input type="text" placeholder="Categoria personalizada" value={formData.custom_category} onChange={e => setFormData({...formData, custom_category: e.target.value})} className="block w-full p-2 mb-2 bg-slate-950 border border-slate-700 rounded text-white" required />
            )}

            <label className="block text-xs text-slate-400 mb-1">Descrição</label>
            <input type="text" placeholder="Descrição da despesa (opcional)" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="block w-full p-2 mb-2 bg-slate-950 border border-slate-700 rounded text-white" />
            
            <label className="block text-xs text-slate-400 mb-1">Valor (R$)</label>
            <input type="text" placeholder="0,00" value={formData.amount} onChange={e => {setFormData({...formData, amount: e.target.value}); setError(null);}} className="block w-full p-2 mb-1 bg-slate-950 border border-slate-700 rounded text-white" required />
            {error && <p className="text-xs text-red-400 mb-2">{error}</p>}
            
            <label className="block text-xs text-slate-400 mb-1">Fornecedor (opcional)</label>
            <input type="text" placeholder="Fornecedor (opcional)" value={formData.vendor_name} onChange={e => setFormData({...formData, vendor_name: e.target.value})} className="block w-full p-2 mb-2 bg-slate-950 border border-slate-700 rounded text-white" />

            <label className="block text-xs text-slate-400 mb-1">Forma de pagamento</label>
            <select value={formData.payment_method} onChange={e => setFormData({...formData, payment_method: e.target.value})} className="block w-full p-2 mb-2 bg-slate-950 border border-slate-700 rounded text-white">
                {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            {formData.payment_method === 'Outro' && (
                <input type="text" placeholder="Forma de pagamento personalizada" value={formData.custom_payment_method} onChange={e => setFormData({...formData, custom_payment_method: e.target.value})} className="block w-full p-2 mb-2 bg-slate-950 border border-slate-700 rounded text-white" required />
            )}

            <label className="flex items-center gap-2 mb-2">
                <input type="checkbox" checked={formData.recurring} onChange={e => setFormData({...formData, recurring: e.target.checked})} />
                <span className="text-sm text-white">Despesa recorrente</span>
            </label>
            {formData.recurring && (
                <div className='mb-2'>
                    <label className="block text-xs text-slate-400 mb-1">Frequência</label>
                    <select value={formData.frequency} onChange={e => setFormData({...formData, frequency: e.target.value})} className="block w-full p-2 bg-slate-950 border border-slate-700 rounded text-white">
                        {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                </div>
            )}

            <label className="block text-xs text-slate-400 mb-1">Observações (opcional)</label>
            <textarea placeholder="Observações (opcional)" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="block w-full p-2 mb-4 bg-slate-950 border border-slate-700 rounded text-white" />
        </div>

        <div className="flex gap-2 p-4 bg-slate-950 border-t border-slate-800 rounded-b-xl">
          <button type="button" onClick={onClose} className="flex-1 p-2 bg-slate-800 rounded text-white">Cancelar</button>
          <button type="submit" disabled={isSubmitting} className="flex-1 p-2 bg-blue-600 rounded text-white disabled:opacity-50">{isSubmitting ? 'Salvando...' : 'Salvar'}</button>
        </div>
      </form>
    </div>
  );
};
