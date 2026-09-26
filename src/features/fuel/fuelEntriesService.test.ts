import { describe, it, expect } from 'vitest';
import { fuelEntriesService } from './fuelEntriesService';
import { FuelEntry } from '../../types/fuel_entry';

describe('fuelEntriesService consumption and logic', () => {
  it('1. primeiro tanque cheio -> consumo indisponível', () => {
    const entries: FuelEntry[] = [{ id: '1', odometer_km: 1000, liters: 50, total_amount: 250, full_tank: true, filled_at: '2023-01-01T10:00:00Z' } as any];
    const { lastConsumption, averageConsumption } = fuelEntriesService.calculateConsumption(entries);
    expect(lastConsumption).toBeNull();
    expect(averageConsumption).toBeNull();
  });

  it('2. cheio -> cheio', () => {
    const entries: FuelEntry[] = [
      { id: '1', odometer_km: 1000, liters: 50, total_amount: 250, full_tank: true, filled_at: '2023-01-01T10:00:00Z' },
      { id: '2', odometer_km: 1500, liters: 40, total_amount: 200, full_tank: true, filled_at: '2023-01-02T10:00:00Z' }
    ] as any;
    const { lastConsumption, averageConsumption } = fuelEntriesService.calculateConsumption(entries);
    expect(lastConsumption).toBe(12.5);
    expect(averageConsumption).toBe(12.5);
  });

  it('3. cheio -> parcial -> cheio', () => {
    const entries: FuelEntry[] = [
      { id: '1', odometer_km: 1000, liters: 50, total_amount: 250, full_tank: true, filled_at: '2023-01-01T10:00:00Z' },
      { id: '2', odometer_km: 1200, liters: 10, total_amount: 50, full_tank: false, filled_at: '2023-01-02T10:00:00Z' },
      { id: '3', odometer_km: 1500, liters: 30, total_amount: 150, full_tank: true, filled_at: '2023-01-03T10:00:00Z' }
    ] as any;
    const { lastConsumption, averageConsumption } = fuelEntriesService.calculateConsumption(entries);
    expect(lastConsumption).toBe(12.5);
    expect(averageConsumption).toBe(12.5);
  });

  it('4. cheio -> parcial -> parcial -> cheio', () => {
    const entries: FuelEntry[] = [
      { id: '1', odometer_km: 1000, liters: 50, total_amount: 250, full_tank: true, filled_at: '2023-01-01T10:00:00Z' },
      { id: '2', odometer_km: 1200, liters: 10, total_amount: 50, full_tank: false, filled_at: '2023-01-02T10:00:00Z' },
      { id: '3', odometer_km: 1300, liters: 10, total_amount: 50, full_tank: false, filled_at: '2023-01-03T10:00:00Z' },
      { id: '4', odometer_km: 1500, liters: 30, total_amount: 150, full_tank: true, filled_at: '2023-01-04T10:00:00Z' }
    ] as any;
    const { lastConsumption, averageConsumption } = fuelEntriesService.calculateConsumption(entries);
    // distance = 500, liters = 10 + 10 + 30 = 50, consumption = 500 / 50 = 10
    expect(lastConsumption).toBe(10);
    expect(averageConsumption).toBe(10);
  });

  it('5. parcial isolado não gera consumo', () => {
    const entries: FuelEntry[] = [
      { id: '1', odometer_km: 1000, liters: 50, total_amount: 250, full_tank: false, filled_at: '2023-01-01T10:00:00Z' }
    ] as any;
    const { lastConsumption } = fuelEntriesService.calculateConsumption(entries);
    expect(lastConsumption).toBeNull();
  });
});
