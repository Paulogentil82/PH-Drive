# PH DRIVE — REGRAS DE ENGENHARIA

## Prioridades
1. Correção > velocidade.
2. Integridade dos dados > aparência.
3. Segurança > conveniência.
4. Evidência > suposição.
5. Simplicidade > complexidade.
6. Mudança mínima > refatoração desnecessária.

## Regra de evidência
Nunca declarar uma tarefa, etapa, correção ou funcionalidade como concluída apenas porque:
- o código foi escrito;
- compilou;
- parece correto;
- um arquivo foi criado.

Toda conclusão deve ser sustentada por evidências adequadas.

Usar os estados:
- CONFIRMADO
- PENDENTE
- NÃO COMPROVADO

## Antes de qualquer alteração
- verificar git status;
- identificar branch atual;
- entender os arquivos afetados;
- identificar testes relacionados;
- identificar riscos de regressão;
- não alterar arquivos não relacionados.

Se o working tree já estiver sujo, informar isso antes de modificar qualquer coisa.

## Git
- nunca executar push, merge, rebase, reset destrutivo ou force push sem autorização explícita;
- nunca fazer commit sem autorização explícita;
- preservar histórico;
- não modificar alterações do usuário que não façam parte da tarefa.

## Escopo
Implementar a menor mudança capaz de resolver o problema.

Não:
- refatorar código não relacionado;
- renomear estruturas sem necessidade;
- trocar bibliotecas sem autorização;
- introduzir novas dependências sem necessidade demonstrável;
- instalar ou atualizar dependências sem autorização.

## Banco de dados e Supabase
Alterações de banco são de alto risco.

Nunca:
- executar migration sem autorização;
- assumir que um SQL do repositório foi aplicado no banco;
- assumir que o banco real corresponde ao código;
- alterar migration já aplicada sem antes verificar seu estado;
- remover dados, tabelas, políticas ou constraints automaticamente.

Para alterações relacionadas ao Supabase verificar:
- autenticação;
- RLS;
- auth.uid();
- isolamento por usuário;
- ownership das entidades;
- foreign keys;
- constraints;
- concorrência;
- idempotência;
- SECURITY DEFINER;
- permissões EXECUTE;
- impacto em dados existentes.

Qualquer função SECURITY DEFINER deve receber revisão explícita de segurança.

## Secrets
Nunca:
- incluir secrets no código;
- exibir secrets em relatórios;
- versionar .env;
- colocar service-role keys no frontend;
- substituir credenciais reais por valores inventados.

O frontend pode usar apenas credenciais públicas apropriadas para cliente.

## Migrations
Manter ordem e rastreabilidade.

Antes de criar migration:
- identificar dependências;
- verificar estado do schema;
- considerar instalação limpa;
- considerar banco já existente;
- considerar rollback ou estratégia de recuperação.

Não tratar alteração manual de SQL histórico como migration aplicada.

## Testes
Antes de declarar uma alteração concluída:
- executar testes diretamente relacionados, quando disponíveis;
- executar verificação TypeScript/lint pertinente;
- executar build quando a alteração puder afetá-lo;
- informar exatamente quais comandos foram executados;
- informar quantidade de testes aprovados/falhos quando aplicável.

Não afirmar que testes passaram se não foram executados.

Não instalar dependências apenas para conseguir executar testes sem autorização.

## Segurança
Tratar como especialmente sensíveis:
- autenticação;
- autorização;
- RLS;
- RPCs;
- SECURITY DEFINER;
- uploads;
- dados de localização;
- viagens;
- GPS;
- dados de veículos;
- backup/restauração;
- integrações externas;
- secrets.

Para problemas de segurança:
- descrever o vetor;
- descrever impacto;
- separar risco teórico de exploração comprovada;
- propor a menor mitigação segura.

## Qualidade
Evitar:
- código morto;
- duplicação desnecessária;
- catches silenciosos;
- validações divergentes entre frontend e banco;
- números mágicos sem justificativa;
- conversões silenciosas de dados;
- arredondamentos prematuros em cálculos.

## Dados de GPS e viagens
Preservar precisão internamente.
Arredondar apenas na apresentação quando possível.

Mudanças envolvendo:
- distância GPS;
- Haversine;
- odômetro;
- sequence_number;
- timestamps;
- sincronização;
- viagens offline;
devem considerar duplicação, perda de dados, ordenação, idempotência e retomada após falha.

## Relatório final de cada tarefa
Sempre informar:

1. Objetivo.
2. Arquivos inspecionados.
3. Arquivos alterados.
4. Alterações realizadas.
5. Testes/comandos executados.
6. Evidências.
7. Riscos restantes.
8. Status:
   - CONFIRMADO
   - PENDENTE
   - NÃO COMPROVADO

Nunca usar “pronto para produção” sem evidências de:
- banco real;
- migrations;
- persistência;
- concorrência;
- segurança;
- secrets;
- infraestrutura;
- observabilidade;
- restart/recovery;
- homologação E2E.

## Estado conhecido do repositório
Esta seção registra apenas achados da auditoria inicial, sem corrigi-los. NÃO significa que todos tenham sido reproduzidos em execução.

Esta seção deve permanecer atualizada. Quando um achado for corrigido e validado com evidência suficiente, atualize ou remova o item correspondente na mesma tarefa, registrando no relatório final a evidência que justificou a mudança de estado. Não mantenha como pendente um problema já comprovadamente resolvido.

- migration SQL base contém definição inválida de average_consumption_km_l;
- update_vehicle_odometer usa SECURITY DEFINER e requer auditoria das permissões reais;
- aliases @ estão divergentes entre Vite, TypeScript e Vitest;
- .env.example não documenta as variáveis Supabase utilizadas;
- migrations estão distribuídas em mais de um diretório e não há ordem formal documentada;
- validação heading_degrees diverge entre Zod e PostgreSQL;
- fluxo de múltiplos veículos está incompleto;
- testes/build/banco real ainda precisam ser validados.
- CONFIRMADO — Conforme validação realizada no banco Supabase real, os privilégios excessivos de authenticated em public.fuel_entries, public.maintenance_entries, public.vehicle_documents, public.vehicle_expenses e public.vehicle_tires foram corrigidos e validados no banco real em 01/10/2026: somente CRUD permaneceu (SELECT, INSERT, UPDATE e DELETE = true); TRUNCATE, REFERENCES e TRIGGER = false. A aplicação foi manual via SQL Editor e NÃO está registrada no histórico supabase_migrations.
