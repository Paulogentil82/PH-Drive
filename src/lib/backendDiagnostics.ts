export type BackendHealthStatus = 'ONLINE' | 'DEGRADED' | 'OFFLINE' | 'AUTH_ERROR' | 'UNKNOWN';
export type BackendErrorKind = 'NETWORK' | 'AUTH' | 'PERMISSION' | 'NOT_FOUND' | 'SERVER' | 'UNKNOWN';
export type ReadOperation = 'trip_points' | 'map_vehicles' | 'map_trips' | 'health_auth' | 'health_read';

export interface BackendErrorInfo {
  kind: BackendErrorKind;
  code?: string;
  status?: number;
}

export function classifyBackendError(error: unknown, status?: number): BackendErrorInfo {
  if (error instanceof BackendReadError) return error.info;
  const value = error && typeof error === 'object' ? error as Record<string, unknown> : {};
  const http = typeof value.status === 'number' ? value.status : status;
  // Only retain known diagnostic codes, never arbitrary error text/payloads.
  const code = typeof value.code === 'string' && /^(PGRST\d{3}|[0-9]{5}|CLIENT_TIMEOUT|NO_SESSION|ECONNRESET|ENETUNREACH|ETIMEDOUT)$/.test(value.code) ? value.code : undefined;
  let kind: BackendErrorKind = 'UNKNOWN';
  if (http === 401 || code === 'NO_SESSION' || ['AuthSessionMissingError', 'AuthInvalidJwtError'].includes(String(value.name)) || ['PGRST301', 'PGRST302', 'PGRST303', 'bad_jwt', 'session_not_found', 'refresh_token_not_found', 'refresh_token_already_used'].includes(String(value.code))) kind = 'AUTH';
  else if (http === 403 || code === '42501') kind = 'PERMISSION';
  else if (http === 404 || code === 'PGRST205') kind = 'NOT_FOUND';
  else if (http === 429 || (http !== undefined && http >= 500)) kind = 'SERVER';
  else if (http === 0 || code === 'CLIENT_TIMEOUT' || ['ECONNRESET', 'ENETUNREACH', 'ETIMEDOUT'].includes(String(code))
    || ['TypeError', 'AbortError', 'TimeoutError', 'AuthRetryableFetchError'].includes(String(value.name))) kind = 'NETWORK';
  return { kind, code, status: http };
}

export function backendErrorMessage(kind: BackendErrorKind): string {
  switch (kind) {
    case 'AUTH': return 'Sua sessão não é válida. Entre novamente para continuar.';
    case 'PERMISSION': return 'Você não tem permissão para consultar estes dados.';
    case 'NETWORK': return typeof navigator !== 'undefined' && !navigator.onLine
      ? 'Sem conexão com a internet. Verifique sua conexão e tente novamente.'
      : 'Não foi possível alcançar o backend. Verifique sua conexão e tente novamente.';
    case 'NOT_FOUND': return 'O recurso solicitado não foi encontrado no backend.';
    case 'SERVER': return 'O backend está temporariamente indisponível. Tente novamente.';
    default: return 'Não foi possível carregar os dados. Tente novamente.';
  }
}

export class BackendReadError extends Error {
  constructor(public readonly info: BackendErrorInfo) {
    super(backendErrorMessage(info.kind));
    this.name = 'BackendReadError';
  }
}

export interface BackendHealth {
  status: BackendHealthStatus;
  checkedAt: number | null;
  error: BackendErrorInfo | null;
}
let health: BackendHealth = { status: 'UNKNOWN', checkedAt: null, error: null };
const listeners = new Set<() => void>();
const failures = new Map<string, BackendErrorInfo>();
export const getBackendHealth = () => health;
export function subscribeBackendHealth(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function resetBackendHealth(): void {
  failures.clear();
  health = { status: 'UNKNOWN', checkedAt: null, error: null };
  listeners.forEach(listener => listener());
}
export function reportBackendHealth(error: BackendErrorInfo | null, recovered = false, operation = 'health'): BackendHealth {
  if (error) failures.set(operation, error); else failures.delete(operation);
  const unresolved = [...failures.values()];
  const currentError = unresolved.find(value => value.kind === 'AUTH') ?? unresolved[0] ?? null;
  const offline = typeof navigator !== 'undefined' && !navigator.onLine;
  health = {
    status: offline ? 'OFFLINE' : currentError?.code === 'NOT_CONFIGURED' ? 'UNKNOWN' : currentError?.kind === 'AUTH' ? 'AUTH_ERROR'
      : currentError || recovered ? 'DEGRADED' : 'ONLINE',
    checkedAt: Date.now(), error: currentError,
  };
  listeners.forEach(listener => listener());
  return health;
}

type ReadResponse<T> = { data: T; error: unknown; status?: number };
/** Explicitly read-only: one extra attempt at most, only for transient errors.
 * Each attempt has a deadline; late responses cannot change health or UI state.
 */
export async function runBackendRead<T>(operation: ReadOperation,
  read: (signal: AbortSignal) => PromiseLike<ReadResponse<T>>,
  options: { method?: 'GET' | 'HEAD'; retries?: 0 | 1; timeoutMs?: number; backoffMs?: number; report?: boolean } = {},
): Promise<T> {
  if (options.method && !['GET', 'HEAD'].includes(options.method)) throw new Error('Retry permitido somente para leituras.');
  const started = Date.now();
  const retries = options.retries === 0 ? 0 : 1;
  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new BackendReadError({ kind: 'NETWORK', code: 'CLIENT_TIMEOUT' }));
          controller.abort();
        }, options.timeoutMs ?? 10000);
      });
      const response = await Promise.race([Promise.resolve().then(() => read(controller.signal)), timeout]);
      if (response.error) throw new BackendReadError(classifyBackendError(response.error, response.status));
      if (options.report !== false) reportBackendHealth(null, attempt > 0, operation);
      if (import.meta.env.DEV) console.debug('[backend]', { operation, status: attempt ? 'RECOVERED' : 'OK', durationMs: Date.now() - started });
      return response.data;
    } catch (error) {
      const info = classifyBackendError(error);
      if (options.report !== false) reportBackendHealth(info, false, operation);
      if (import.meta.env.DEV) console.debug('[backend]', { operation, status: 'ERROR', kind: info.kind, code: info.code, httpStatus: info.status, durationMs: Date.now() - started });
      if (attempt >= retries || !['NETWORK', 'SERVER'].includes(info.kind)) throw new BackendReadError(info);
    } finally {
      if (timer) clearTimeout(timer);
    }
    await new Promise(resolve => setTimeout(resolve, options.backoffMs ?? 400));
  }
}
