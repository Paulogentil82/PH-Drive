import React, { useState, useEffect } from 'react';
import { Car, Bike, Plus, Edit2, Trash2, Power, Wrench, ShieldCheck, Gauge, Fuel } from 'lucide-react';
import { Vehicle, VehicleFormData } from '../../types';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/AuthContext';
import { PageHeader, EmptyState, LoadingState, ErrorState, ConfirmDialog } from '../../components/common/CommonComponents';
import { VehicleModal } from './VehicleModal';

export function VehicleList() {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchVehicles = async () => {
    if (!user) return;
    try {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setVehicles(data || []);
    } catch (err: any) {
      console.error('Error fetching vehicles:', err);
      setError(err.message || 'Erro ao carregar veículos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVehicles();
  }, [user]);

  const handleSaveVehicle = async (data: VehicleFormData, isEditing: boolean) => {
    if (!user) return;

    if (isEditing && selectedVehicle) {
      const { error } = await supabase
        .from('vehicles')
        .update({
          name: data.name,
          type: data.type,
          brand: data.brand || null,
          model: data.model || null,
          version: data.version || null,
          year: data.year,
          license_plate: data.license_plate || null,
          fuel_type: data.fuel_type,
          odometer_km: data.odometer_km,
          tank_capacity_liters: data.tank_capacity_liters,
          average_consumption_km_l: data.average_consumption_km_l,
          image_url: data.image_url || null,
          bluetooth_name: data.bluetooth_name || null,
          active: data.active,
        })
        .eq('id', selectedVehicle.id)
        .eq('user_id', user.id);

      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('vehicles')
        .insert({
          user_id: user.id,
          name: data.name,
          type: data.type,
          brand: data.brand || null,
          model: data.model || null,
          version: data.version || null,
          year: data.year,
          license_plate: data.license_plate || null,
          fuel_type: data.fuel_type,
          odometer_km: data.odometer_km,
          tank_capacity_liters: data.tank_capacity_liters,
          average_consumption_km_l: data.average_consumption_km_l,
          image_url: data.image_url || null,
          bluetooth_name: data.bluetooth_name || null,
          active: data.active,
        });

      if (error) throw error;
    }

    await fetchVehicles();
  };

  const handleDeleteVehicle = async () => {
    if (!deleteId || !user) return;
    try {
      const { error } = await supabase
        .from('vehicles')
        .delete()
        .eq('id', deleteId)
        .eq('user_id', user.id);

      if (error) throw error;
      setDeleteId(null);
      await fetchVehicles();
    } catch (err: any) {
      alert('Erro ao excluir veículo: ' + err.message);
    }
  };

  const handleToggleActive = async (vehicle: Vehicle) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('vehicles')
        .update({ active: !vehicle.active })
        .eq('id', vehicle.id)
        .eq('user_id', user.id);

      if (error) throw error;
      await fetchVehicles();
    } catch (err: any) {
      alert('Erro ao alterar status do veículo: ' + err.message);
    }
  };

  if (loading) {
    return <LoadingState message="Carregando seus veículos..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={fetchVehicles} />;
  }

  return (
    <div>
      <PageHeader
        title="Meus Veículos"
        subtitle="Gerenciamento da frota pessoal e especificações técnicas"
        action={
          <button
            onClick={() => { setSelectedVehicle(null); setIsModalOpen(true); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm rounded-xl transition shadow-lg shadow-blue-600/25"
          >
            <Plus className="w-4 h-4" />
            <span>Adicionar Veículo</span>
          </button>
        }
      />

      {vehicles.length === 0 ? (
        <EmptyState
          icon={Car}
          title="Nenhum veículo cadastrado"
          description="Você ainda não cadastrou nenhum veículo na sua conta PH Drive."
          actionLabel="Adicionar primeiro veículo"
          onAction={() => { setSelectedVehicle(null); setIsModalOpen(true); }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {vehicles.map((vehicle) => (
            <div
              key={vehicle.id}
              className={`bg-slate-900 border rounded-2xl p-6 flex flex-col justify-between transition relative overflow-hidden ${
                vehicle.active ? 'border-slate-800 shadow-xl' : 'border-slate-800/60 opacity-75 bg-slate-900/60'
              }`}
            >
              {/* Top info */}
              <div>
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-600/10 text-blue-400 rounded-xl border border-blue-500/20">
                      {vehicle.type === 'CAR' ? <Car className="w-6 h-6" /> : <Bike className="w-6 h-6" />}
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-white">{vehicle.name}</h3>
                      <p className="text-xs text-slate-400">
                        {vehicle.brand || 'Marca não informada'} {vehicle.model} {vehicle.year ? `(${vehicle.year})` : ''}
                      </p>
                    </div>
                  </div>
                  <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                    vehicle.active 
                      ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/50' 
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}>
                    {vehicle.active ? 'Ativo' : 'Inativo'}
                  </span>
                </div>

                {/* Details grid */}
                <div className="grid grid-cols-2 gap-3 py-3 border-y border-slate-800/80 my-4 text-xs">
                  <div className="flex items-center gap-2 text-slate-300">
                    <Gauge className="w-4 h-4 text-slate-500 shrink-0" />
                    <div>
                      <span className="text-slate-500 block text-[10px]">Odômetro</span>
                      <span className="font-semibold text-white">{vehicle.odometer_km.toLocaleString('pt-BR')} km</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-slate-300">
                    <Fuel className="w-4 h-4 text-slate-500 shrink-0" />
                    <div>
                      <span className="text-slate-500 block text-[10px]">Combustível</span>
                      <span className="font-semibold text-white">{vehicle.fuel_type || 'N/D'}</span>
                    </div>
                  </div>
                </div>

                {vehicle.license_plate && (
                  <div className="mb-4 inline-block px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg font-mono text-xs text-slate-300">
                    Placa: {vehicle.license_plate}
                  </div>
                )}
              </div>

              {/* Actions footer */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
                <button
                  onClick={() => handleToggleActive(vehicle)}
                  className={`text-xs font-medium px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                    vehicle.active
                      ? 'text-amber-400 hover:bg-amber-950/30 bg-amber-950/10 border border-amber-900/30'
                      : 'text-emerald-400 hover:bg-emerald-950/30 bg-emerald-950/10 border border-emerald-900/30'
                  }`}
                  title={vehicle.active ? 'Desativar veículo' : 'Ativar veículo'}
                >
                  <Power className="w-3.5 h-3.5" />
                  <span>{vehicle.active ? 'Desativar' : 'Ativar'}</span>
                </button>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => { setSelectedVehicle(vehicle); setIsModalOpen(true); }}
                    className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition"
                    title="Editar veículo"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteId(vehicle.id)}
                    className="p-2 text-red-400 hover:text-red-300 bg-red-950/30 hover:bg-red-950/50 rounded-xl transition border border-red-900/30"
                    title="Excluir veículo"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <VehicleModal
        isOpen={isModalOpen}
        vehicleToEdit={selectedVehicle}
        onClose={() => { setIsModalOpen(false); setSelectedVehicle(null); }}
        onSave={handleSaveVehicle}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deleteId)}
        title="Excluir Veículo"
        message="Tem certeza que deseja excluir este veículo? Esta ação não pode ser desfeita e removerá todos os dados vinculados."
        confirmLabel="Sim, excluir"
        cancelLabel="Cancelar"
        danger={true}
        onConfirm={handleDeleteVehicle}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
