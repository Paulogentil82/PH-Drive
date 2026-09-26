import React from 'react';
import { Construction, ArrowLeft } from 'lucide-react';
import { PageHeader } from '../../components/common/CommonComponents';
import { NavigationTab } from '../../types';

interface DevelopmentViewProps {
  title: string;
  description: string;
  onBack: () => void;
}

export function DevelopmentView({ title, description, onBack }: DevelopmentViewProps) {
  return (
    <div>
      <PageHeader
        title={title}
        subtitle="Módulo planejado para as próximas etapas do PH Drive"
        action={
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl transition border border-slate-700"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar para Visão Geral</span>
          </button>
        }
      />

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center max-w-xl mx-auto my-12 shadow-xl flex flex-col items-center">
        <div className="p-4 bg-blue-600/10 text-blue-400 rounded-2xl mb-4 border border-blue-500/20">
          <Construction className="w-10 h-10" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">Em Desenvolvimento</h3>
        <p className="text-sm text-slate-400 max-w-md leading-relaxed mb-6">
          {description}
        </p>
        <div className="inline-block px-4 py-1.5 bg-blue-950/60 border border-blue-900/50 rounded-full text-xs font-medium text-blue-300">
          Fundação Etapa 0 Concluída • Aguarde as Próximas Etapas
        </div>
      </div>
    </div>
  );
}
