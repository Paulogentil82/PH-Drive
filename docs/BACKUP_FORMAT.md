# PH Drive — backup JSON verificável

O JSON preserva `app: "ph-drive"`, `schemaVersion: 1`, `exportedAt`, `user.preferences`
e os oito arrays existentes: `vehicles`, `trips`, `tripPoints`, `fuelEntries`,
`maintenanceEntries`, `vehicleExpenses`, `vehicleDocuments`, `vehicleTires`.
Backups antigos sem `metadata` continuam aceitos pelo preview/restore.

## Leitura completa e ownership

As nove tabelas consultadas são `profiles`, `vehicles`, `trips`, `trip_points`,
`fuel_entries`, `maintenance_entries`, `vehicle_expenses`, `vehicle_documents`
e `vehicle_tires`. Todas são filtradas explicitamente por `user_id`, além de RLS.
O exportador confirma que o ID solicitado corresponde à sessão autenticada.

As tabelas são lidas sequencialmente: no máximo uma consulta de página em andamento.
As páginas pedem 500 registros, para limitar cada resposta sem criar muitas requisições
simultâneas. Uma página vazia confirma o fim; páginas parciais não encerram cedo,
pois o servidor pode impor limite inferior ao solicitado.

A ordem é `id ASC`; em `trip_points`, `trip_id ASC, sequence_number ASC, id ASC`.
Erros, duplicatas, ownership divergente ou referências ausentes interrompem o backup.
Não se descarta silenciosamente um registro para produzir um arquivo aparentemente completo.

`profiles` continua fornecendo somente as preferências explicitamente permitidas:
não há nova exportação do nome, e-mail ou perfil pessoal completo.

## Metadados e contagens

O campo adicional `metadata` registra:

- `format_version: 1`, `app`, `user_id`;
- `backup_started_at`, `backup_completed_at`, `exported_at` (instantes ISO 8601);
- `consistency: "non_transactional"`;
- `counts`, com nomes das nove tabelas;
- `checksum`, com `algorithm: "SHA-256"`, `scope: "payload-without-checksum"`, `value` hexadecimal.

As oito contagens de dados correspondem aos comprimentos dos arrays exportados após
sanitização. `counts.profiles` informa a quantidade de registros de origem das
preferências (0 ou 1), representadas em `user.preferences`, e não um array de perfis.
O timestamp de conclusão marca o término da preparação dos dados; não comprova que
o usuário salvou o download no disco.

Isso **não é um snapshot transacional**. Inserções/exclusões durante as consultas
podem produzir uma visão de instantes diferentes; erros detectáveis provocam falha,
mas contagens e checksum não provam um estado atômico do banco. Para maior estabilidade,
exportar fora de períodos de escrita intensa e homologar com o volume real.

## Integridade e compatibilidade

O SHA-256 é calculado pela Web Crypto API sobre JSON canônico: chaves de objetos
ordenadas, arrays preservados, excluindo somente `metadata.checksum` do payload completo.
Ele inclui dados, contagens e timestamps. Não é criptografia de armazenamento nem
assinatura digital/autenticação da origem; quem editar o arquivo pode recalcular o hash.
É necessário HTTPS ou localhost com Web Crypto disponível. Se indisponível, o
exportador informa erro em vez de gerar silenciosamente um backup sem checksum.

Na importação, metadados ausentes são permitidos. Quando contagens ou checksum são
fornecidos, são validados antes das consultas do preview e antes de qualquer escrita.
Metadados não são propagados aos registros inseridos. O comportamento de ownership,
conflitos e importação existente não foi redesenhado.

Tokens, senhas, chaves e containers de sessão/configuração são removidos recursivamente
dos registros. Configurações locais do cliente e objetos de sessão não são exportados.
Texto livre do usuário continua sendo dado do usuário; não há garantia de detectar
credenciais que tenham sido coladas dentro de notas ou outros textos livres.

## Fora desta etapa

- Paginação e revisão completas dos CSVs independentes.
- Compactação/streaming para volumes que excedam a memória do navegador.
- Evolução do preview de restore já existente e leitura completa das tabelas nele.
- Backup automático agendado.

O restore existente mantém o limite de arquivo da interface (50 MB). Este trabalho
não executa importação real, não modifica schema e não publica o app.
