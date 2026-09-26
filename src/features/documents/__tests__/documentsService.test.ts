import { describe, it, expect, vi } from 'vitest';
import { documentsService } from '../documentsService';
import { supabase } from '../../../lib/supabase';

vi.mock('../../../lib/supabase', () => ({
    supabase: {
        from: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            insert: vi.fn().mockReturnThis(),
            update: vi.fn().mockReturnThis(),
            delete: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: {}, error: null })
        }),
        auth: {
            getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user' } }, error: null })
        }
    }
}));

describe('documentsService', () => {
    it('should add a document', async () => {
        const doc = {
            vehicle_id: 'v1',
            document_type: 'IPVA',
            title: 'IPVA 2026',
            status: 'PENDING'
        } as any;
        
        await documentsService.addDocument(doc);
        expect(supabase.from).toHaveBeenCalledWith('vehicle_documents');
    });

    it('should repasse amount ?? null in createDocument', async () => {
        const doc = {
            vehicle_id: 'v1',
            document_type: 'IPVA',
            title: 'IPVA 2026',
            status: 'PENDING',
            amount: 250.5
        } as any;

        const insertMock = vi.fn().mockReturnThis();
        const selectMock = vi.fn().mockReturnThis();
        const singleMock = vi.fn().mockResolvedValue({ data: {}, error: null });

        vi.spyOn(supabase, 'from').mockReturnValue({
            insert: insertMock,
            select: selectMock,
            single: singleMock,
        } as any);

        await documentsService.createDocument(doc);

        expect(insertMock).toHaveBeenCalledWith([{
            vehicle_id: 'v1',
            document_type: 'IPVA',
            title: 'IPVA 2026',
            status: 'PENDING',
            amount: 250.5,
            user_id: 'test-user'
        }]);
    });

    it('should repasse amount as null when empty/null in createDocument', async () => {
        const doc = {
            vehicle_id: 'v1',
            document_type: 'IPVA',
            title: 'IPVA 2026',
            status: 'PENDING',
            amount: null
        } as any;

        const insertMock = vi.fn().mockReturnThis();
        const selectMock = vi.fn().mockReturnThis();
        const singleMock = vi.fn().mockResolvedValue({ data: {}, error: null });

        vi.spyOn(supabase, 'from').mockReturnValue({
            insert: insertMock,
            select: selectMock,
            single: singleMock,
        } as any);

        await documentsService.createDocument(doc);

        expect(insertMock).toHaveBeenCalledWith([{
            vehicle_id: 'v1',
            document_type: 'IPVA',
            title: 'IPVA 2026',
            status: 'PENDING',
            amount: null,
            user_id: 'test-user'
        }]);
    });

    it('should repasse amount ?? null in updateDocument', async () => {
        const updateMock = vi.fn().mockReturnThis();
        const eqMock = vi.fn().mockReturnThis();
        const selectMock = vi.fn().mockReturnThis();
        const singleMock = vi.fn().mockResolvedValue({ data: {}, error: null });

        vi.spyOn(supabase, 'from').mockReturnValue({
            update: updateMock,
            eq: eqMock,
            select: selectMock,
            single: singleMock,
        } as any);

        await documentsService.updateDocument('doc-1', { amount: 150 });

        expect(updateMock).toHaveBeenCalledWith({ amount: 150 });
    });
});
