import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { UserPreferences, DEFAULT_PREFERENCES, preferencesService } from './preferencesService';
import { formatDistance, formatCurrency, formatAppDate } from '../../utils/formatters';

interface PreferencesContextType {
  preferences: UserPreferences;
  loading: boolean;
  savePreferences: (newPrefs: UserPreferences) => Promise<void>;
  formatDistance: (km: number) => string;
  formatCurrency: (amount: number) => string;
  formatAppDate: (date: string | Date | null | undefined) => string;
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<UserPreferences>(() => preferencesService.getLocalStorageCache());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initial theme application before user loads or during render
    preferencesService.applyTheme(preferences.theme_preference);
  }, [preferences.theme_preference]);

  useEffect(() => {
    const initPrefs = async () => {
      if (!user) {
        setPreferences(DEFAULT_PREFERENCES);
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        const prefs = await preferencesService.loadPreferences(user.id);
        setPreferences(prefs);
        preferencesService.applyTheme(prefs.theme_preference);
      } catch (err) {
        console.error('Failed to initialize user preferences:', err);
      } finally {
        setLoading(false);
      }
    };

    initPrefs();
  }, [user]);

  const handleSavePreferences = async (newPrefs: UserPreferences) => {
    if (!user) throw new Error('Usuário não autenticado');
    await preferencesService.savePreferences(user.id, newPrefs);
    setPreferences(newPrefs);
  };

  const formattedDistance = (km: number) => {
    return formatDistance(km, preferences.distance_unit);
  };

  const formattedCurrency = (amount: number) => {
    return formatCurrency(amount, preferences.currency_code);
  };

  const formattedDate = (date: string | Date | null | undefined) => {
    return formatAppDate(date, preferences.date_format);
  };

  return (
    <PreferencesContext.Provider
      value={{
        preferences,
        loading,
        savePreferences: handleSavePreferences,
        formatDistance: formattedDistance,
        formatCurrency: formattedCurrency,
        formatAppDate: formattedDate
      }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('usePreferences must be used within a PreferencesProvider');
  }
  return context;
}
