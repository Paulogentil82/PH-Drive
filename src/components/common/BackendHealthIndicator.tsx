import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { backendErrorMessage, getBackendHealth, resetBackendHealth, subscribeBackendHealth } from '../../lib/backendDiagnostics';
import { checkBackendHealth } from '../../lib/backendHealth';
import { useAuth } from '../../features/auth/AuthContext';

export function BackendHealthIndicator() {
  const { user, signOut } = useAuth();
  const health = useSyncExternalStore(subscribeBackendHealth, getBackendHealth);
  const [checking, setChecking] = useState(false);
  async function check() {
    setChecking(true);
    try { await checkBackendHealth(); } finally { setChecking(false); }
  }
  useEffect(() => { resetBackendHealth(); if (user) void check(); }, [user?.id]);
  const label = { ONLINE: 'Online', DEGRADED: 'Instável', OFFLINE: 'Offline', AUTH_ERROR: 'Sessão inválida ou expirada', UNKNOWN: 'Não verificado' }[health.status];
  return <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400" role="status">
    <span>Backend: {label}</span>
    <span>Última verificação: {health.checkedAt ? new Date(health.checkedAt).toLocaleTimeString('pt-BR') : '—'}</span>
    <button type="button" disabled={checking} onClick={check} className="text-blue-400 disabled:opacity-50">{checking ? 'Verificando backend...' : 'Verificar backend'}</button>
    {health.error && <span>{health.error.code === 'NOT_CONFIGURED' ? 'Cliente Supabase não configurado.' : backendErrorMessage(health.error.kind)}</span>}
    {health.status === 'AUTH_ERROR' && <button type="button" onClick={() => void signOut()} className="text-blue-400">Entrar novamente</button>}
  </div>;
}
