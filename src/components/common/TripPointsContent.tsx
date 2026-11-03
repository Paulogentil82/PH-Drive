import React from 'react';
import { backendErrorMessage } from '../../lib/backendDiagnostics';
import { TripPointsState } from '../../features/trips/useTripPoints';
import { ErrorState } from './CommonComponents';
import { TripMap } from './TripMap';

export function TripPointsContent({ state, onRetry, onSignIn, height }: {
  state: TripPointsState; onRetry: () => void; onSignIn?: () => void; height: string;
}) {
  if (state.status === 'LOADING') return <div role="status" style={{ height }} className="flex items-center justify-center text-sm text-slate-400">Carregando trajeto...</div>;
  if (state.status === 'ERROR') return <div role="alert">
    <ErrorState title="Erro ao carregar trajeto" message={`Não foi possível carregar os pontos GPS. ${backendErrorMessage(state.error?.kind ?? 'UNKNOWN')}`} onRetry={onRetry} />
    {state.error?.kind === 'AUTH' && onSignIn && <button type="button" onClick={onSignIn} className="px-4 py-2 text-sm text-blue-400">Entrar novamente</button>}
  </div>;
  if (state.status === 'IDLE') return <p className="text-sm text-slate-400">Selecione uma viagem para visualizar o trajeto.</p>;
  // Only a confirmed read may present an empty GPS route.
  return <TripMap key={state.points[0]?.trip_id ?? 'empty'} points={state.points} height={height} />;
}
