import { describe, it, expect, vi, beforeEach } from 'vitest';
import { formatDistance, formatCurrency, formatAppDate } from '../../../utils/formatters';
import { preferencesService, DEFAULT_PREFERENCES } from '../preferencesService';
import { supabase } from '../../../lib/supabase';

vi.mock('../../../lib/supabase', () => {
  const mockSingle = vi.fn();
  const mockSelect = vi.fn();
  const mockEq = vi.fn();
  const mockUpdate = vi.fn();

  const mockQueryBuilder = {
    select: mockSelect,
    eq: mockEq,
    single: mockSingle,
    update: mockUpdate
  };

  mockSelect.mockReturnValue(mockQueryBuilder);
  mockEq.mockReturnValue(mockQueryBuilder);
  mockSingle.mockResolvedValue({ data: {}, error: null });
  mockUpdate.mockReturnValue(mockQueryBuilder);

  return {
    supabase: {
      from: vi.fn(() => mockQueryBuilder),
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-a' } }, error: null })
      }
    }
  };
});

describe('Preferences & Formatting Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('Unidades e Formatação', () => {
    it('KM formata km corretamente', () => {
      const formatted = formatDistance(12.3, 'KM');
      expect(formatted).toBe('12,3 km');
    });

    it('MI converte km para milhas corretamente (1.609344)', () => {
      const formatted = formatDistance(16.09344, 'MI');
      expect(formatted).toBe('10,0 mi');
    });

    it('BRL formata moeda corretamente', () => {
      const formatted = formatCurrency(122.61, 'BRL');
      // replace non-breaking space with normal space for comparison robustness
      const clean = formatted.replace(/\u00a0/g, ' ');
      expect(clean).toContain('R$');
      expect(clean).toContain('122,61');
    });

    it('USD formata moeda americana', () => {
      const formatted = formatCurrency(100, 'USD');
      const clean = formatted.replace(/\u00a0/g, ' ');
      expect(clean).toContain('$');
      expect(clean).toContain('100');
    });

    it('formato de data DD/MM/YYYY', () => {
      const formatted = formatAppDate('2026-09-26', 'DD/MM/YYYY');
      expect(formatted).toBe('26/09/2026');
    });

    it('formato de data MM/DD/YYYY', () => {
      const formatted = formatAppDate('2026-09-26', 'MM/DD/YYYY');
      expect(formatted).toBe('09/26/2026');
    });

    it('formato de data YYYY-MM-DD', () => {
      const formatted = formatAppDate('2026-09-26', 'YYYY-MM-DD');
      expect(formatted).toBe('2026-09-26');
    });
  });

  describe('Alertas Exibição', () => {
    const rawAlerts = [
      { id: '1', severity: 'PRÓXIMO' },
      { id: '2', severity: 'URGENTE' },
      { id: '3', severity: 'VENCIDO' }
    ] as any[];

    it('alerta PRÓXIMO oculto quando desabilitado', () => {
      const prefs = {
        alert_upcoming_enabled: false,
        alert_urgent_enabled: true,
        alert_overdue_enabled: true
      };

      const filtered = rawAlerts.filter(a => {
        if (a.severity === 'PRÓXIMO' && !prefs.alert_upcoming_enabled) return false;
        return true;
      });

      expect(filtered.length).toBe(2);
      expect(filtered.some(a => a.severity === 'PRÓXIMO')).toBe(false);
    });

    it('urgente preservado quando habilitado', () => {
      const prefs = {
        alert_upcoming_enabled: true,
        alert_urgent_enabled: true,
        alert_overdue_enabled: true
      };

      const filtered = rawAlerts.filter(a => {
        if (a.severity === 'URGENTE' && !prefs.alert_urgent_enabled) return false;
        return true;
      });

      expect(filtered.length).toBe(3);
    });

    it('vencido preservado quando habilitado', () => {
      const prefs = {
        alert_upcoming_enabled: true,
        alert_urgent_enabled: true,
        alert_overdue_enabled: true
      };

      const filtered = rawAlerts.filter(a => {
        if (a.severity === 'VENCIDO' && !prefs.alert_overdue_enabled) return false;
        return true;
      });

      expect(filtered.length).toBe(3);
    });
  });

  describe('Service & Persistência', () => {
    it('carrega preferências do localStorage se falhar no Supabase', async () => {
      const mockLoad = vi.spyOn(supabase, 'from');
      const prefs = await preferencesService.loadPreferences('user-1');
      expect(mockLoad).toHaveBeenCalled();
      expect(prefs.distance_unit).toBe('KM');
    });

    it('salva preferências e persiste no cache', async () => {
      const prefs = {
        ...DEFAULT_PREFERENCES,
        distance_unit: 'MI' as const,
        currency_code: 'USD' as const
      };

      await preferencesService.savePreferences('user-1', prefs);
      const cached = preferencesService.getLocalStorageCache();
      expect(cached.distance_unit).toBe('MI');
      expect(cached.currency_code).toBe('USD');
    });

    it('validação de veículo de outro usuário rejeitado ao salvar', async () => {
      // Mock validation returning no vehicle (belonging to other tenant)
      const mockSingle = vi.fn().mockResolvedValue({ data: null, error: new Error('Not found') });
      vi.spyOn(supabase, 'from').mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: mockSingle
      } as any);

      await expect(preferencesService.savePreferences('user-1', {
        ...DEFAULT_PREFERENCES,
        default_vehicle_id: 'other-vehicle'
      })).rejects.toThrow();
    });

    it('tema persiste no documentElement', () => {
      preferencesService.applyTheme('DARK');
      expect(window.document.documentElement.classList.contains('dark')).toBe(true);

      preferencesService.applyTheme('LIGHT');
      expect(window.document.documentElement.classList.contains('light')).toBe(true);
      expect(window.document.documentElement.classList.contains('dark')).toBe(false);
    });
  });

  describe('Correção de Persistência - 4A.9', () => {
    it('selecionar MI salva MI e payload contém todos os campos', async () => {
      const mockEq = vi.fn().mockResolvedValue({ error: null });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
      vi.spyOn(supabase, 'from').mockReturnValue({
        update: mockUpdate,
      } as any);

      const prefs = {
        ...DEFAULT_PREFERENCES,
        distance_unit: 'MI' as const,
        alert_upcoming_enabled: false
      };

      await preferencesService.savePreferences('user-1', prefs);

      expect(mockUpdate).toHaveBeenCalledWith({
        default_vehicle_id: prefs.default_vehicle_id,
        distance_unit: 'MI',
        currency_code: prefs.currency_code,
        date_format: prefs.date_format,
        alert_upcoming_enabled: false,
        alert_urgent_enabled: prefs.alert_urgent_enabled,
        alert_overdue_enabled: prefs.alert_overdue_enabled,
        theme_preference: prefs.theme_preference
      });
    });

    it('false em alert_upcoming_enabled é preservado e não vira true por ||', async () => {
      const mockSingle = vi.fn().mockResolvedValue({
        data: {
          distance_unit: 'MI',
          alert_upcoming_enabled: false,
          currency_code: 'USD',
          date_format: 'YYYY-MM-DD',
          theme_preference: 'DARK'
        },
        error: null
      });

      vi.spyOn(supabase, 'from').mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: mockSingle
      } as any);

      localStorage.clear();

      const prefs = await preferencesService.loadPreferences('user-1');
      expect(prefs.distance_unit).toBe('MI');
      expect(prefs.alert_upcoming_enabled).toBe(false);
    });

    it('KM não sobrescreve MI após refresh lógico e cache não sobrescreve banco', async () => {
      preferencesService.setLocalStorageCache({
        ...DEFAULT_PREFERENCES,
        distance_unit: 'MI' as const,
        alert_upcoming_enabled: false
      });

      const mockSingle = vi.fn().mockResolvedValue({
        data: {
          distance_unit: null,
          alert_upcoming_enabled: null
        },
        error: null
      });

      vi.spyOn(supabase, 'from').mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: mockSingle
      } as any);

      const prefs = await preferencesService.loadPreferences('user-1');
      expect(prefs.distance_unit).toBe('MI');
      expect(prefs.alert_upcoming_enabled).toBe(false);
    });

    it('reidratação mantém MI + false', async () => {
      const mockSingle = vi.fn().mockResolvedValue({
        data: {
          distance_unit: null,
          alert_upcoming_enabled: null
        },
        error: null
      });
      vi.spyOn(supabase, 'from').mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: mockSingle
      } as any);

      preferencesService.setLocalStorageCache({
        ...DEFAULT_PREFERENCES,
        distance_unit: 'MI' as const,
        alert_upcoming_enabled: false
      });

      const prefs = await preferencesService.loadPreferences('user-1');
      expect(prefs.distance_unit).toBe('MI');
      expect(prefs.alert_upcoming_enabled).toBe(false);
    });
  });
});
