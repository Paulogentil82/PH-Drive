# PH Drive — Estado atual do banco

Referência: 01/10/2026. Este documento registra o estado informado pelo responsável pelo projeto e a validação externa já relatada; não resulta de uma nova consulta ao Supabase.

## Referência operacional e histórico

- O banco Supabase real é atualmente a referência operacional do PH Drive.
- Existem migrations históricas no repositório que não representam exatamente o histórico aplicado no Supabase.
- O banco real possui migrations aplicadas que não estão todas reproduzidas como arquivos locais.
- PENDENTE: reconciliação completa entre o histórico do banco e os arquivos do repositório. Este documento não é um schema snapshot nem uma receita de reconstrução.

## Privilégios de authenticated

CONFIRMADO — A correção foi aplicada manualmente via Supabase SQL Editor em 01/10/2026 e validada externamente nas tabelas:

- public.fuel_entries
- public.maintenance_entries
- public.vehicle_documents
- public.vehicle_expenses
- public.vehicle_tires

Somente SELECT, INSERT, UPDATE e DELETE permaneceram (true). TRUNCATE, REFERENCES e TRIGGER foram removidos e confirmados como false.

Essa correção manual NÃO consta no histórico supabase_migrations. O arquivo [20261001000000_harden_authenticated_table_privileges.sql](../migrations/20261001000000_harden_authenticated_table_privileges.sql) permanece como registro/reprodutibilidade; sua presença não significa aplicação pelo mecanismo de migrations.

## Futuras alterações

- Migrations antigas NÃO devem ser reaplicadas cegamente em um banco novo. Antes de qualquer reconstrução, validar o histórico e os arquivos contra o schema real.
- Futuras alterações devem ser feitas por novas migrations versionadas, com dependências e evidências de aplicação e validação registradas.
