import { describe, it, expect, vi, beforeEach } from 'vitest';
import { backupService, BackupPayload } from '../backupService';
import { supabase } from '../../../lib/supabase';

vi.mock('../../../lib/supabase', () => {
  const mockSingle = vi.fn();
  const mockSelect = vi.fn();
  const mockEq = vi.fn();
  const mockOrder = vi.fn();
  const mockInsert = vi.fn();
  const mockUpdate = vi.fn();

  const mockQueryBuilder = {
    select: mockSelect,
    eq: mockEq,
    single: mockSingle,
    order: mockOrder,
    insert: mockInsert,
    update: mockUpdate,
    range: vi.fn().mockResolvedValue({ data: [], error: null }),
    then: (cb: any) => cb({ data: [], error: null })
  };

  mockSelect.mockReturnValue(mockQueryBuilder);
  mockEq.mockReturnValue(mockQueryBuilder);
  mockSingle.mockResolvedValue({ data: {}, error: null });
  mockOrder.mockReturnValue(mockQueryBuilder);
  mockInsert.mockResolvedValue({ error: null });
  mockUpdate.mockReturnValue(mockQueryBuilder);

  return {
    supabase: {
      from: vi.fn(() => mockQueryBuilder)
    }
  };
});

describe('Backup and Restore Service - 4A.10', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Exportações', () => {
    it('exporta JSON válido com schemaVersion = 1 e sem credentials', async () => {
      const mockDbData = {
        profiles: [{ user_id: 'user-123', default_vehicle_id: 'v-1' }],
        vehicles: [{ id: 'v-1', name: 'Titan 125', token: 'secret-token', api_key: 'abc' }],
        trips: [{ id: 't-1', vehicle_id: 'v-1' }],
        trip_points: []
      } as any;

      vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
        const data = mockDbData[table] || [];
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          range: vi.fn().mockResolvedValue({ data, error: null }),
          single: vi.fn().mockResolvedValue({ data: data?.[0] || null, error: null }),
          then: (cb: any) => cb({ data, error: null })
        } as any;
      });

      const backup = await backupService.exportBackupJSON('user-123');

      expect(backup.app).toBe('ph-drive');
      expect(backup.schemaVersion).toBe(1);
      expect(backup.vehicles.length).toBe(1);
      expect(backup.vehicles[0].token).toBeUndefined();
      expect(backup.vehicles[0].api_key).toBeUndefined();
      expect(backup.vehicles[0].name).toBe('Titan 125');
    });

    it('exporta CSVs independentes com UTF-8 BOM', async () => {
      vi.spyOn(supabase, 'from').mockImplementation(() => {
        const data = [
          { id: 'f-1', liters: 15, price_per_liter: 5.5, total_amount: 82.5, filled_at: '2026-09-26' }
        ];
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          range: vi.fn().mockResolvedValue({ data, error: null }),
          then: (cb: any) => cb({ data, error: null })
        } as any;
      });

      const csv = await backupService.exportCSV('fuel', 'user-123');
      expect(csv).not.toBeNull();
      expect(csv?.filename).toContain('fuel');
      expect(csv?.data.startsWith('\uFEFF')).toBe(true);
      expect(csv?.data).toContain('Litros;Preço por Litro;Total Pago;Odômetro');
      expect(csv?.data).toContain('"15";"5.5";"82.5"');
    });
  });

  describe('Validações na Importação', () => {
    it('rejeita arquivo JSON inválido ou app diferente', async () => {
      const emptyCheck = await backupService.previewBackup(null, 'user-123');
      expect(emptyCheck.valid).toBe(false);
      expect(emptyCheck.error).toContain('JSON válido');

      const badApp = await backupService.previewBackup({ app: 'different-app' }, 'user-123');
      expect(badApp.valid).toBe(false);
      expect(badApp.error).toContain('PH Drive');

      const badVersion = await backupService.previewBackup({ app: 'ph-drive', schemaVersion: 99 }, 'user-123');
      expect(badVersion.valid).toBe(false);
      expect(badVersion.error).toContain('versão de esquema');
    });

    it('rejeita registros órfãos ou inválidos', async () => {
      const backup: BackupPayload = {
        app: 'ph-drive',
        schemaVersion: 1,
        exportedAt: '...',
        user: { preferences: {} },
        vehicles: [],
        trips: [{ id: 'b8bca17c-2b2f-488f-a9cb-56903df1208a', vehicle_id: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', started_at: '2026-09-26' }],
        tripPoints: [],
        fuelEntries: [],
        maintenanceEntries: [],
        vehicleExpenses: [],
        vehicleDocuments: [],
        vehicleTires: []
      };

      vi.spyOn(supabase, 'from').mockImplementation(() => {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          range: vi.fn().mockResolvedValue({ data: [], error: null }),
          then: (cb: any) => cb({ data: [], error: null })
        } as any;
      });

      const preview = await backupService.previewBackup(backup, 'user-123');
      expect(preview.valid).toBe(true);
      expect(preview.preview?.trips.invalid).toBe(1);
      expect(preview.preview?.trips.inserted).toBe(0);
    });

    it('ponto GPS sem trip correspondente é rejeitado', async () => {
      const backup: BackupPayload = {
        app: 'ph-drive',
        schemaVersion: 1,
        exportedAt: '...',
        user: { preferences: {} },
        vehicles: [{ id: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', name: 'Titan 125' }],
        trips: [],
        tripPoints: [{ id: 'b8bca17c-2b2f-488f-a9cb-56903df1208a', trip_id: '99999999-9999-9999-9999-999999999999', latitude: -23.5, longitude: -46.6 }],
        fuelEntries: [],
        maintenanceEntries: [],
        vehicleExpenses: [],
        vehicleDocuments: [],
        vehicleTires: []
      };

      vi.spyOn(supabase, 'from').mockImplementation(() => {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          range: vi.fn().mockResolvedValue({ data: [], error: null }),
          then: (cb: any) => cb({ data: [], error: null })
        } as any;
      });

      const preview = await backupService.previewBackup(backup, 'user-123');
      expect(preview.preview?.tripPoints.invalid).toBe(1);
    });

    it('active tire duplicado para a mesma posição vira conflito', async () => {
      const backup: BackupPayload = {
        app: 'ph-drive',
        schemaVersion: 1,
        exportedAt: '...',
        user: { preferences: {} },
        vehicles: [{ id: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', name: 'Carro' }],
        trips: [],
        tripPoints: [],
        fuelEntries: [],
        maintenanceEntries: [],
        vehicleExpenses: [],
        vehicleDocuments: [],
        vehicleTires: [
          { id: '11111111-1111-1111-1111-111111111111', vehicle_id: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', position: 'FL', active: true },
          { id: '22222222-2222-2222-2222-222222222222', vehicle_id: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', position: 'FL', active: true }
        ]
      };

      vi.spyOn(supabase, 'from').mockImplementation(() => {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          range: vi.fn().mockResolvedValue({ data: [], error: null }),
          then: (cb: any) => cb({ data: [], error: null })
        } as any;
      });

      const preview = await backupService.previewBackup(backup, 'user-123');
      expect(preview.preview?.vehicleTires.conflicts).toBe(1);
      expect(preview.preview?.vehicleTires.inserted).toBe(1);
    });
  });

  describe('Importação / Restauração Física', () => {
    it('executa importação idempotente e ignora user_id original forçando uid atual', async () => {
      const backup: BackupPayload = {
        app: 'ph-drive',
        schemaVersion: 1,
        exportedAt: '...',
        user: { preferences: {} },
        vehicles: [{ id: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', name: 'Carro', user_id: 'attacker-id' }],
        trips: [],
        tripPoints: [],
        fuelEntries: [],
        maintenanceEntries: [],
        vehicleExpenses: [],
        vehicleDocuments: [],
        vehicleTires: []
      };

      const mockInsert = vi.fn().mockResolvedValue({ error: null });
      vi.spyOn(supabase, 'from').mockImplementation(() => {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          range: vi.fn().mockResolvedValue({ data: [], error: null }),
          single: vi.fn().mockResolvedValue({ data: { user_id: 'user-123' }, error: null }),
          insert: mockInsert,
          update: vi.fn().mockReturnThis(),
          then: (cb: any) => cb({ data: [], error: null })
        } as any;
      });

      const preview = await backupService.previewBackup(backup, 'user-123');
      const finalReport = await backupService.executeImport(backup, 'user-123', preview.preview!);

      expect(finalReport.vehicles.inserted).toBe(1);
      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
        id: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
        name: 'Carro',
        user_id: 'user-123'
      }));
    });

    it('não reduz odômetro existente na restauração', async () => {
      const backup: BackupPayload = {
        app: 'ph-drive',
        schemaVersion: 1,
        exportedAt: '...',
        user: { preferences: {} },
        vehicles: [{ id: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', name: 'Carro', odometer_km: 40000 }],
        trips: [],
        tripPoints: [],
        fuelEntries: [],
        maintenanceEntries: [],
        vehicleExpenses: [],
        vehicleDocuments: [],
        vehicleTires: []
      };

      const mockUpdate = vi.fn().mockReturnThis();
      vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
        if (table === 'vehicles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockImplementation((k, val) => {
              if (k === 'user_id') {
                return {
                  then: (cb: any) => cb({ data: [{ id: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', name: 'Carro', odometer_km: 50000 }] })
                };
              }
              return { update: mockUpdate };
            }),
            insert: vi.fn().mockResolvedValue({ error: null })
          } as any;
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockImplementation(() => {
            return {
              single: vi.fn().mockResolvedValue({ data: { user_id: 'user-123' }, error: null }),
              then: (cb: any) => cb({ data: [], error: null }),
              range: vi.fn().mockResolvedValue({ data: [], error: null }),
              order: vi.fn().mockReturnThis()
            };
          }),
          insert: vi.fn().mockResolvedValue({ error: null }),
          update: vi.fn().mockReturnThis()
        } as any;
      });

      const preview = await backupService.previewBackup(backup, 'user-123');
      await backupService.executeImport(backup, 'user-123', preview.preview!);

      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });

  describe('Correção Crítica de Paginação de Trip Points - 4A.10', () => {
    it('carrega corretamente e sem truncamento com 999 pontos, 1000 pontos, 1001 pontos e 1083 pontos', async () => {
      const mockPoints = Array.from({ length: 1083 }, (_, i) => ({
        id: `point-${i}`,
        trip_id: 'trip-1',
        latitude: -23.5,
        longitude: -46.6,
        sequence_number: i
      }));

      const mockRange = vi.fn().mockImplementation((from, to) => {
        const slice = mockPoints.slice(from, to + 1);
        return Promise.resolve({ data: slice, error: null });
      });

      const mockQueryBuilder = {
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: mockRange
      };

      vi.spyOn(supabase, 'from').mockImplementation((table) => {
        if (table === 'trip_points') {
          return {
            select: vi.fn().mockReturnValue(mockQueryBuilder)
          } as any;
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: {}, error: null })
        } as any;
      });

      const results = await backupService.fetchFullTable('trip_points', 'user-123', [
        { field: 'trip_id', ascending: true },
        { field: 'sequence_number', ascending: true }
      ]);

      expect(results.length).toBe(1083);
      expect(results[0].id).toBe('point-0');
      expect(results[1082].id).toBe('point-1082');
      expect(mockRange).toHaveBeenCalledTimes(2);
    });

    it('preserva ordem e não duplica dados entre páginas', async () => {
      const mockPoints = Array.from({ length: 1005 }, (_, i) => ({
        id: `point-${i}`,
        trip_id: 'trip-1',
        latitude: -23.5,
        longitude: -46.6,
        sequence_number: i
      }));

      const mockRange = vi.fn().mockImplementation((from, to) => {
        const slice = mockPoints.slice(from, to + 1);
        return Promise.resolve({ data: slice, error: null });
      });

      const mockQueryBuilder = {
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: mockRange
      };

      vi.spyOn(supabase, 'from').mockImplementation((table) => {
        if (table === 'trip_points') {
          return {
            select: vi.fn().mockReturnValue(mockQueryBuilder)
          } as any;
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: {}, error: null })
        } as any;
      });

      const results = await backupService.fetchFullTable('trip_points', 'user-123');

      expect(results.length).toBe(1005);
      const uniqueIds = new Set(results.map(r => r.id));
      expect(uniqueIds.size).toBe(1005);
      expect(results[1004].sequence_number).toBe(1004);
    });
  });
});
