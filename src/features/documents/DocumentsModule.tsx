import React, { useState, useEffect, useMemo } from 'react';
import { Vehicle } from '../../types';
import { VehicleDocument } from '../../types/documents';
import { LoadingState, ErrorState } from '../../components/common/CommonComponents';
import { documentsService } from './documentsService';
import { FileText, Plus, CheckCircle, Trash2, Edit } from 'lucide-react';
import { DocumentModal } from './DocumentModal';

export const DocumentsModule = ({ vehicle }: { vehicle: Vehicle }) => {
  const [documents, setDocuments] = useState<VehicleDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<VehicleDocument | null>(null);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const data = await documentsService.getDocuments(vehicle.id);
      setDocuments(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadDocuments(); }, [vehicle.id]);

  const openModal = () => {
    setSelectedDocument(null);
    setIsModalOpen(true);
  };
  
  const handleEdit = (doc: VehicleDocument) => {
    setSelectedDocument(doc);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedDocument(null);
  };

  const handleSuccess = () => {
      loadDocuments();
      closeModal();
  };

  const filtered = useMemo(() => {
    return documents.filter(d => 
        (filterStatus === 'all' || d.status === filterStatus) &&
        (filterType === 'all' || d.document_type === filterType)
    );
  }, [documents, filterStatus, filterType]);

  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0,0,0,0);
    return documents.reduce((acc, d) => {
        if(d.status === 'PENDING') {
            acc.pending++;
            if(d.due_date && new Date(d.due_date) < today) acc.expired++;
            else acc.totalAmount += (d.amount || 0);
        } else if (d.status === 'PAID') acc.paid++;
        return acc;
    }, { pending: 0, expired: 0, paid: 0, totalAmount: 0 });
  }, [documents]);

  const handleMarkPaid = async (id: string) => {
      await documentsService.markAsPaid(id, new Date().toISOString().split('T')[0]);
      loadDocuments();
  };

  if (loading) return <LoadingState message="Carregando documentos..." />;
  if (error) return <ErrorState message={error} onRetry={loadDocuments} />;

  return (
    <div className="p-6 bg-slate-900 rounded-2xl border border-slate-800 text-slate-100">
        <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-2xl text-white">Documentos: {vehicle.name}</h3>
            <button onClick={openModal} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
                <Plus className="w-4 h-4" /> Novo documento
            </button>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="p-4 bg-slate-800 rounded-xl">
                <p className="text-slate-400 text-xs">Pendentes</p>
                <p className="text-white text-lg font-bold">{stats.pending}</p>
            </div>
            <div className="p-4 bg-red-950/30 rounded-xl border border-red-900/50">
                <p className="text-red-400 text-xs">Vencidos</p>
                <p className="text-white text-lg font-bold">{stats.expired}</p>
            </div>
            <div className="p-4 bg-emerald-950/30 rounded-xl border border-emerald-900/50">
                <p className="text-emerald-400 text-xs">Pagos</p>
                <p className="text-white text-lg font-bold">{stats.paid}</p>
            </div>
            <div className="p-4 bg-slate-800 rounded-xl">
                <p className="text-slate-400 text-xs">Total Previsto</p>
                <p className="text-white text-lg font-bold">R$ {stats.totalAmount.toFixed(2)}</p>
            </div>
        </div>

        <div className="flex gap-2 mb-4">
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="bg-slate-800 p-2 rounded text-sm text-white border border-slate-700">
                <option value="all">Todos Status</option>
                <option value="PENDING">Pendentes</option>
                <option value="PAID">Pagos</option>
            </select>
        </div>

         {filtered.length === 0 ? (
            <div className="p-8 text-center bg-slate-950 rounded-xl border border-slate-800">
                <p className="text-slate-400 mb-4">Você ainda não cadastrou documentos ou obrigações para este veículo.</p>
                <button onClick={openModal} className="text-blue-400 hover:text-blue-300 font-medium">+ Adicionar documento</button>
            </div>
        ) : (
            <div className="space-y-2">
                {filtered.map(d => (
                    <div key={d.id} className="p-4 bg-slate-950 rounded-lg flex items-center justify-between border border-slate-800">
                        <div>
                            <p className="font-bold">{d.title}</p>
                            <p className="text-xs text-slate-400">
                                {d.document_type} 
                                {d.amount !== null && d.amount !== undefined && ` • R$ ${d.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                                {d.due_date && ` • Venc: ${new Date(d.due_date).toLocaleDateString('pt-BR')}`}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={() => handleEdit(d)} className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 p-2 rounded" title="Editar">
                                <Edit className="w-4 h-4" />
                            </button>
                            {d.status === 'PENDING' && (
                                <button onClick={() => handleMarkPaid(d.id)} className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white p-2 rounded" title="Marcar como Pago">
                                    <CheckCircle className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        )}
        <DocumentModal isOpen={isModalOpen} onClose={closeModal} onSuccess={handleSuccess} vehicle={vehicle} document={selectedDocument} />
    </div>
  );
};
