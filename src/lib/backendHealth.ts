import { isSupabaseConfigured, supabase } from './supabase';
import type { User } from '@supabase/supabase-js';
import { BackendReadError, classifyBackendError, getBackendHealth, reportBackendHealth, runBackendRead } from './backendDiagnostics';

let inFlight: Promise<ReturnType<typeof getBackendHealth>> | null = null;
/** On demand only. Auth verifies the current user; a HEAD read checks the Data API
 * without downloading profile data. Empty profiles are valid, not an outage.
 */
export function checkBackendHealth() {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    if (!isSupabaseConfigured()) {
      return reportBackendHealth({ kind: 'UNKNOWN', code: 'NOT_CONFIGURED' });
    }
    if (!navigator.onLine) return reportBackendHealth({ kind: 'NETWORK' });
    try {
      const auth = await runBackendRead<{ user: User | null }>('health_auth', () => supabase.auth.getUser(), { retries: 0, report: false });
      const user = auth.user;
      if (!user) throw new BackendReadError({ kind: 'AUTH', code: 'NO_SESSION' });
      await runBackendRead('health_read', signal => supabase.from('profiles')
        .select('user_id', { head: true }).eq('user_id', user.id).limit(1).abortSignal(signal),
      { method: 'HEAD', retries: 0, report: false });
      return reportBackendHealth(null);
    } catch (error) {
      return reportBackendHealth(classifyBackendError(error));
    }
  })().finally(() => { inFlight = null; });
  return inFlight;
}
