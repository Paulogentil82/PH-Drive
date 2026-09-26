import { createClient } from '@supabase/supabase-js';

const STORAGE_KEY_URL = 'ph_drive_supabase_url';
const STORAGE_KEY_KEY = 'ph_drive_supabase_anon_key';

export function getStoredSupabaseConfig() {
  if (typeof window === 'undefined') return { url: '', key: '' };
  return {
    url: localStorage.getItem(STORAGE_KEY_URL) || import.meta.env.VITE_SUPABASE_URL || '',
    key: localStorage.getItem(STORAGE_KEY_KEY) || import.meta.env.VITE_SUPABASE_ANON_KEY || '',
  };
}

export function saveSupabaseConfig(url: string, key: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY_URL, url.trim());
  localStorage.setItem(STORAGE_KEY_KEY, key.trim());
}

export function clearSupabaseConfig() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY_URL);
  localStorage.removeItem(STORAGE_KEY_KEY);
}

const config = getStoredSupabaseConfig();

// Create Supabase client (if URL & Key are present, otherwise dummy client that throws or prompts)
export const supabase = createClient(
  config.url || 'https://placeholder-project.supabase.co',
  config.key || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

export function isSupabaseConfigured(): boolean {
  const { url, key } = getStoredSupabaseConfig();
  return Boolean(
    url && 
    key && 
    url.startsWith('http') && 
    !url.includes('placeholder-project')
  );
}
