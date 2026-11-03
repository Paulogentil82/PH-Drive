import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BackendHealthIndicator } from './BackendHealthIndicator';
import { getBackendHealth, reportBackendHealth, resetBackendHealth } from '../../lib/backendDiagnostics';

const mocks = vi.hoisted(() => ({ check: vi.fn(), signOut: vi.fn() }));
vi.mock('../../lib/backendHealth', () => ({ checkBackendHealth: mocks.check }));
vi.mock('../../features/auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user' }, signOut: mocks.signOut }) }));

describe('discreet frontend backend indicator', () => {
  let root: Root, container: HTMLDivElement;
  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks(); resetBackendHealth();
    mocks.check.mockImplementation(async () => reportBackendHealth(null));
    container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
  async function mount() { await act(async () => root.render(<BackendHealthIndicator />)); }
  it('checks once on entry, shows frontend verification time and does not claim a Companion sync', async () => {
    await mount();
    expect(mocks.check).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('Backend: Online'); expect(container.textContent).toContain('Última verificação:');
    expect(container.textContent).not.toContain('sincronização');
    await act(async () => root.render(<BackendHealthIndicator />)); expect(mocks.check).toHaveBeenCalledTimes(1);
  });
  it('manual check is disabled while in flight and does not reload the page', async () => {
    let finish!: () => void; mocks.check.mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
    await mount(); const button = container.querySelector('button')!;
    expect(button.disabled).toBe(true); expect(button.textContent).toBe('Verificando backend...');
    await act(async () => finish()); expect(button.disabled).toBe(false);
    await act(async () => button.click()); expect(mocks.check).toHaveBeenCalledTimes(2);
    await act(async () => finish());
  });
  it('auth failure shows session state and uses the existing auth exit flow', async () => {
    mocks.check.mockImplementation(async () => reportBackendHealth({ kind: 'AUTH' }));
    await mount(); expect(container.textContent).toContain('Sessão inválida ou expirada');
    const button = [...container.querySelectorAll('button')].find(b => b.textContent === 'Entrar novamente')!;
    await act(async () => button.click()); expect(mocks.signOut).toHaveBeenCalledTimes(1);
    expect(getBackendHealth().status).toBe('AUTH_ERROR');
  });
});
