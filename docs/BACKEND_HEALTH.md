# Diagnóstico de backend e carregamento GPS

## Escopo e significado

O Perfil exibe um indicador discreto e uma verificação sob demanda. Há uma checagem
na entrada da tela, sem polling. Chamadas concorrentes da checagem compartilham a
mesma promessa. O botão permanece desabilitado durante a leitura.

A checagem verifica a configuração local, a conectividade informada pelo navegador,
o usuário via `auth.getUser()` e a Data API via HEAD em `profiles`, limitada a um
registro e filtrada pelo usuário verificado. Não baixa dados do perfil, não escreve
em tabelas e não usa RPC, service role ou configuração externa.

- ONLINE: leitura respondeu sem falha conhecida nas operações instrumentadas.
- DEGRADED: aplicação online com erro de rede/backend, permissão, recurso ou
  recuperação após retry. Uma resposta bem-sucedida não esconde falha ainda aberta
  de outra operação instrumentada.
- OFFLINE: o navegador informa ausência de conectividade no momento da checagem.
- AUTH_ERROR: sessão ausente/inválida, HTTP 401 ou código estruturado de autenticação.
- UNKNOWN: sem verificação ou cliente não configurado.

O status registra observações do frontend, não disponibilidade histórica, acesso a
todas as tabelas, integridade dos dados, RLS real ou estado do Companion.
`Última verificação` não significa última sincronização do Android. Uma falha de
rede com navegador online é DEGRADED: `navigator.onLine` não prova acesso ao backend.

## Mapa e detalhes da viagem

`useTripPoints` compartilha os estados IDLE, LOADING, SUCCESS_WITH_POINTS,
SUCCESS_EMPTY e ERROR. Apenas uma leitura concluída com array vazio mostra
`Nenhum ponto GPS registrado`. Erros e corpo inesperado não viram trajeto vazio;
a contagem permanece desconhecida (`—`) até confirmação.

A troca de viagem, usuário ou fechamento do modal invalida a aplicação das respostas
anteriores na UI. O descarte é lógico; a consulta anterior pode terminar em background
até seu prazo. O botão `Tentar novamente` repete somente a leitura dos pontos.
O mapa também distingue falhas na carga de veículos/viagens de uma lista vazia válida.

HTTP 403/42501 significa permissão, não sessão expirada. HTTP 401 e códigos de auth
produzem mensagem de sessão e ação `Entrar novamente`, reutilizando `signOut` e a
tela de login existentes. Não há logout automático por erro de rede nem login paralelo.

## Retry, timeout e logs

`runBackendRead` aceita somente GET/HEAD: no máximo uma tentativa extra, após 400 ms,
para NETWORK/SERVER. Cada tentativa tem prazo de 10 s e AbortSignal para leituras
PostgREST. Auth tem prazo de espera sem API de cancelamento fornecida pelo SDK.
Não se repetem erros de auth/permissão/not-found/unknown. Inserções, atualizações,
exclusões e restauração não usam esse helper. A paginação/cursor GPS foi preservada;
o retry de uma página mantém o cursor e só adiciona os dados após sucesso.

Logs novos são apenas DEV: operação de uma lista fixa, status, categoria, código
permitido, status HTTP e duração. Não recebem erro bruto, token, usuário, coordenadas
ou payload. O modelo permanece em memória e não persiste credenciais.

## Auditoria local das demais áreas — sem ampliar alterações funcionais

| Área/arquivo | Observação comprovada no código | Situação nesta etapa |
| --- | --- | --- |
| `map/MapView.tsx` | Catch dos pontos substituía erro por `[]`; sem proteção contra resposta antiga | Corrigido, com testes de erro/retry/troca de viagem |
| `trips/TripDetailModal.tsx` | Catch somente registrava erro; pontos anteriores podiam permanecer visíveis | Corrigido pelo mesmo estado compartilhado |
| `trips/tripPointsService.ts` | Já propagava erro remoto e paginava por sequência | Preservado, acrescentando diagnóstico e retry limitado somente à leitura |
| `dashboard/dashboardService.ts`, `DashboardView.tsx` | Serviço propaga falhas; View tem loading/error/empty e proteção contra resposta atrasada | Inspecionado e preservado |
| `trips/TripsView.tsx` | Consultas diretas conferem `error`; writes de iniciar/encerrar/cancelar ficam na View | Inspecionado; regras e writes preservados |
| `profile/backupService.ts`, `backupPagination.ts` | Exportação JSON falha explicitamente; CSVs antigos ainda ignoram `error` em algumas consultas | JSON preservado; CSVs precisam de revisão separada |
| `profile/ProfileView.tsx` | Leitura de veículos para preferências usa `data || []` sem conferir `error` | Indicador adicionado; leitura antiga permanece como limitação |
| `profile/preferencesService.ts` | Falha de leitura usa cache local; isso não comprova atualização remota | Preservado; futura indicação da origem/cache |
| `alerts/alertsService.ts` | Consultas desestruturam apenas `data`; podem produzir alertas vazios/parciais em falha | Pendente de correção com testes próprios |
| `alerts/AlertsModule.tsx`, `App.tsx` | Retry de alertas usa reload; chamada de alertas do App não tem catch | Pendente; não foi feita centralização geral |
| `auth/AuthContext.tsx` | Escuta auth existente; leitura inicial de sessão não tem catch; perfil só registra falhas | Fluxo reutilizado, sem redesenhar bootstrap nesta tarefa |
| `lib/supabase.ts` | Configuração vem de env/localStorage; cliente placeholder quando ausente | Preservado; check não consulta placeholder |
| `layouts/AppLayout.tsx`, common | Layout sem consultas ao banco; TripMap recebe somente pontos | Layout preservado; mensagens adicionadas sem nova estrutura visual |

Essas limitações não são exploração ou indisponibilidade reproduzida no backend real.
O indicador não intercepta todas as chamadas Supabase do projeto. A instrumentação
ativa se limita ao mapa/pontos GPS e à checagem explícita no Perfil.

## Homologação pendente

Validar no Raspberry: trajeto existente, viagem sem pontos, erro de leitura/retry,
troca de viagens durante carga e indicador no Perfil. Nenhuma falha foi provocada
no Supabase real nesta etapa. Comportamento sob indisponibilidade real permanece
não comprovado pelos testes simulados.

Futuro, sem implementação aqui: monitoramento histórico, métricas agregadas de
latência, alertas de indisponibilidade e status do Companion separado do backend.
