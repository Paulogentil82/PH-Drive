import React, { useState } from 'react';
import { Database, Key, Globe, ShieldAlert, CheckCircle, ExternalLink } from 'lucide-react';
import { getStoredSupabaseConfig, saveSupabaseConfig, isSupabaseConfigured } from '../../lib/supabase';

interface SupabaseSetupModalProps {
  onConfigured: () => void;
}

export function SupabaseSetupModal({ onConfigured }: SupabaseSetupModalProps) {
  const current = getStoredSupabaseConfig();
  const [url, setUrl] = useState(current.url.includes('placeholder') ? '' : current.url);
  const [key, setKey] = useState(current.key.includes('placeholder') ? '' : current.key);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !key.trim()) {
      setError('Por favor, informe a URL do projeto e a chave Anon do Supabase.');
      return;
    }
    if (!url.startsWith('https://')) {
      setError('A URL do Supabase deve começar com https://');
      return;
    }

    saveSupabaseConfig(url, key);
    setSuccess(true);
    setError(null);
    setTimeout(() => {
      onConfigured();
      window.location.reload();
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 md:p-8 text-slate-100">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-blue-600/20 text-blue-400 rounded-xl border border-blue-500/30">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white">Configuração do Supabase</h2>
            <p className="text-sm text-slate-400">Conecte o PH Drive ao seu banco de dados PostgreSQL seguro.</p>
          </div>
        </div>

        <div className="bg-blue-950/40 border border-blue-900/50 rounded-xl p-4 mb-6 text-xs text-blue-200 leading-relaxed space-y-2">
          <div className="font-semibold flex items-center gap-1.5 text-blue-300">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>Por que isso é necessário?</span>
          </div>
          <p>
            O PH Drive utiliza autenticação real (Supabase Auth) e banco de dados relacional com Row Level Security (RLS) para garantir que seus dados de veículos pertençam exclusivamente a você.
          </p>
          <p className="pt-1">
            Crie um projeto gratuito em{' '}
            <a 
              href="https://supabase.com" 
              target="_blank" 
              rel="noreferrer" 
              className="underline text-blue-400 hover:text-blue-300 inline-flex items-center gap-1"
            >
              supabase.com <ExternalLink className="w-3 h-3" />
            </a>
            {' '}e cole abaixo suas credenciais (Project URL e anon/public key).
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-950/50 border border-red-800/50 text-red-300 text-xs rounded-xl flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-emerald-950/50 border border-emerald-800/50 text-emerald-300 text-xs rounded-xl flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Configuração salva com sucesso! Recarregando...</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Supabase Project URL
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <Globe className="w-4 h-4" />
              </span>
              <input
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://seu-projeto.supabase.co"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Supabase Anon / Public Key
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <Key className="w-4 h-4" />
              </span>
              <input
                type="password"
                required
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIsIn..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition font-mono text-xs"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="submit"
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm rounded-xl transition shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2"
            >
              <Database className="w-4 h-4" />
              <span>Salvar e Conectar ao Supabase</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
