import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in application:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center select-none">
          <div className="max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
            <div className="w-16 h-16 bg-red-950/50 border border-red-500/30 rounded-2xl flex items-center justify-center text-red-500 text-3xl mx-auto mb-6">
              ⚠️
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white mb-3">
              Ops! Algo deu errado
            </h1>
            <p className="text-slate-400 text-sm leading-relaxed mb-6">
              Desculpe o transtorno. Ocorreu um erro inesperado na inicialização ou renderização do PH Drive. Nenhuma informação pessoal ou técnica sensível foi exposta.
            </p>
            <button
              onClick={this.handleReload}
              className="w-full inline-flex items-center justify-center px-4 py-2.5 text-sm font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 transition-colors duration-200 rounded-xl cursor-pointer"
            >
              Recarregar Aplicativo
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
