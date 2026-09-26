import React, { useState } from 'react';
import { fuelEntriesService } from './fuelEntriesService';

export const FuelForm = ({ vehicleId, onAdded }: { vehicleId: string, onAdded: () => void }) => {
  const [odometer, setOdometer] = useState('');
  const [liters, setLiters] = useState('');
  const [amount, setAmount] = useState('');
  const [fullTank, setFullTank] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const pricePerLiter = parseFloat(amount) / parseFloat(liters);
    await fuelEntriesService.addEntry({
      vehicle_id: vehicleId,
      odometer_km: parseFloat(odometer),
      liters: parseFloat(liters),
      total_amount: parseFloat(amount),
      price_per_liter: pricePerLiter,
      fuel_type: 'GASOLINE',
      full_tank: fullTank,
      filled_at: new Date().toISOString(),
    });
    onAdded();
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 bg-white rounded shadow">
      <input type="number" placeholder="Odômetro" value={odometer} onChange={e => setOdometer(e.target.value)} className="block w-full p-2 mb-2 border rounded" required />
      <input type="number" placeholder="Litros" value={liters} onChange={e => setLiters(e.target.value)} className="block w-full p-2 mb-2 border rounded" required />
      <input type="number" placeholder="Valor Total" value={amount} onChange={e => setAmount(e.target.value)} className="block w-full p-2 mb-2 border rounded" required />
      <label className="flex items-center mb-4">
        <input type="checkbox" checked={fullTank} onChange={e => setFullTank(e.target.checked)} className="mr-2" />
        Tanque cheio
      </label>
      <button type="submit" className="w-full p-2 text-white bg-blue-600 rounded">Registrar Abastecimento</button>
    </form>
  );
};
