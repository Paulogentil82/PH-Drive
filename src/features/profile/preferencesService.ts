import { supabase } from '../../lib/supabase';

export interface UserPreferences {
  default_vehicle_id: string | null;
  distance_unit: 'KM' | 'MI';
  currency_code: 'BRL' | 'USD' | 'EUR';
  date_format: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
  alert_upcoming_enabled: boolean;
  alert_urgent_enabled: boolean;
  alert_overdue_enabled: boolean;
  theme_preference: 'SYSTEM' | 'LIGHT' | 'DARK';
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  default_vehicle_id: null,
  distance_unit: 'KM',
  currency_code: 'BRL',
  date_format: 'DD/MM/YYYY',
  alert_upcoming_enabled: true,
  alert_urgent_enabled: true,
  alert_overdue_enabled: true,
  theme_preference: 'SYSTEM'
};

const LOCAL_STORAGE_KEY = 'phdrive_preferences_cache';

export const preferencesService = {
  getLocalStorageCache(): UserPreferences {
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        return {
          default_vehicle_id: parsed.default_vehicle_id !== undefined ? parsed.default_vehicle_id : DEFAULT_PREFERENCES.default_vehicle_id,
          distance_unit: parsed.distance_unit ?? DEFAULT_PREFERENCES.distance_unit,
          currency_code: parsed.currency_code ?? DEFAULT_PREFERENCES.currency_code,
          date_format: parsed.date_format ?? DEFAULT_PREFERENCES.date_format,
          alert_upcoming_enabled: parsed.alert_upcoming_enabled ?? DEFAULT_PREFERENCES.alert_upcoming_enabled,
          alert_urgent_enabled: parsed.alert_urgent_enabled ?? DEFAULT_PREFERENCES.alert_urgent_enabled,
          alert_overdue_enabled: parsed.alert_overdue_enabled ?? DEFAULT_PREFERENCES.alert_overdue_enabled,
          theme_preference: parsed.theme_preference ?? DEFAULT_PREFERENCES.theme_preference
        };
      }
    } catch (e) {
      console.warn('Failed to read from localStorage:', e);
    }
    return DEFAULT_PREFERENCES;
  },

  setLocalStorageCache(prefs: UserPreferences) {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(prefs));
    } catch (e) {
      console.warn('Failed to write to localStorage:', e);
    }
  },

  async loadPreferences(userId: string): Promise<UserPreferences> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          default_vehicle_id,
          distance_unit,
          currency_code,
          date_format,
          alert_upcoming_enabled,
          alert_urgent_enabled,
          alert_overdue_enabled,
          theme_preference
        `)
        .eq('user_id', userId)
        .single();

      if (error) {
        console.warn('Using cached preferences fallback due to database query warning:', error.message);
        return this.getLocalStorageCache();
      }

      if (data) {
        const cached = this.getLocalStorageCache();
        // Supabase is the source of truth. If a database field is null or undefined, fallback to cache, then to default.
        const prefs: UserPreferences = {
          default_vehicle_id: data.default_vehicle_id !== undefined ? data.default_vehicle_id : (cached.default_vehicle_id ?? DEFAULT_PREFERENCES.default_vehicle_id),
          distance_unit: (data.distance_unit ?? cached.distance_unit ?? DEFAULT_PREFERENCES.distance_unit) as any,
          currency_code: (data.currency_code ?? cached.currency_code ?? DEFAULT_PREFERENCES.currency_code) as any,
          date_format: (data.date_format ?? cached.date_format ?? DEFAULT_PREFERENCES.date_format) as any,
          alert_upcoming_enabled: data.alert_upcoming_enabled ?? cached.alert_upcoming_enabled ?? DEFAULT_PREFERENCES.alert_upcoming_enabled,
          alert_urgent_enabled: data.alert_urgent_enabled ?? cached.alert_urgent_enabled ?? DEFAULT_PREFERENCES.alert_urgent_enabled,
          alert_overdue_enabled: data.alert_overdue_enabled ?? cached.alert_overdue_enabled ?? DEFAULT_PREFERENCES.alert_overdue_enabled,
          theme_preference: (data.theme_preference ?? cached.theme_preference ?? DEFAULT_PREFERENCES.theme_preference) as any
        };
        
        // Update cache with the verified database values
        this.setLocalStorageCache(prefs);
        return prefs;
      }
    } catch (err) {
      console.error('Failed to load preferences from Supabase:', err);
    }

    return this.getLocalStorageCache();
  },

  async savePreferences(userId: string, prefs: UserPreferences): Promise<void> {
    // 1. Validate default_vehicle_id ownership (MUST belong to this user if not null)
    if (prefs.default_vehicle_id) {
      const { data, error: vError } = await supabase
        .from('vehicles')
        .select('id')
        .eq('id', prefs.default_vehicle_id)
        .eq('user_id', userId)
        .single();

      if (vError || !data) {
        throw new Error('O veículo padrão selecionado é inválido ou pertence a outro usuário.');
      }
    }

    // Apply theme change directly to HTML element
    this.applyTheme(prefs.theme_preference);

    try {
      // 2. Persist to public.profiles in Supabase
      const { error } = await supabase
        .from('profiles')
        .update({
          default_vehicle_id: prefs.default_vehicle_id,
          distance_unit: prefs.distance_unit,
          currency_code: prefs.currency_code,
          date_format: prefs.date_format,
          alert_upcoming_enabled: prefs.alert_upcoming_enabled,
          alert_urgent_enabled: prefs.alert_urgent_enabled,
          alert_overdue_enabled: prefs.alert_overdue_enabled,
          theme_preference: prefs.theme_preference
        })
        .eq('user_id', userId);

      if (error) {
        console.warn('Database preferences update warning:', error.message);
      } else {
        // Only update local cache after successful or warned database operation to avoid cache out-of-sync
        this.setLocalStorageCache(prefs);
      }
    } catch (err) {
      console.error('Failed to update preferences on Supabase:', err);
      // Fallback update cache anyway so UX is responsive
      this.setLocalStorageCache(prefs);
    }
  },

  applyTheme(theme: 'SYSTEM' | 'LIGHT' | 'DARK') {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    if (theme === 'DARK') {
      root.classList.add('dark');
    } else if (theme === 'LIGHT') {
      root.classList.add('light');
    } else {
      // System
      const hasMatchMedia = window.matchMedia && typeof window.matchMedia === 'function';
      const systemTheme = (hasMatchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
      root.classList.add(systemTheme);
    }
  }
};
