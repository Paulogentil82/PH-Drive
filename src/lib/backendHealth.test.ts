import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkBackendHealth } from './backendHealth';
import { resetBackendHealth } from './backendDiagnostics';

const mocks = vi.hoisted(() => ({ configured: true, user: { id: 'private-user' } as { id: string } | null,
  authError: null as any, readError: null as any, getUser: vi.fn(), from: vi.fn(), select: vi.fn(), eq: vi.fn(), limit: vi.fn(), abort: vi.fn(), writes: vi.fn(),
}));
vi.mock('./supabase', () => ({ isSupabaseConfigured: () => mocks.configured, supabase: {
  auth: { getUser: mocks.getUser }, from: mocks.from,
} }));

describe('on-demand backend check with verified auth and minimal own-profile HEAD read', () => {
  beforeEach(() => {
    vi.clearAllMocks(); resetBackendHealth(); mocks.configured = true; mocks.user = { id: 'private-user' }; mocks.authError = null; mocks.readError = null;
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    mocks.getUser.mockImplementation(async () => ({ data: { user: mocks.user }, error: mocks.authError }));
    const query = { select: mocks.select, eq: mocks.eq, limit: mocks.limit, abortSignal: mocks.abort,
      insert: mocks.writes, update: mocks.writes, delete: mocks.writes, upsert: mocks.writes };
    mocks.from.mockReturnValue(query); mocks.select.mockReturnValue(query); mocks.eq.mockReturnValue(query); mocks.limit.mockReturnValue(query);
    mocks.abort.mockImplementation(async () => ({ data: null, error: mocks.readError }));
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  });
  afterEach(() => vi.restoreAllMocks());
  it('empty own-profile HEAD response is ONLINE, with no data downloaded or writes', async () => {
    expect((await checkBackendHealth()).status).toBe('ONLINE');
    expect(mocks.select).toHaveBeenCalledWith('user_id', { head: true });
    expect(mocks.eq).toHaveBeenCalledWith('user_id', 'private-user');
    expect(mocks.from).toHaveBeenCalledWith('profiles'); expect(mocks.limit).toHaveBeenCalledWith(1);
    expect(mocks.writes).not.toHaveBeenCalled();
  });
  it('coalesces concurrent checks and does not poll or automatically retry', async () => {
    const [one, two] = await Promise.all([checkBackendHealth(), checkBackendHealth()]);
    expect(one).toEqual(two); expect(mocks.getUser).toHaveBeenCalledTimes(1); expect(mocks.from).toHaveBeenCalledTimes(1);
  });
  it('unconfigured client remains UNKNOWN and sends no requests', async () => {
    mocks.configured = false;
    expect((await checkBackendHealth()).status).toBe('UNKNOWN'); expect(mocks.getUser).not.toHaveBeenCalled();
  });
  it('offline browser is OFFLINE and sends no requests', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    expect((await checkBackendHealth()).status).toBe('OFFLINE'); expect(mocks.getUser).not.toHaveBeenCalled();
  });
  it.each([401, 403, 503])('classifies failed read HTTP %s without writes', async status => {
    mocks.readError = { status };
    const health = await checkBackendHealth();
    expect(health.status).toBe(status === 401 ? 'AUTH_ERROR' : 'DEGRADED');
    expect(health.error?.kind).toBe(status === 401 ? 'AUTH' : status === 403 ? 'PERMISSION' : 'SERVER');
    expect(mocks.from).toHaveBeenCalledTimes(1); expect(mocks.writes).not.toHaveBeenCalled();
  });
  it('missing or invalid authenticated user is AUTH_ERROR; does not read a table', async () => {
    mocks.user = null;
    expect((await checkBackendHealth()).status).toBe('AUTH_ERROR'); expect(mocks.from).not.toHaveBeenCalled();
  });
  it('auth-network failure is DEGRADED instead of a false session expiry', async () => {
    mocks.authError = { name: 'AuthRetryableFetchError', status: 0 };
    expect((await checkBackendHealth()).status).toBe('DEGRADED'); expect(mocks.from).not.toHaveBeenCalled();
  });
  it('successful check updates frontend verification time, without claiming Companion sync time', async () => {
    const start = Date.now(); const health = await checkBackendHealth();
    expect(health.checkedAt).toBeGreaterThanOrEqual(start);
    expect(health).not.toHaveProperty('lastSync');
  });
});
