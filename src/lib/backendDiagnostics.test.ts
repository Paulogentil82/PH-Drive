import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backendErrorMessage, classifyBackendError, getBackendHealth, resetBackendHealth, runBackendRead } from './backendDiagnostics';

describe('safe backend read diagnostics and bounded retry', () => {
  beforeEach(() => { resetBackendHealth(); vi.spyOn(console, 'debug').mockImplementation(() => {}); });
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); vi.unstubAllEnvs(); });

  it.each([
    [{ status: 401 }, 'AUTH'], [{ code: 'PGRST301' }, 'AUTH'],
    [{ status: 403 }, 'PERMISSION'], [{ code: '42501' }, 'PERMISSION'],
    [{ status: 404 }, 'NOT_FOUND'], [{ status: 503 }, 'SERVER'],
    [{ status: 0 }, 'NETWORK'], [new TypeError('private network details'), 'NETWORK'],
    [{ message: 'unauthorized text alone is not a status' }, 'UNKNOWN'],
    [{ name: 'AuthSessionMissingError' }, 'AUTH'],
  ])('classifies structured errors %o as %s', (error, expected) => {
    expect(classifyBackendError(error).kind).toBe(expected);
  });
  it('a successful empty read is ONLINE and remains an empty array', async () => {
    expect(await runBackendRead('trip_points', async () => ({ data: [], error: null }))).toEqual([]);
    expect(getBackendHealth().status).toBe('ONLINE');
  });
  it('makes at most one extra attempt, retaining transient recovery as DEGRADED', async () => {
    const read = vi.fn().mockRejectedValueOnce(new TypeError('network')).mockResolvedValue({ data: [1], error: null });
    expect(await runBackendRead('trip_points', read, { backoffMs: 0 })).toEqual([1]);
    expect(read).toHaveBeenCalledTimes(2);
    expect(getBackendHealth().status).toBe('DEGRADED');
  });
  it('online application with unreachable backend is DEGRADED; failures are never returned as []', async () => {
    const read = vi.fn().mockRejectedValue(new TypeError('network'));
    await expect(runBackendRead('trip_points', read, { backoffMs: 0 })).rejects.toMatchObject({ info: { kind: 'NETWORK' } });
    expect(read).toHaveBeenCalledTimes(2); expect(getBackendHealth().status).toBe('DEGRADED');
  });
  it.each([401, 403, 404])('does not automatically retry HTTP %s', async status => {
    const read = vi.fn().mockResolvedValue({ data: null, error: { status } });
    await expect(runBackendRead('trip_points', read)).rejects.toThrow();
    expect(read).toHaveBeenCalledTimes(1);
    expect(getBackendHealth().status).toBe(status === 401 ? 'AUTH_ERROR' : 'DEGRADED');
  });
  it('a hung provider times out, aborts its request and ignores late success', async () => {
    vi.useFakeTimers(); let complete!: (value: any) => void; let signal!: AbortSignal;
    const result = runBackendRead('trip_points', currentSignal => {
      signal = currentSignal; return new Promise<{ data: unknown; error: unknown }>(resolve => { complete = resolve; });
    }, { retries: 0, timeoutMs: 100 });
    const assertion = expect(result).rejects.toMatchObject({ info: { code: 'CLIENT_TIMEOUT' } });
    await vi.advanceTimersByTimeAsync(100); await assertion;
    expect(signal.aborted).toBe(true);
    complete({ data: [], error: null }); await Promise.resolve();
    expect(getBackendHealth().status).toBe('DEGRADED');
  });
  it.each(['POST', 'PATCH', 'DELETE'])('refuses retry helper for writes (%s) before executing', async method => {
    const write = vi.fn();
    await expect(runBackendRead('trip_points', write, { method: method as any })).rejects.toThrow('somente para leituras');
    expect(write).not.toHaveBeenCalled();
  });
  it('one successful request cannot hide a different unresolved failure', async () => {
    await expect(runBackendRead('trip_points', async () => ({ data: null, error: { status: 403 } }))).rejects.toThrow();
    await runBackendRead('map_vehicles', async () => ({ data: [], error: null }));
    expect(getBackendHealth().status).toBe('DEGRADED');
    await runBackendRead('trip_points', async () => ({ data: [], error: null }));
    expect(getBackendHealth().status).toBe('ONLINE');
  });
  it('uses a permission message rather than an authentication-expiry message for 403', () => {
    expect(backendErrorMessage(classifyBackendError({ status: 403 }).kind)).toContain('permissão');
  });
  it('development diagnostics never print tokens, IDs, coordinates or raw error details', async () => {
    const error = { status: 401, code: 'PRIVATE_ACCESS_TOKEN', message: 'token=private-token latitude=-23.123456 user_id=full-private-id', details: { refresh_token: 'private-refresh' } };
    await expect(runBackendRead('trip_points', async () => ({ data: null, error }))).rejects.toThrow();
    const logs = JSON.stringify(vi.mocked(console.debug).mock.calls);
    expect(logs).toContain('trip_points');
    for (const forbidden of ['PRIVATE_ACCESS_TOKEN', 'private-token', '-23.123456', 'full-private-id', 'private-refresh']) expect(logs).not.toContain(forbidden);
  });
  it('does not log diagnostics in production', async () => {
    vi.stubEnv('DEV', false);
    await runBackendRead('trip_points', async () => ({ data: [], error: null }));
    expect(console.debug).not.toHaveBeenCalled();
  });
});
