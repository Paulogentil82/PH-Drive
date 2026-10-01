import { beforeEach, describe, it, expect, vi } from 'vitest';
import { maintenanceEntriesService } from '../maintenanceEntriesService';
import { supabase } from '../../../lib/supabase';

vi.mock('../../../lib/supabase', () => ({
    supabase: {
        auth: { getUser: vi.fn() },
        from: vi.fn(),
        rpc: vi.fn(),
    },
}));

describe('maintenanceEntriesService', () => {
    beforeEach(() => vi.resetAllMocks());

    it('service should be defined', () => {
        expect(maintenanceEntriesService).toBeDefined();
    });

    const entry = {
        vehicle_id: 'vehicle-1', performed_at: '2026-10-01T12:00:00Z',
        odometer_km: 9000, service_type: 'Oil',
    };

    function mockInsert() {
        vi.mocked(supabase.auth.getUser).mockResolvedValue({
            data: { user: { id: 'user-1' } }, error: null,
        } as any);
        const saved = { ...entry, id: 'maintenance-1', user_id: 'user-1' };
        vi.mocked(supabase.from).mockReturnValue({
            insert: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: saved, error: null }),
        } as any);
        return saved;
    }

    it('uses only the RPC for the odometer after inserting maintenance', async () => {
        const saved = mockInsert();
        vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as any);
        expect(await maintenanceEntriesService.addEntry(entry)).toEqual(saved);
        expect(supabase.from).toHaveBeenCalledTimes(1);
        expect(supabase.from).toHaveBeenCalledWith('maintenance_entries');
        expect(supabase.rpc).toHaveBeenCalledWith('update_vehicle_odometer', {
            v_id: 'vehicle-1', new_km: 9000,
        });
    });

    it('propagates the RPC error without reporting success', async () => {
        mockInsert();
        const error = { message: 'odometer update failed' };
        vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error } as any);
        await expect(maintenanceEntriesService.addEntry(entry)).rejects.toBe(error);
    });
});
