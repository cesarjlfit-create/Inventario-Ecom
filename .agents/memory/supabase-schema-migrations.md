---
name: Migrações incrementais do Supabase
description: Regra para evoluir tabelas Supabase já existentes sem depender apenas da criação inicial.
---

Ao adicionar campos a uma tabela que pode já existir no projeto Supabase, mantenha a definição no `CREATE TABLE` e inclua também um `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` explícito.

**Why:** `CREATE TABLE IF NOT EXISTS` não altera uma tabela existente. Sem a migração incremental, o frontend pode receber erros de schema cache ao tentar inserir ou atualizar a nova coluna.

**How to apply:** Sempre que o código passar a ler ou escrever um novo campo Supabase, atualize o SQL de migração com `ADD COLUMN IF NOT EXISTS`, execute-o no SQL Editor e só depois valide o fluxo no app.