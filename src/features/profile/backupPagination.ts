import { supabase } from '../../lib/supabase';
import { readAllPages } from '../../lib/readAllPages';

export const BACKUP_TABLES = [
  'profiles', 'vehicles', 'trips', 'trip_points', 'fuel_entries',
  'maintenance_entries', 'vehicle_expenses', 'vehicle_documents', 'vehicle_tires',
] as const;
export type BackupTable = typeof BACKUP_TABLES[number];

/** Uses the shared 500-row reader unchanged. An empty page confirms EOF even if
 * the server caps responses below 500. A duplicate/change is an error, never a partial backup.
 */
export async function readBackupTable(table: string, userId: string): Promise<any[]> {
  if (!(BACKUP_TABLES as readonly string[]).includes(table) || !userId.trim()) {
    throw new Error('Tabela ou usuário inválido para backup.');
  }
  const ids = new Set<string>();
  return readAllPages<any>(async (from, to) => {
    let query = supabase.from(table).select('*').eq('user_id', userId);
    if (table === 'trip_points') {
      query = query.order('trip_id', { ascending: true }).order('sequence_number', { ascending: true });
    }
    query = query.order('id', { ascending: true });
    const { data, error } = await query.range(from, to);
    if (error || !Array.isArray(data)) {
      throw new Error(`Falha ao ler ${table} no backup (a partir do registro ${from}). Nenhum backup foi concluído; tente novamente.`);
    }
    for (const row of data) {
      if (!row || typeof row.id !== 'string' || !row.id || row.user_id !== userId) {
        throw new Error(`Resposta inválida ou ownership divergente em ${table}; backup interrompido.`);
      }
      if (ids.has(row.id)) throw new Error(`Registro duplicado em ${table}; os dados podem ter mudado durante a leitura. Tente novamente.`);
      ids.add(row.id);
    }
    return { data, error: null };
  });
}
