import React, { useState, useEffect, useMemo } from 'react';
import { Vehicle } from '../../types';
import { VehicleTire, TirePosition, TireStatus } from '../../types/tires';
import { LoadingState, ErrorState } from '../../components/common/CommonComponents';
import { tiresService, mapTireErrorToFriendlyMessage } from './tiresService';
import { parsePtBrNumber, formatPtBrNumber } from '../../utils/numberParser';
import { 
  Disc, 
  Plus, 
  Trash2, 
  Edit, 
  Archive, 
  AlertTriangle, 
  CheckCircle, 
  History, 
  X, 
  Loader2, 
  Calendar, 
  TrendingUp, 
  AlertCircle 
} from 'lucide-react';

interface Props {
  vehicle: Vehicle;
}

export function TiresModule({ vehicle }: Props) {
  const [tires, setTires] = useState<VehicleTire[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'REMOVED'>('ACTIVE');
  const [positionFilter, setPositionFilter] = useState<string>('ALL');

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTire, setEditingTire] = useState<VehicleTire | null>(null);
  const [isRemovalOpen, setIsRemovalOpen] = useState(false);
  const [removingTire, setRemovingTire] = useState<VehicleTire | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deletingTire, setDeletingTire] = useState<VehicleTire | null>(null);

  // Fields for removal modal
  const [removalDate, setRemovalDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [removalOdometer, setRemovalOdometer] = useState('');
  const [removalError, setRemovalError] = useState<string | null>(null);

  // Load tires list
  const loadTires = async () => {
    try {
      setLoading(true);
      const data = await tiresService.getTires(vehicle.id);
      setTires(data);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar pneus.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTires();
  }, [vehicle.id]);

  // Translate position to user friendly label
  const translatePosition = (pos: TirePosition): string => {
    switch (pos) {
      case 'FRONT': return 'Dianteiro';
      case 'REAR': return 'Traseiro';
      case 'FRONT_LEFT': return 'Dianteiro Esquerdo';
      case 'FRONT_RIGHT': return 'Dianteiro Direito';
      case 'REAR_LEFT': return 'Traseiro Esquerdo';
      case 'REAR_RIGHT': return 'Traseiro Direito';
      case 'SPARE': return 'Estepe';
      default: return 'Outro';
    }
  };

  // Safe timezone friendly date formatter
  const formatCivilDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '—';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  // Status derivative calculations for active tires
  const calculateDerivedStats = (tire: VehicleTire) => {
    if (tire.status === 'REMOVED') {
      return {
        kmRodados: (tire.removed_odometer_km || 0) - tire.installed_odometer_km,
        kmRestantes: null,
        severity: 'REMOVED' as const,
        label: 'Removido'
      };
    }

    const kmRodados = vehicle.odometer_km - tire.installed_odometer_km;
    
    if (tire.expected_life_km === null || tire.expected_life_km === undefined) {
      return {
        kmRodados,
        kmRestantes: null,
        severity: 'SEM_PREVISAO' as const,
        label: 'Sem Previsão'
      };
    }

    const kmRestantes = tire.expected_life_km - kmRodados;
    let severity: 'OK' | 'PROXIMO' | 'URGENTE' | 'VENCIDO' = 'OK';
    let label = 'OK';

    if (kmRestantes <= 0) {
      severity = 'VENCIDO';
      label = 'Vencido';
    } else if (kmRestantes <= 500) {
      severity = 'URGENTE';
      label = 'Urgente';
    } else if (kmRestantes <= 1500) {
      severity = 'PROXIMO';
      label = 'Próximo';
    }

    return {
      kmRodados,
      kmRestantes,
      severity,
      label
    };
  };

  // Global derived counters
  const stats = useMemo(() => {
    let activeCount = 0;
    let proximoCount = 0;
    let vencidoCount = 0;
    
    tires.forEach(t => {
      if (t.status === 'ACTIVE') {
        activeCount++;
        const derived = calculateDerivedStats(t);
        if (derived.severity === 'VENCIDO') vencidoCount++;
        else if (derived.severity === 'PROXIMO' || derived.severity === 'URGENTE') proximoCount++;
      }
    });

    return {
      total: tires.length,
      active: activeCount,
      proximo: proximoCount,
      vencido: vencidoCount
    };
  }, [tires, vehicle.odometer_km]);

  // Filtered tires
  const filteredTires = useMemo(() => {
    return tires.filter(t => {
      const matchStatus = 
        statusFilter === 'ALL' || 
        (statusFilter === 'ACTIVE' && t.status === 'ACTIVE') ||
        (statusFilter === 'REMOVED' && t.status === 'REMOVED');
      
      const matchPosition = positionFilter === 'ALL' || t.position === positionFilter;
      return matchStatus && matchPosition;
    });
  }, [tires, statusFilter, positionFilter]);

  // Position select choices based on vehicle type
  const positionOptions = useMemo(() => {
    if (vehicle.type === 'MOTORCYCLE') {
      return [
        { value: 'FRONT', label: 'Dianteiro' },
        { value: 'REAR', label: 'Traseiro' },
        { value: 'SPARE', label: 'Estepe' },
        { value: 'OTHER', label: 'Outro' },
      ];
    } else {
      return [
        { value: 'FRONT_LEFT', label: 'Dianteiro Esquerdo' },
        { value: 'FRONT_RIGHT', label: 'Dianteiro Direito' },
        { value: 'REAR_LEFT', label: 'Traseiro Esquerdo' },
        { value: 'REAR_RIGHT', label: 'Traseiro Direito' },
        { value: 'FRONT', label: 'Dianteiro' },
        { value: 'REAR', label: 'Traseiro' },
        { value: 'SPARE', label: 'Estepe' },
        { value: 'OTHER', label: 'Outro' },
      ];
    }
  }, [vehicle.type]);

  // Trigger modal for removal
  const openRemoval = (tire: VehicleTire) => {
    setRemovingTire(tire);
    setRemovalDate(new Date().toISOString().split('T')[0]);
    setRemovalOdometer(vehicle.odometer_km.toString());
    setRemovalError(null);
    setIsRemovalOpen(true);
  };

  // Submit removal
  const handleRemovalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!removingTire) return;

    setRemovalError(null);
    const parsedKm = parseFloat(removalOdometer);
    if (isNaN(parsedKm) || parsedKm < 0) {
      setRemovalError('Informe uma quilometragem válida.');
      return;
    }

    if (parsedKm < removingTire.installed_odometer_km) {
      setRemovalError(`Odômetro de remoção não pode ser menor que o de instalação (${removingTire.installed_odometer_km} km).`);
      return;
    }

    try {
      await tiresService.removeTire(removingTire.id, removalDate, parsedKm);
      loadTires();
      setIsRemovalOpen(false);
      setRemovingTire(null);
    } catch (err: any) {
      setRemovalError(err.message || 'Erro ao registrar remoção do pneu.');
    }
  };

  // Trigger delete verification
  const openDelete = (tire: VehicleTire) => {
    setDeletingTire(tire);
    setIsDeleteOpen(true);
  };

  const handleDeleteSubmit = async () => {
    if (!deletingTire) return;
    try {
      await tiresService.deleteTire(deletingTire.id);
      loadTires();
      setIsDeleteOpen(false);
      setDeletingTire(null);
    } catch (err: any) {
      alert(err.message || 'Erro ao deletar pneu.');
    }
  };

  // Trigger create/edit form
  const openForm = (tire?: VehicleTire, defaultPosition?: TirePosition) => {
    if (tire) {
      setEditingTire(tire);
    } else {
      setEditingTire(null);
    }
    setIsFormOpen(true);
  };

  if (loading && tires.length === 0) return <LoadingState message="Carregando dados dos pneus..." />;
  if (error) return <ErrorState message={error} onRetry={loadTires} />;

  return (
    <div className="space-y-8">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Controle de Pneus</h1>
          <p className="text-sm text-slate-400 mt-1">
            Veículo: <span className="font-semibold text-blue-400">{vehicle.name}</span> · Odômetro Atual: <span className="font-mono text-slate-200">{vehicle.odometer_km.toLocaleString('pt-BR')} km</span>
          </p>
        </div>
        <div>
          <button 
            onClick={() => openForm()}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition shadow-lg shadow-blue-600/20"
          >
            <Plus className="w-4 h-4" /> Cadastrar pneu
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col justify-between">
          <span className="text-slate-400 text-xs font-medium uppercase tracking-wider">Ativos</span>
          <span className="text-2xl font-bold text-white mt-2 font-mono tabular-nums">{stats.active}</span>
        </div>
        <div className="p-5 bg-red-950/20 border border-red-900/40 rounded-2xl flex flex-col justify-between">
          <span className="text-red-400 text-xs font-medium uppercase tracking-wider">Vencidos por km</span>
          <span className="text-2xl font-bold text-white mt-2 font-mono tabular-nums">{stats.vencido}</span>
        </div>
        <div className="p-5 bg-yellow-950/20 border border-yellow-900/40 rounded-2xl flex flex-col justify-between">
          <span className="text-yellow-400 text-xs font-medium uppercase tracking-wider">Próximos da Troca</span>
          <span className="text-2xl font-bold text-white mt-2 font-mono tabular-nums">{stats.proximo}</span>
        </div>
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col justify-between">
          <span className="text-slate-400 text-xs font-medium uppercase tracking-wider">Total Cadastrados</span>
          <span className="text-2xl font-bold text-white mt-2 font-mono tabular-nums">{stats.total}</span>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-slate-900/50 border border-slate-800 rounded-2xl">
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Status filter segment controls */}
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
            {(['ACTIVE', 'REMOVED', 'ALL'] as const).map(status => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-all whitespace-nowrap ${
                  statusFilter === status 
                    ? 'bg-blue-600 text-white shadow' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {status === 'ALL' ? 'Todos' : status === 'ACTIVE' ? 'Ativos' : 'Removidos'}
              </button>
            ))}
          </div>

          {/* Position Selector */}
          <select 
            value={positionFilter} 
            onChange={(e) => setPositionFilter(e.target.value)}
            className="p-2 bg-slate-950 rounded-xl border border-slate-800 text-slate-300 text-xs font-medium focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">Todas posições</option>
            {positionOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main List Grid */}
      {filteredTires.length === 0 ? (
        <div className="p-12 text-center border border-slate-800/80 rounded-2xl bg-slate-900/40 flex flex-col items-center justify-center">
          <Disc className="w-10 h-10 text-slate-500 mb-4 animate-pulse" />
          <h3 className="text-lg font-bold text-white">Você ainda não cadastrou pneus para este veículo.</h3>
          <p className="text-slate-400 text-sm max-w-sm mt-1 mb-6">Mantenha a segurança em dia acompanhando o desgaste de cada posição.</p>
          <button 
            onClick={() => openForm()}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition"
          >
            Adicionar pneu
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTires.map(t => {
            const derived = calculateDerivedStats(t);
            return (
              <div key={t.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between shadow-lg relative overflow-hidden">
                
                {/* Header status bar */}
                <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Posição</span>
                    <h3 className="text-base font-bold text-white mt-0.5">{translatePosition(t.position)}</h3>
                  </div>
                  
                  {/* Status badge - clean styling without round capsules if possible, or soft small badges */}
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg ${
                    derived.severity === 'REMOVED' ? 'bg-slate-800 text-slate-400' :
                    derived.severity === 'VENCIDO' ? 'bg-red-950/60 text-red-400 border border-red-900/30' :
                    derived.severity === 'URGENTE' ? 'bg-orange-950/60 text-orange-400 border border-orange-900/30' :
                    derived.severity === 'PROXIMO' ? 'bg-yellow-950/60 text-yellow-400 border border-yellow-900/30' :
                    derived.severity === 'OK' ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-900/30' :
                    'bg-slate-850 text-slate-400'
                  }`}>
                    {derived.label.toUpperCase()}
                  </span>
                </div>

                {/* Body Details */}
                <div className="space-y-2 text-xs text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Marca / Modelo:</span>
                    <span className="font-semibold text-slate-200">{t.brand || '—'} {t.model && `/ ${t.model}`}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Medida:</span>
                    <span className="font-semibold text-slate-200">{t.tire_size}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Instalação:</span>
                    <span>{formatCivilDate(t.installed_at)} · <span className="font-mono text-slate-400">{t.installed_odometer_km.toLocaleString('pt-BR')} km</span></span>
                  </div>
                  
                  {t.status === 'REMOVED' && (
                    <div className="flex justify-between bg-slate-950/40 p-2 rounded-lg border border-slate-850 mt-1">
                      <span className="text-slate-500">Remoção:</span>
                      <span className="text-red-400">{formatCivilDate(t.removed_at)} · <span className="font-mono">{t.removed_odometer_km?.toLocaleString('pt-BR')} km</span></span>
                    </div>
                  )}

                  <div className="border-t border-slate-800/60 my-3 pt-3 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Km rodados:</span>
                      <span className="font-semibold font-mono text-slate-200">{derived.kmRodados.toLocaleString('pt-BR')} km</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-slate-500">Vida útil estimada:</span>
                      <span className="font-semibold text-slate-200">
                        {t.expected_life_km ? `${t.expected_life_km.toLocaleString('pt-BR')} km` : 'Não definida'}
                      </span>
                    </div>

                    {t.status === 'ACTIVE' && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Km restantes:</span>
                        <span className={`font-bold font-mono ${
                          derived.severity === 'VENCIDO' ? 'text-red-400' :
                          derived.severity === 'URGENTE' ? 'text-orange-400' :
                          derived.severity === 'PROXIMO' ? 'text-yellow-400' :
                          derived.severity === 'OK' ? 'text-emerald-400' :
                          'text-slate-400'
                        }`}>
                          {derived.kmRestantes !== null ? `${derived.kmRestantes.toLocaleString('pt-BR')} km` : '—'}
                        </span>
                      </div>
                    )}
                  </div>

                  {t.notes && (
                    <p className="text-[11px] text-slate-500 italic line-clamp-2 mt-2 bg-slate-950/20 p-2 rounded-lg border border-slate-800/40">
                      Observação: {t.notes}
                    </p>
                  )}
                </div>

                {/* Actions Footer */}
                <div className="flex items-center justify-end gap-2 mt-5 pt-3 border-t border-slate-800">
                  <button 
                    onClick={() => openForm(t)}
                    className="p-2 bg-slate-850 hover:bg-slate-800 text-slate-300 rounded-lg transition"
                    title="Editar pneu"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={() => openDelete(t)}
                    className="p-2 bg-red-950/20 hover:bg-red-950/40 text-red-400 border border-red-900/20 rounded-lg transition"
                    title="Excluir cadastro"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  {t.status === 'ACTIVE' && (
                    <button 
                      onClick={() => openRemoval(t)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-slate-850 hover:bg-slate-800 text-slate-200 text-xs font-semibold rounded-lg transition"
                    >
                      <Archive className="w-3.5 h-3.5 text-slate-400" /> Remover
                    </button>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Tires History Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center gap-2.5 mb-6">
          <History className="w-5 h-5 text-blue-500" />
          <h2 className="text-xl font-bold text-white">Histórico de Pneus</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                <th className="py-3 px-4">Posição</th>
                <th className="py-3 px-4">Marca / Modelo</th>
                <th className="py-3 px-4">Medida</th>
                <th className="py-3 px-4">Instalação (Data/Km)</th>
                <th className="py-3 px-4">Remoção (Data/Km)</th>
                <th className="py-3 px-4 text-right">Km Utilizados</th>
                <th className="py-3 px-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/55">
              {tires.filter(t => t.status === 'REMOVED').length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 italic">
                    Nenhum pneu no histórico de remoções.
                  </td>
                </tr>
              ) : (
                tires.filter(t => t.status === 'REMOVED').map(t => {
                  const kmUtilizados = t.removed_odometer_km !== null 
                    ? t.removed_odometer_km - t.installed_odometer_km 
                    : null;
                  return (
                    <tr key={t.id} className="hover:bg-slate-950/20 text-slate-300">
                      <td className="py-3.5 px-4 font-bold text-white">{translatePosition(t.position)}</td>
                      <td className="py-3.5 px-4">{t.brand || '—'} {t.model && `/ ${t.model}`}</td>
                      <td className="py-3.5 px-4 font-mono">{t.tire_size}</td>
                      <td className="py-3.5 px-4">
                        <span>{formatCivilDate(t.installed_at)}</span>
                        <span className="block text-[10px] text-slate-500 font-mono">{t.installed_odometer_km.toLocaleString('pt-BR')} km</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-red-400/90">{formatCivilDate(t.removed_at)}</span>
                        <span className="block text-[10px] text-slate-500 font-mono">{t.removed_odometer_km?.toLocaleString('pt-BR')} km</span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-200">
                        {kmUtilizados !== null ? `${kmUtilizados.toLocaleString('pt-BR')} km` : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {/* If position doesn't have active tire, let installer put replacement directly */}
                        {!tires.some(active => active.position === t.position && active.status === 'ACTIVE') && (
                          <button 
                            onClick={() => openForm(undefined, t.position)}
                            className="text-[10px] font-bold text-blue-400 hover:text-blue-300 border border-blue-900/30 hover:border-blue-500/40 bg-blue-950/20 px-2 py-1 rounded-md transition"
                          >
                            Instalar novo nesta posição
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* FORM MODAL (CREATE / EDIT) */}
      <TireFormModal 
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSuccess={() => {
          setIsFormOpen(false);
          loadTires();
        }}
        vehicle={vehicle}
        editingTire={editingTire}
        positionOptions={positionOptions}
      />

      {/* REMOVAL REGISTER MODAL */}
      {isRemovalOpen && removingTire && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-white">Registrar Remoção de Pneu</h3>
              <button onClick={() => setIsRemovalOpen(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {removalError && (
              <p className="text-red-400 text-xs mb-4 bg-red-950/40 p-3 rounded-xl border border-red-900/30">
                {removalError}
              </p>
            )}

            <form onSubmit={handleRemovalSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Posição</label>
                <div className="p-2.5 bg-slate-950 border border-slate-800 text-slate-300 rounded-xl text-xs font-bold">
                  {translatePosition(removingTire.position)}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Data da Remoção</label>
                <input 
                  type="date"
                  required
                  value={removalDate}
                  onChange={(e) => setRemovalDate(e.target.value)}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Odômetro de Remoção (km)</label>
                <input 
                  type="number"
                  required
                  placeholder="Ex: 12500"
                  value={removalOdometer}
                  onChange={(e) => setRemovalOdometer(e.target.value)}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 block mt-1 font-mono">
                  Quilometragem atual do veículo: {vehicle.odometer_km.toLocaleString('pt-BR')} km
                </span>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-slate-800">
                <button 
                  type="button" 
                  onClick={() => setIsRemovalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl transition"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl transition shadow-lg shadow-blue-600/20"
                >
                  Confirmar Remoção
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EXCLUSION CONFIRMATION MODAL */}
      {isDeleteOpen && deletingTire && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6">
            <div className="flex items-center gap-3 text-red-500 mb-4">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-white">Excluir Registro de Pneu?</h3>
            </div>
            
            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              Excluir permanentemente este registro de pneu? Esta ação removerá o pneu e todo o seu histórico da base de dados e não pode ser desfeita. Use apenas para correção de erros de cadastro.
            </p>

            <div className="flex gap-3 justify-end">
              <button 
                type="button" 
                onClick={() => setIsDeleteOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl transition"
              >
                Cancelar
              </button>
              <button 
                onClick={handleDeleteSubmit}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-semibold text-xs rounded-xl transition shadow-lg shadow-red-600/20"
              >
                Excluir permanentemente
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// FORM MODAL COMPONENT (CREATE & EDIT)
interface FormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  vehicle: Vehicle;
  editingTire: VehicleTire | null;
  positionOptions: { value: string; label: string }[];
}

function TireFormModal({ isOpen, onClose, onSuccess, vehicle, editingTire, positionOptions }: FormModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form Fields
  const [position, setPosition] = useState<TirePosition>('FRONT');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [tireSize, setTireSize] = useState('');
  const [installedAt, setInstalledAt] = useState(() => new Date().toISOString().split('T')[0]);
  const [installedOdometer, setInstalledOdometer] = useState('');
  const [expectedLife, setExpectedLife] = useState('');
  const [notes, setNotes] = useState('');

  // Initial values setup
  useEffect(() => {
    if (isOpen) {
      setError(null);
      if (editingTire) {
        setPosition(editingTire.position);
        setBrand(editingTire.brand || '');
        setModel(editingTire.model || '');
        setTireSize(editingTire.tire_size);
        setInstalledAt(editingTire.installed_at);
        setInstalledOdometer(editingTire.installed_odometer_km.toString());
        setExpectedLife(editingTire.expected_life_km ? editingTire.expected_life_km.toString() : '');
        setNotes(editingTire.notes || '');
      } else {
        // Find first position option or default to FRONT
        const firstPos = positionOptions.length > 0 ? positionOptions[0].value as TirePosition : 'FRONT';
        setPosition(firstPos);
        setBrand('');
        setModel('');
        setTireSize('');
        setInstalledAt(new Date().toISOString().split('T')[0]);
        setInstalledOdometer(vehicle.odometer_km.toString());
        setExpectedLife('');
        setNotes('');
      }
    }
  }, [isOpen, editingTire, vehicle, positionOptions]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    // Validations
    if (!tireSize.trim()) {
      setError('A medida do pneu é obrigatória.');
      setIsSubmitting(false);
      return;
    }

    const odometerParsed = parseFloat(installedOdometer);
    if (isNaN(odometerParsed) || odometerParsed < 0) {
      setError('Odômetro de instalação inválido.');
      setIsSubmitting(false);
      return;
    }

    const lifeParsed = expectedLife ? parseFloat(expectedLife) : null;
    if (expectedLife && (lifeParsed === null || isNaN(lifeParsed) || lifeParsed <= 0)) {
      setError('Vida útil deve ser um número maior que zero.');
      setIsSubmitting(false);
      return;
    }

    const payload = {
      vehicle_id: vehicle.id,
      position,
      brand: brand.trim() || null,
      model: model.trim() || null,
      tire_size: tireSize.trim(),
      installed_at: installedAt,
      installed_odometer_km: odometerParsed,
      expected_life_km: lifeParsed,
      notes: notes.trim() || null,
    };

    try {
      if (editingTire) {
        await tiresService.updateTire(editingTire.id, {
          ...payload,
          status: editingTire.status,
          removed_at: editingTire.removed_at,
          removed_odometer_km: editingTire.removed_odometer_km
        });
      } else {
        await tiresService.addTire(payload);
      }
      onSuccess();
    } catch (err: any) {
      console.debug('Error saving tire:', err);
      setError(mapTireErrorToFriendlyMessage(err, position));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-xl font-bold text-white">
            {editingTire ? 'Editar Cadastro de Pneu' : 'Cadastrar Novo Pneu'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <p className="text-red-400 text-xs mb-4 bg-red-950/40 p-3 rounded-xl border border-red-900/30">
            {error}
          </p>
        )}

        <form id="tire-form" onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Veículo</label>
            <div className="p-2.5 bg-slate-950 border border-slate-800 text-slate-300 rounded-xl text-xs font-bold">
              {vehicle.name}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Posição</label>
              <select 
                value={position}
                onChange={(e) => setPosition(e.target.value as TirePosition)}
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                {positionOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Medida</label>
              <input 
                type="text"
                required
                placeholder="Ex: 80/100-18 ou 205/55 R16"
                value={tireSize}
                onChange={(e) => setTireSize(e.target.value)}
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Marca</label>
              <input 
                type="text"
                placeholder="Ex: Pirelli"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Modelo</label>
              <input 
                type="text"
                placeholder="Ex: City Dragon"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Data de Instalação</label>
              <input 
                type="date"
                required
                value={installedAt}
                onChange={(e) => setInstalledAt(e.target.value)}
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Odômetro de Instalação (km)</label>
              <input 
                type="number"
                required
                placeholder="Ex: 12500"
                value={installedOdometer}
                onChange={(e) => setInstalledOdometer(e.target.value)}
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Vida útil estimada em Km (opcional)</label>
            <input 
              type="number"
              placeholder="Ex: 15000"
              value={expectedLife}
              onChange={(e) => setExpectedLife(e.target.value)}
              className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Observações</label>
            <textarea 
              rows={3}
              placeholder="Ex: Troca realizada na concessionária."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        </form>

        <div className="sticky bottom-0 pt-5 mt-5 bg-slate-900 border-t border-slate-800 flex gap-3 justify-end">
          <button 
            type="button" 
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl transition"
          >
            Cancelar
          </button>
          <button 
            type="submit"
            form="tire-form"
            disabled={isSubmitting}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl transition flex items-center gap-1.5 shadow-lg shadow-blue-600/20"
          >
            {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Salvar
          </button>
        </div>

      </div>
    </div>
  );
}
