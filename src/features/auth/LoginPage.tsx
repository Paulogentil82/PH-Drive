import React, { useState } from 'react';
import { Car, Lock, Mail, User, ArrowRight, ShieldCheck, Database, Settings } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { SupabaseSetupModal } from './SupabaseSetupModal';

interface LoginPageProps {
  onSetupNeeded: () => void;
}

export function LoginPage({ onSetupNeeded }: LoginPageProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
          },
        });
        if (error) throw error;
        setMessage('Conta criada com sucesso! Verifique seu email para confirmação (se habilitado) ou faça login.');
        setIsSignUp(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro na autenticação.');
    } finally {
      setLoading(false);
    }
  };

  const hasEnvSupabaseConfig =
    Boolean(import.meta.env.VITE_SUPABASE_URL) &&
    Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top bar settings */}
      {!hasEnvSupabaseConfig && (
        <div className="absolute top-4 right-4 flex items-center gap-2">
          <button
            onClick={() => setShowConfigModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-lg text-xs font-medium transition"
          >
            <Settings className="w-3.5 h-3.5 text-blue-500" />
            <span>Configurar Supabase</span>
          </button>
        </div>
      )}

      <div className="w-full max-w-md relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3.5 bg-blue-600/20 text-blue-500 rounded-2xl border border-blue-500/30 mb-4 shadow-xl shadow-blue-600/10">
            <Car className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">PH Drive</h1>
          <p className="text-sm text-slate-400 mt-1">Plataforma pessoal de gerenciamento de veículos</p>
        </div>

        {/* Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-2xl backdrop-blur-xl">
          <div className="flex border-b border-slate-800 mb-6">
            <button
              type="button"
              onClick={() => { setIsSignUp(false); setError(null); setMessage(null); }}
              className={`flex-1 pb-3 text-sm font-medium border-b-2 transition ${
                !isSignUp 
                  ? 'border-blue-600 text-white' 
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => { setIsSignUp(true); setError(null); setMessage(null); }}
              className={`flex-1 pb-3 text-sm font-medium border-b-2 transition ${
                isSignUp 
                  ? 'border-blue-600 text-white' 
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Criar Conta
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-950/50 border border-red-800/50 text-red-300 text-xs rounded-xl flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {message && (
            <div className="mb-4 p-3 bg-emerald-950/50 border border-emerald-800/50 text-emerald-300 text-xs rounded-xl flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
              <span>{message}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Nome Completo
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <User className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Paulo H. Lera"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                E-mail
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu.email@exemplo.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Senha
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium text-sm rounded-xl transition shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2"
            >
              <span>{loading ? 'Processando...' : isSignUp ? 'Criar Conta' : 'Entrar no Sistema'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-800 text-center text-xs text-slate-400 flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Autenticação segura via Supabase Auth & RLS</span>
          </div>
        </div>
      </div>

      {showConfigModal && (
        <SupabaseSetupModal onConfigured={() => setShowConfigModal(false)} />
      )}
    </div>
  );
}
