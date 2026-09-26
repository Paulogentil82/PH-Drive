import React, { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { Vehicle } from '../../types';
import { DocumentType, DocumentStatus, VehicleDocument } from '../../types/documents';
import { documentsService } from './documentsService';
import { parsePtBrNumber, formatPtBrNumber } from '../../utils/numberParser';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  vehicle: Vehicle;
  document?: VehicleDocument | null;
}

export function DocumentModal({ isOpen, onClose, onSuccess, vehicle, document }: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [amountInput, setAmountInput] = useState(() => {
    return document ? formatPtBrNumber(document.amount) : '';
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    
    const parsedAmount = parsePtBrNumber(amountInput);
    if (amountInput && parsedAmount === null) {
        setError('Informe um valor válido.');
        setIsSubmitting(false);
        return;
    }

    const formData = new FormData(e.currentTarget);
    const data = {
        vehicle_id: vehicle.id,
        document_type: formData.get('document_type') as DocumentType,
        title: formData.get('title') as string,
        reference_year: formData.get('reference_year') ? parseInt(formData.get('reference_year') as string) : null,
        issue_date: formData.get('issue_date') as string || null,
        due_date: formData.get('due_date') as string || null,
        amount: parsedAmount,
        status: formData.get('status') as DocumentStatus,
        paid_at: formData.get('paid_at') as string || null,
        notes: formData.get('notes') as string || null,
    };

    console.debug("DOCUMENT_AMOUNT_RAW", amountInput);
    console.debug("DOCUMENT_AMOUNT_PARSED", parsedAmount);
    console.debug("DOCUMENT_PAYLOAD_AMOUNT", data.amount);

    try {
        if (document) {
            await documentsService.updateDocument(document.id, data);
        } else {
            await documentsService.addDocument(data);
        }
        onSuccess();
        onClose();
    } catch (err: any) {
        setError(err.message || 'Erro ao salvar documento.');
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-white">{document ? 'Editar Documento' : 'Novo Documento'}</h3>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        
        {error && <p className="text-red-400 text-sm mb-4 bg-red-950/50 p-3 rounded-lg border border-red-900/50">{error}</p>}

        <form id="document-form" onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="block text-xs text-slate-400 mb-1">Veículo</label>
                <div className="p-2.5 bg-slate-800 rounded-lg text-slate-300 border border-slate-700">{vehicle.name}</div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs text-slate-400 mb-1">Tipo</label>
                    <select name="document_type" defaultValue={document?.document_type || 'IPVA'} required className="w-full p-2.5 bg-slate-800 rounded-lg text-white border border-slate-700">
                        <option value="IPVA">IPVA</option>
                        <option value="LICENCIAMENTO">Licenciamento</option>
                        <option value="SEGURO">Seguro</option>
                        <option value="VISTORIA">Vistoria</option>
                        <option value="OUTRO">Outro</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs text-slate-400 mb-1">Título</label>
                    <input name="title" defaultValue={document?.title || ''} required className="w-full p-2.5 bg-slate-800 rounded-lg text-white border border-slate-700" />
                </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs text-slate-400 mb-1">Ano Ref.</label>
                    <input type="number" name="reference_year" defaultValue={document?.reference_year || ''} className="w-full p-2.5 bg-slate-800 rounded-lg text-white border border-slate-700" />
                </div>
                <div>
                    <label className="block text-xs text-slate-400 mb-1">Valor (R$)</label>
                    <input type="text" value={amountInput} onChange={(e) => setAmountInput(e.target.value)} placeholder="0,00" className="w-full p-2.5 bg-slate-800 rounded-lg text-white border border-slate-700" />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs text-slate-400 mb-1">Data Emissão</label>
                    <input type="date" name="issue_date" defaultValue={document?.issue_date || ''} className="w-full p-2.5 bg-slate-800 rounded-lg text-white border border-slate-700" />
                </div>
                <div>
                    <label className="block text-xs text-slate-400 mb-1">Data Vencimento</label>
                    <input type="date" name="due_date" defaultValue={document?.due_date || ''} className="w-full p-2.5 bg-slate-800 rounded-lg text-white border border-slate-700" />
                </div>
            </div>
            
            <div>
                <label className="block text-xs text-slate-400 mb-1">Status</label>
                <select name="status" defaultValue={document?.status || 'PENDING'} required className="w-full p-2.5 bg-slate-800 rounded-lg text-white border border-slate-700">
                    <option value="PENDING">Pendente</option>
                    <option value="PAID">Pago</option>
                </select>
            </div>

            <div>
                <label className="block text-xs text-slate-400 mb-1">Data Pagamento (se pago)</label>
                <input type="date" name="paid_at" defaultValue={document?.paid_at || ''} className="w-full p-2.5 bg-slate-800 rounded-lg text-white border border-slate-700" />
            </div>
            
            <div>
                <label className="block text-xs text-slate-400 mb-1">Observações</label>
                <textarea name="notes" defaultValue={document?.notes || ''} className="w-full p-2.5 bg-slate-800 rounded-lg text-white border border-slate-700" rows={3}></textarea>
            </div>
        </form>

        <div className="sticky bottom-0 pt-6 mt-6 bg-slate-900 border-t border-slate-800 flex gap-3 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-lg">Cancelar</button>
            <button type="submit" form="document-form" disabled={isSubmitting} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg flex items-center gap-2">
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Salvar
            </button>
        </div>
      </div>
    </div>
  );
}
