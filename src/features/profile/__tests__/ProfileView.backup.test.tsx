import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfileView } from '../ProfileView';

vi.mock('../../../components/common/BackendHealthIndicator', () => ({ BackendHealthIndicator: () => null }));

const mocks = vi.hoisted(() => ({
  user: { id: 'user-a', email: 'test@example.invalid' },
  preferences: { default_vehicle_id: null, distance_unit: 'KM', currency_code: 'BRL', date_format: 'DD/MM/YYYY', alert_upcoming_enabled: true, alert_urgent_enabled: true, alert_overdue_enabled: true, theme_preference: 'SYSTEM' },
  export: vi.fn(), summary: vi.fn(), click: vi.fn(), createURL: vi.fn(), revokeURL: vi.fn(),
}));
vi.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ user: mocks.user, profile: {}, refreshProfile: vi.fn() }) }));
vi.mock('../PreferencesContext', () => ({ usePreferences: () => ({ preferences: mocks.preferences, savePreferences: vi.fn() }) }));
vi.mock('../backupService', () => ({ backupService: { exportBackupJSON: mocks.export, getBackupSummary: mocks.summary } }));
vi.mock('../../../lib/supabase', () => ({
  supabase: { from: () => {
    const query = { select: () => query, eq: () => query, order: () => Promise.resolve({ data: [] }) };
    return query;
  } }, getStoredSupabaseConfig: () => ({ url: '', key: '' }), saveSupabaseConfig: vi.fn(),
}));

describe('backup UX does not download or report success after failures', () => {
  let root: Root, container: HTMLDivElement;
  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    vi.resetAllMocks(); mocks.createURL.mockReturnValue('blob:backup'); mocks.summary.mockResolvedValue({});
    vi.stubGlobal('URL', { createObjectURL: mocks.createURL, revokeObjectURL: mocks.revokeURL });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(mocks.click);
    container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
  async function click(label: string) {
    const button = [...container.querySelectorAll('button')].find(b => b.textContent?.trim() === label)!;
    expect(button).toBeDefined(); await act(async () => button.click());
  }
  async function mountBackup() { await act(async () => root.render(<ProfileView />)); await click('Dados e Backup'); }
  const payload = () => ({ app: 'ph-drive', schemaVersion: 1, metadata: { counts: { profiles: 1, vehicles: 1, trips: 1 } } });

  it('shows Preparing, then completion and exported record count only after the service resolves', async () => {
    let complete!: (value: any) => void; mocks.export.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
    await mountBackup(); await click('Exportar backup completo');
    expect(container.textContent).toContain('Preparando backup...'); expect(mocks.click).not.toHaveBeenCalled();
    await act(async () => complete(payload()));
    expect(container.textContent).toContain('Backup concluído — 3 registros exportados');
    expect(mocks.click).toHaveBeenCalledTimes(1); expect(mocks.revokeURL).toHaveBeenCalledWith('blob:backup');
  });
  it('shows a clear failure and creates no partial downloadable file', async () => {
    mocks.export.mockRejectedValue(new Error('Falha ao ler trip_points no backup'));
    await mountBackup(); await click('Exportar backup completo');
    expect(container.querySelector('[role="alert"]')!.textContent).toContain('Falha ao ler trip_points');
    expect(container.textContent).not.toContain('Backup concluído');
    expect(mocks.createURL).not.toHaveBeenCalled(); expect(mocks.click).not.toHaveBeenCalled();
  });
  it('clears previous success on a failed retry and can subsequently recover', async () => {
    mocks.export.mockResolvedValueOnce(payload()).mockRejectedValueOnce(new Error('Falha na página intermediária')).mockResolvedValue(payload());
    await mountBackup(); await click('Exportar backup completo'); await click('Exportar backup completo');
    expect(container.textContent).not.toContain('Backup concluído'); expect(container.textContent).toContain('Falha na página intermediária');
    await click('Exportar backup completo');
    expect(container.textContent).toContain('Backup concluído'); expect(container.textContent).not.toContain('Falha na página intermediária');
  });
  it('count failures show unavailable values rather than a successful zero count', async () => {
    mocks.summary.mockRejectedValue(new Error('Contagens indisponíveis'));
    await mountBackup(); expect(container.textContent).toContain('Contagens indisponíveis');
    expect(container.textContent).toContain('—');
  });
});
